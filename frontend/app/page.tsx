"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { 
  Mic, Trash2, Send, Activity, ChevronRight, X, Loader2, Database, Zap, Cpu, Globe, Search
} from "lucide-react";
import { JarvisWebSocket } from "@/lib/websocket";
import { 
  ChatMessage, JarvisEvent, AgentLogEntry, SystemStatus, 
  EVENT_LABELS, AGENT_COLORS, AGENT_ICONS 
} from "@/lib/types";
import { NebulaVisualizer, VisualizerState } from "./components/NebulaVisualizer";

export default function JarvisPage() {
  const [sessionId, setSessionId] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentLog, setAgentLog] = useState<AgentLogEntry[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [amplitude, setAmplitude] = useState(0.5);
  const [status, setStatus] = useState<SystemStatus>({
    connected: false,
    ollamaAvailable: false,
    model: "mistral",
    sessionId: "",
    eventCount: 0,
  });

  const wsRef = useRef<JarvisWebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const visualizerState: VisualizerState = isListening ? "listening" : isProcessing ? "thinking" : "idle";

  useEffect(() => {
    const id = uuidv4();
    setSessionId(id);
    setIsMounted(true);
    setStatus(s => ({ ...s, sessionId: id }));
  }, []);

  useEffect(() => {
    if (isListening || isProcessing) {
      const interval = setInterval(() => setAmplitude(Math.random()), 100);
      return () => clearInterval(interval);
    } else {
      setAmplitude(0.2);
    }
  }, [isListening, isProcessing]);

  const addLogEntry = useCallback((event: JarvisEvent) => {
    const entry: AgentLogEntry = {
      id: uuidv4(),
      type: event.type,
      agent: event.agent,
      timestamp: event.timestamp || new Date().toISOString(),
      title: EVENT_LABELS[event.type] || event.message || "System Action",
      status: "done"
    };
    setAgentLog(prev => [...prev.slice(-100), entry]);
    if (["agent_response", "execution_complete"].includes(event.type)) {
      setShowRightPanel(true);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    
    const ws = new JarvisWebSocket(sessionId);
    wsRef.current = ws;
    ws.connect()
      .then(() => setStatus(s => ({ ...s, connected: true })))
      .catch(() => setStatus(s => ({ ...s, connected: false })));

    ws.on("*", addLogEntry);
    ws.on("pipeline_start", () => setIsProcessing(true));
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
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { id: uuidv4(), role: "assistant", content: data.response, timestamp: new Date().toISOString() }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: uuidv4(), role: "assistant", content: "Communication interrupt detected. Verify Neural Link status.", timestamp: new Date().toISOString() }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-1 h-full relative overflow-hidden">
      
      {/* ── Neural Interface Center ── */}
      <section className="flex-1 flex flex-col items-center relative overflow-hidden">
        
        {/* Top Status Bar (Smaller/Centered) */}
        <header className="w-full max-w-4xl px-8 py-8 flex items-center justify-between animate-fade-in z-50">
          <div className="flex items-center gap-10">
             <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] animate-pulse ${status.connected ? 'text-[var(--accent-cyan)]' : 'text-red-500'}`} />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white brightness-110">Link: {status.connected ? 'Active' : 'Offline'}</span>
                </div>
                <span className="text-[8px] font-bold text-[var(--text-muted)] tracking-[0.2em] ml-5 uppercase">ID: {sessionId.split('-')[0]}</span>
             </div>
             <div className="h-8 w-px bg-white/10" />
             <div className="flex items-center gap-4 text-white/80">
                <Cpu className="w-4 h-4 text-[var(--accent-cyan)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{status.model}</span>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <button 
               onClick={() => setShowRightPanel(!showRightPanel)} 
               className={`p-3 rounded-xl border transition-all duration-300 group ${showRightPanel ? 'bg-[var(--accent-cyan)] text-black border-transparent' : 'border-white/10 text-[var(--text-muted)] hover:text-white'}`}
             >
                <Activity className="w-5 h-5" />
             </button>
             <button onClick={() => setMessages([])} className="p-3 rounded-xl border border-white/10 text-[var(--text-muted)] hover:text-white transition-all">
                <Trash2 className="w-5 h-5" />
             </button>
          </div>
        </header>

        {/* Focus Area */}
        <div className="flex-1 w-full relative flex items-center justify-center -translate-y-6">
          <div className="flex flex-col items-center gap-14 w-full max-w-3xl px-8">
            
            {/* Visualizer Section */}
            <div className="animate-fade-in">
               <NebulaVisualizer state={visualizerState} amplitude={amplitude} />
            </div>

            {/* Directive Action Grid (Smaller Cards) */}
            {messages.length === 0 && (
              <div className="grid grid-cols-2 gap-6 w-full max-w-2xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
                {[
                  { label: "System Diagnostics", icon: Activity, desc: "Verify core stability", color: "var(--accent-cyan)" },
                  { label: "Memory Retrieval", icon: Database, desc: "Recall context", color: "var(--accent-purple)" },
                  { label: "Global Search", icon: Globe, desc: "Acquire datasets", color: "var(--accent-blue)" },
                  { label: "Research Analysis", icon: Search, desc: "Synthesize data", color: "#10B981" }
                ].map((item, i) => (
                  <button 
                    key={i} 
                    onClick={() => sendMessage(item.label)}
                    className="glass-card !p-6 flex flex-col gap-4 text-left group transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 group-hover:border-current transition-all" style={{ color: item.color }}>
                        <item.icon className="w-5.5 h-5.5" />
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all text-white/40" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white mb-0.5 group-hover:text-[var(--accent-cyan)] transition-colors">{item.label}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-widest">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Chat Flow Overlay */}
            {messages.length > 0 && (
              <div className="absolute inset-0 flex flex-col px-8 py-24 pointer-events-none">
                <div className="flex-1 overflow-y-auto scrollbar-hide space-y-10 pb-32 pointer-events-auto">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                      <div className={`max-w-[75%] glass-card !p-6 !rounded-[24px] ${m.role === 'user' ? 'border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/5' : 'border-white/10 bg-white/[0.03]'}`}>
                        <div className="flex items-center gap-3 mb-3">
                           <div className={`w-1.5 h-1.5 rounded-full ${m.role === 'user' ? 'bg-[var(--accent-cyan)]' : 'bg-[var(--accent-purple)]'}`} />
                           <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{m.role}</span>
                        </div>
                        <p className="text-[14px] leading-relaxed text-white font-medium">{m.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Console Console */}
        <footer className="w-full max-w-3xl px-8 pb-12 pt-4 animate-fade-in z-50">
          <div className="input-container !p-2 border-white/10">
            <button 
              onMouseDown={() => setIsListening(true)}
              onMouseUp={() => setIsListening(false)}
              className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-[var(--accent-cyan)] text-black' : 'bg-white/5 text-[var(--text-muted)] hover:text-white'}`}
            >
              <Mic className="w-6 h-6" />
            </button>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="Neural directive..."
              className="flex-1 bg-transparent border-none outline-none px-6 text-lg font-light text-white placeholder-white/10"
            />
            <button 
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="w-14 h-14 rounded-xl flex items-center justify-center bg-white/5 text-[var(--text-muted)] hover:bg-[var(--accent-cyan)] hover:text-black transition-all disabled:opacity-5"
            >
              {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            </button>
          </div>
        </footer>
      </section>

      {/* ── System Trace Overlay ── */}
      <aside className={`panel-right ${showRightPanel ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 shadow-none'}`}>
        <div className="h-full flex flex-col">
          <header className="px-8 py-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-4">
               <Activity className="w-5 h-5 text-[var(--accent-purple)]" />
               <div>
                  <h3 className="text-[10px] font-black text-white m-0 tracking-[0.2em]">System Trace</h3>
               </div>
            </div>
            <button onClick={() => setShowRightPanel(false)} className="text-white/20 hover:text-white p-2 transition-all">
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-8 scrollbar-hide space-y-4">
            {agentLog.slice().reverse().map((log) => (
              <div key={log.id} className="animate-fade-in flex gap-4 py-4 border-b border-white/5 group hover:bg-white/[0.02] px-4 -mx-4 rounded-lg transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[9px] font-black flex-shrink-0 border border-current" 
                  style={{ background: `${AGENT_COLORS[log.agent || 'commander']}10`, color: AGENT_COLORS[log.agent || 'commander'] }}>
                  {log.agent ? AGENT_ICONS[log.agent] : "SYS"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.1em]" style={{ color: AGENT_COLORS[log.agent || 'commander'] }}>{log.agent}</span>
                    <span className="text-[8px] text-[var(--text-muted)] font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                  </div>
                  <p className="text-[12px] text-white/90 leading-relaxed font-bold truncate">{log.title}</p>
                </div>
              </div>
            ))}
          </div>

          <footer className="p-8 border-t border-white/5">
             <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] w-[99%] shadow-[0_0_10px_var(--accent-cyan)]" />
             </div>
          </footer>
        </div>
      </aside>
    </div>
  );
}
