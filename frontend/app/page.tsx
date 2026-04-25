"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Mic, Trash2, Send, Activity, X, Loader2, Database, Globe, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { JarvisWebSocket } from "@/lib/websocket";
import { ChatMessage, JarvisEvent, AgentLogEntry, SystemStatus, EVENT_LABELS, AGENT_COLORS, AGENT_ICONS } from "@/lib/types";
import { AuraOrb, VisualizerState } from "./components/NebulaVisualizer";

const ACTION_CARDS = [
  { label: "System Diagnostics", icon: Activity, desc: "Run full system health check",  color: "#00E5FF" },
  { label: "Memory Retrieval",   icon: Database, desc: "Access cognitive data stores",   color: "#A855F7" },
  { label: "Global Search",      icon: Globe,    desc: "Query external knowledge",       color: "#4F8EFF" },
  { label: "Research Analysis",  icon: Search,   desc: "Deep analysis pipeline",         color: "#10B981" },
];

export default function JarvisPage() {
  const [sessionId,      setSessionId]      = useState("");
  const [isMounted,      setIsMounted]      = useState(false);
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [agentLog,       setAgentLog]       = useState<AgentLogEntry[]>([]);
  const [input,          setInput]          = useState("");
  const [isProcessing,   setIsProcessing]   = useState(false);
  const [isListening,    setIsListening]    = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [amplitude,      setAmplitude]      = useState(0.5);
  const [status,         setStatus]         = useState<SystemStatus>({
    connected: false, ollamaAvailable: false, model: "mistral", sessionId: "", eventCount: 0,
  });

  const wsRef      = useRef<JarvisWebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const visualizerState: VisualizerState =
    isListening ? "listening" : isProcessing ? "thinking" : "idle";

  useEffect(() => { const id = uuidv4(); setSessionId(id); setIsMounted(true); setStatus(s => ({ ...s, sessionId: id })); }, []);

  useEffect(() => {
    if (isListening || isProcessing) {
      const iv = setInterval(() => setAmplitude(Math.random()), 100);
      return () => clearInterval(iv);
    }
    setAmplitude(0.2);
  }, [isListening, isProcessing]);

  const addLogEntry = useCallback((event: JarvisEvent) => {
    const entry: AgentLogEntry = {
      id: uuidv4(), type: event.type, agent: event.agent,
      timestamp: event.timestamp || new Date().toISOString(),
      title: EVENT_LABELS[event.type] || event.message || "System Action",
      status: "done",
    };
    setAgentLog(prev => [...prev.slice(-100), entry]);
    if (["agent_response", "execution_complete"].includes(event.type)) setShowRightPanel(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const ws = new JarvisWebSocket(sessionId);
    wsRef.current = ws;
    ws.connect().then(() => setStatus(s => ({ ...s, connected: true }))).catch(() => setStatus(s => ({ ...s, connected: false })));
    ws.on("*", addLogEntry);
    ws.on("pipeline_start",    () => setIsProcessing(true));
    ws.on("pipeline_complete", () => setIsProcessing(false));
    return () => ws.disconnect();
  }, [sessionId, addLogEntry, isMounted]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;
    setInput("");
    setMessages(prev => [...prev, { id: uuidv4(), role: "user", content: text, timestamp: new Date().toISOString() }]);
    setIsProcessing(true);
    wsRef.current?.sendMessage(text);
    try {
      const res  = await fetch("http://localhost:8000/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, session_id: sessionId }) });
      const data = await res.json();
      setMessages(prev => [...prev, { id: uuidv4(), role: "assistant", content: data.response, timestamp: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, { id: uuidv4(), role: "assistant", content: "Communication interrupt. Verify Neural Link.", timestamp: new Date().toISOString() }]);
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="flex flex-1 h-full relative overflow-hidden">
      <section className="flex-1 flex flex-col items-center relative overflow-hidden">

        {/* ── Top Status Bar ── */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl px-10 py-5 flex items-center justify-between z-50"
        >
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className={`status-dot ${!status.connected ? "!bg-red-500 !shadow-[0_0_8px_red]" : ""}`} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: status.connected ? "var(--accent-cyan)" : "rgba(255,100,100,0.8)" }}>
                {status.connected ? "Active" : "Offline"}
              </span>
            </div>
            <div className="h-5 w-px bg-white/10" />
            <span className="text-[10px] font-medium text-[var(--text-muted)] tracking-[0.15em] uppercase">
              Core: {status.model}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="p-3 rounded-2xl border transition-all duration-300"
              style={{
                borderColor: showRightPanel ? "var(--accent-cyan)" : "var(--border-card)",
                background: showRightPanel ? "rgba(0,229,255,0.12)" : "rgba(15,25,55,0.5)",
                color: showRightPanel ? "var(--accent-cyan)" : "var(--text-muted)",
                boxShadow: showRightPanel ? "0 0 20px rgba(0,229,255,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" : "inset 0 1px 0 rgba(255,255,255,0.05)",
                cursor: "pointer",
              }}
            >
              <Activity className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
              onClick={() => setMessages([])}
              className="p-3 rounded-2xl border border-[var(--border-card)] text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-all"
              style={{ background: "rgba(15,25,55,0.5)", cursor: "pointer", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.header>

        {/* ── Center Focus Area ── */}
        <div className="flex-1 w-full relative flex items-center justify-center">
          {/* AMBIENT LIGHT — The orb casts light onto the background */}
          <div className="orb-ambient-light" style={{ top: "10%", left: "50%", transform: "translateX(-50%)" }} />
          {/* Secondary purple ambient light — below the orb */}
          <div style={{
            position: "absolute", width: 600, height: 400, borderRadius: "50%",
            background: "radial-gradient(ellipse at center, rgba(120,50,200,0.1) 0%, rgba(80,30,160,0.05) 40%, transparent 70%)",
            filter: "blur(70px)", pointerEvents: "none", zIndex: 0,
            top: "45%", left: "50%", transform: "translateX(-50%)",
          }} />

          <div className="flex flex-col items-center w-full max-w-5xl px-10" style={{ gap: 32 }}>

            {/* AURA branding above orb — thin, elegant, serif-like */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="text-center"
              style={{ position: "relative", zIndex: 5 }}
            >
              <h1 style={{ fontSize: 64, fontWeight: 300, letterSpacing: "0.12em", marginBottom: 10 }}>
                AURA
              </h1>
              <motion.p
                animate={{ opacity: [0.45, 0.8, 0.45] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--accent-cyan)" }}
              >
                {visualizerState === "idle" ? "Standing By" : visualizerState === "listening" ? "Actively Listening..." : visualizerState === "thinking" ? "Processing..." : "Speaking"}
              </motion.p>
            </motion.div>

            {/* THE ORB */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: "relative", zIndex: 5 }}
            >
              <AuraOrb state={visualizerState} amplitude={amplitude} size={360} />
            </motion.div>

            {/* ── Action Cards (empty state only) ── */}
            <AnimatePresence mode="wait">
              {messages.length === 0 && (
                <motion.div
                  key="action-cards"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="grid grid-cols-4 w-full"
                  style={{ gap: 16, position: "relative", zIndex: 5 }}
                >
                  {ACTION_CARDS.map((item, i) => (
                    <motion.button
                      key={i}
                      onClick={() => sendMessage(item.label)}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ y: -6, scale: 1.025, transition: { duration: 0.25 } }}
                      whileTap={{ scale: 0.97 }}
                      className="glass-card text-left group"
                      style={{ padding: "22px 20px", cursor: "pointer" }}
                    >
                      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                        <div
                          className="flex items-center justify-center rounded-xl transition-all"
                          style={{
                            width: 40, height: 40,
                            color: item.color,
                            background: `${item.color}12`,
                            border: `1px solid ${item.color}25`,
                            boxShadow: `0 0 16px ${item.color}15`,
                          }}
                        >
                          <item.icon className="w-[18px] h-[18px]" />
                        </div>
                      </div>
                      <p className="text-[14px] font-semibold text-white mb-1.5 group-hover:text-[var(--accent-cyan)] transition-colors">{item.label}</p>
                      <p className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">{item.desc}</p>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Chat Flow ── */}
            <AnimatePresence>
              {messages.length > 0 && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex flex-col px-10 py-28 pointer-events-none"
                  style={{ zIndex: 5 }}
                >
                  <div className="flex-1 overflow-y-auto scrollbar-hide pb-28 pointer-events-auto" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {messages.map((m, idx) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: idx * 0.04, ease: "easeOut" }}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className="glass-card"
                          style={{
                            maxWidth: "70%",
                            padding: "18px 22px",
                            borderRadius: 20,
                            borderColor: m.role === "user" ? "rgba(0,229,255,0.2)" : "var(--border-card)",
                            background: m.role === "user"
                              ? "linear-gradient(135deg, rgba(0,229,255,0.08) 0%, rgba(0,150,200,0.04) 100%)"
                              : "linear-gradient(135deg, rgba(15,25,55,0.6) 0%, rgba(10,18,40,0.5) 100%)",
                          }}
                        >
                          <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                            <div style={{
                              width: 6, height: 6, borderRadius: "50%",
                              background: m.role === "user" ? "var(--accent-cyan)" : "var(--accent-purple)",
                              boxShadow: m.role === "user" ? "0 0 8px var(--accent-cyan)" : "0 0 8px var(--accent-purple)",
                            }} />
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.25em", color: "var(--text-muted)" }}>{m.role}</span>
                          </div>
                          <p className="text-[14px] leading-relaxed text-white/90">{m.content}</p>
                        </div>
                      </motion.div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Command Bar ── */}
        <motion.footer
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-3xl px-10 z-50"
          style={{ paddingBottom: 20, paddingTop: 4 }}
        >
          <div className="input-container">
            <motion.button
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={() => setIsListening(p => !p)}
              className="flex-shrink-0 flex items-center justify-center rounded-xl transition-all"
              style={{
                width: 44, height: 44, cursor: "pointer",
                background: isListening ? "var(--accent-cyan)" : "rgba(15,25,55,0.7)",
                color: isListening ? "#000" : "var(--text-muted)",
                boxShadow: isListening ? "0 0 28px rgba(0,229,255,0.6)" : "inset 0 1px 0 rgba(255,255,255,0.05)",
                border: isListening ? "none" : "1px solid var(--border-card)",
              }}
            >
              <Mic className="w-[18px] h-[18px]" />
            </motion.button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage(input)}
              placeholder="Speak a directive..."
              className="flex-1 bg-transparent border-none outline-none text-[15px] text-white placeholder-white/20"
              style={{ padding: "0 20px", cursor: "text" }}
            />
            <motion.button
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="flex-shrink-0 flex items-center justify-center rounded-xl transition-all disabled:opacity-15"
              style={{
                width: 44, height: 44, cursor: "pointer",
                background: "rgba(15,25,55,0.7)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-card)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              {isProcessing ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Send className="w-[18px] h-[18px]" />}
            </motion.button>
          </div>
        </motion.footer>
      </section>

      {/* ── System Trace Panel ── */}
      <AnimatePresence>
        {showRightPanel && (
          <motion.aside
            key="right-panel"
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="panel-right"
          >
            <div className="h-full flex flex-col">
              <header className="px-6 py-5 border-b border-[var(--border-card)] flex items-center justify-between" style={{ background: "rgba(10,18,38,0.5)" }}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{
                      background: "rgba(168,85,247,0.12)",
                      border: "1px solid rgba(168,85,247,0.25)",
                      boxShadow: "0 0 12px rgba(168,85,247,0.15)",
                    }}
                  >
                    <Activity className="w-4 h-4 text-[var(--accent-purple)]" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 10, margin: 0 }}>System Trace</h3>
                    <p style={{ fontSize: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 2 }}>Real-time Events</p>
                  </div>
                </div>
                <button onClick={() => setShowRightPanel(false)} className="text-white/25 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all" style={{ cursor: "pointer" }}>
                  <X className="w-4 h-4" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {agentLog.slice().reverse().map(log => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="group relative overflow-hidden rounded-xl transition-all"
                    style={{
                      display: "flex", gap: 12, padding: 14,
                      border: "1px solid var(--border-card)",
                      background: "rgba(10,18,40,0.4)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 w-[2px] h-full rounded-r-full"
                      style={{ backgroundColor: AGENT_COLORS[log.agent || "commander"] }}
                    />
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[7px] font-bold flex-shrink-0"
                      style={{
                        background: `${AGENT_COLORS[log.agent || "commander"]}10`,
                        color: AGENT_COLORS[log.agent || "commander"],
                        border: `1px solid ${AGENT_COLORS[log.agent || "commander"]}25`,
                      }}
                    >
                      {log.agent ? AGENT_ICONS[log.agent] : "SYS"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[7px] font-bold uppercase tracking-[0.15em] opacity-75" style={{ color: AGENT_COLORS[log.agent || "commander"] }}>{log.agent || "SYSTEM"}</span>
                        <span className="text-[7px] text-[var(--text-dim)] font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      </div>
                      <p className="text-[11px] text-white/70 leading-snug font-medium line-clamp-2 group-hover:text-white transition-colors">{log.title}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <footer className="p-5 border-t border-[var(--border-card)]" style={{ background: "rgba(10,18,38,0.4)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Neural Load</span>
                  <span className="text-[8px] font-bold text-glow-cyan uppercase tracking-widest">99%</span>
                </div>
                <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))",
                      boxShadow: "0 0 12px var(--glow-cyan-md)",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: "99%" }}
                    transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </footer>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
