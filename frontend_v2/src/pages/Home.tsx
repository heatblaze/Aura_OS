import { useEffect, useRef, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Brain, Database, FileSearch, Mic, Navigation, RefreshCcw, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AuraOrb, type VisualizerState } from "@/components/aura/AuraOrb";
import { CommandBar } from "@/components/aura/CommandBar";
import { JarvisWebSocket } from "@/lib/websocket";
import type { JarvisEvent, ChatMessage, AgentLogEntry, SystemStatus } from "@/lib/jarvis-types";

const EVENT_LABELS: Record<string, string> = {
  pipeline_start: "Pipeline activated",
  intent_extracting: "Extracting intent",
  intent_extracted: "Intent identified",
  agent_start: "Agent activated",
  agent_thinking: "Reasoning",
  commander_decision: "Strategy decided",
  plan_created: "Plan generated",
  step_start: "Executing step",
  step_complete: "Step completed",
  step_failed: "Step failed",
  execution_complete: "Execution complete",
  critic_verdict: "Quality assessed",
  memory_retrieved: "Context loaded",
  memory_updated: "Memory updated",
  pipeline_complete: "Task complete",
  direct_response_mode: "Direct response",
};

export default function Home() {
  const [orbState, setOrbState] = useState<VisualizerState>("listening");
  const wsRef = useRef<JarvisWebSocket | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentLog, setAgentLog] = useState<AgentLogEntry[]>([]);
  const [status, setStatus] = useState<SystemStatus>({
    connected: false, ollamaAvailable: false, model: "mistral", sessionId: "", eventCount: 0,
  });
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(uuidv4());
  }, []);

  const addLogEntry = useCallback((event: JarvisEvent) => {
    const entry: AgentLogEntry = {
      id: uuidv4(), type: event.type, agent: event.agent,
      title: EVENT_LABELS[event.type] || event.type,
      content: String(event.data?.content || event.data?.decision || event.data?.result || (event.data ? JSON.stringify(event.data).slice(0, 120) : "")),
      timestamp: new Date().toISOString(),
    };
    setAgentLog(prev => [...prev, entry].slice(-50));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const ws = new JarvisWebSocket(sessionId);
    
    const off = ws.on("*", (event: JarvisEvent) => {
      addLogEntry(event);
      
      if (event.type === "pipeline_start") setOrbState("listening");
      else if (event.type === "agent_thinking" || event.type === "step_start") setOrbState("thinking");
      else if (event.type === "final_response" || event.type === "direct_response_mode") {
        setOrbState("speaking");
        if (event.data) {
          setMessages(prev => [...prev, {
            id: uuidv4(),
            role: "assistant",
            content: (event.data.content as string) || "Response received.",
            timestamp: new Date().toISOString()
          }]);
        }
      }
      
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setOrbState("listening"), 3000);
    });

    ws.onStatusChange = (connected) => setStatus(s => ({ ...s, connected }));
    
    ws.connect().catch(err => {
      console.error("Connection failed:", err);
      setStatus(s => ({ ...s, connected: false }));
    });

    wsRef.current = ws;
    return () => { off(); ws.disconnect(); };
  }, [sessionId, addLogEntry]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: uuidv4(), role: "user", content: text, timestamp: new Date().toISOString() }]);
    setOrbState("thinking");
    try {
      wsRef.current?.send({ type: "user_message", data: { content: text } });
    } catch {
      setMessages(prev => [...prev, { id: uuidv4(), role: "assistant", content: "Communication interrupt. Verify Neural Link.", timestamp: new Date().toISOString() }]);
    }
  };

  const getIconForEvent = (type: string) => {
    if (type.includes("memory")) return Database;
    if (type.includes("pipeline") || type.includes("agent")) return Brain;
    if (type.includes("critic") || type.includes("step_failed")) return ShieldCheck;
    return Activity;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Welcome back, Operator." subtitle="AURA is online and adaptive." />
      <div className="px-8 py-6 flex flex-col gap-6">
        {/* AURA CORE label */}
        <div className="text-center">
          <p className="font-display tracking-[0.4em] text-primary text-sm">AURA CORE</p>
          <p className="text-[11px] font-mono-os text-muted-foreground tracking-widest mt-1">
            <span className={status.connected ? "text-success" : "text-destructive"}>
              {status.connected ? "Online" : "Offline"}
            </span> · <span className="text-primary">Adaptive</span> · <span className="text-secondary">Learning</span>
          </p>
        </div>

        {/* Orb + corner stats */}
        <div className="grid grid-cols-12 gap-6 items-center">
          <CornerStat title="System Health" value={status.connected ? "92%" : "0%"} tone="success" subtitle={status.connected ? "Excellent" : "Offline"} className="col-span-12 md:col-span-3" delay={0.1} />
          <div className="col-span-12 md:col-span-6 flex items-center justify-center">
            <AuraOrb state={orbState} size={360} amplitude={0.6} />
          </div>
          <CornerStat title="Neural Sync" value={status.connected ? "98.7%" : "0%"} tone="primary" subtitle={status.connected ? "Stable" : "Lost"} className="col-span-12 md:col-span-3" delay={0.2} align="right" />
          <CornerStat title="Memory Stream" value="2.34 TB" tone="secondary" subtitle="Indexed & Optimized" className="col-span-12 md:col-span-3" delay={0.3} />
          <div className="col-span-12 md:col-span-6" />
          <CornerStat title="Active State" value={orbState === "listening" ? "Listening" : orbState === "thinking" ? "Processing" : "Speaking"} tone="primary" waveform className="col-span-12 md:col-span-3" delay={0.4} align="right" />
        </div>

        {/* Command bar */}
        <div className="max-w-3xl w-full mx-auto">
          <CommandBar state={orbState} onSubmit={sendMessage} />
        </div>

        {/* Chat Messages */}
        <AnimatePresence>
          {messages.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="max-w-3xl w-full mx-auto max-h-[250px] overflow-y-auto scrollbar-hide space-y-3 mb-4">
              {messages.slice(-6).map((msg) => (
                <div key={msg.id} className={`p-4 rounded-2xl border glass flex flex-col gap-1 ${msg.role === "user" ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
                  <span className={`text-[10px] font-mono-os uppercase tracking-wider ${msg.role === "user" ? "text-primary" : "text-secondary"}`}>
                    {msg.role === "user" ? "YOU" : "AURA"}
                  </span>
                  <p className="text-sm text-foreground/90">{msg.content}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick actions */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-mono-os text-muted-foreground mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAction icon={Navigation} title="Quick Command"  desc="Execute action"      tone="primary" onClick={() => sendMessage("Quick Command")} />
            <QuickAction icon={FileSearch} title="Deep Research"  desc="AI-powered insights" tone="secondary" onClick={() => sendMessage("Deep Research")} />
            <QuickAction icon={RefreshCcw} title="Memory Recall"  desc="Access knowledge"    tone="primary" onClick={() => sendMessage("Memory Recall")} />
            <QuickAction icon={ShieldCheck} title="System Analyze" desc="Diagnose & optimize" tone="success" onClick={() => sendMessage("System Analyze")} />
          </div>
        </div>

        {/* Recent activity + voice activity */}
        <div className="grid grid-cols-12 gap-6 pb-10">
          <div className="col-span-12 lg:col-span-7 glass rounded-2xl p-5 overflow-y-auto max-h-[300px] scrollbar-hide">
            <p className="text-[10px] uppercase tracking-[0.3em] font-mono-os text-muted-foreground mb-4">Recent Activity</p>
            <ul className="divide-y divide-border/30">
              {agentLog.length === 0 ? (
                <li className="py-3 text-sm text-muted-foreground font-mono-os">No recent activity.</li>
              ) : (
                [...agentLog].reverse().slice(0, 10).map((log) => (
                  <ActivityRow key={log.id} icon={getIconForEvent(log.type)} title={log.title} detail={log.content || log.type} time={new Date(log.timestamp).toLocaleTimeString()} />
                ))
              )}
            </ul>
          </div>
          <div className="col-span-12 lg:col-span-5 glass rounded-2xl p-5 flex flex-col">
            <p className="text-[10px] uppercase tracking-[0.3em] font-mono-os text-muted-foreground mb-4">Voice Activity</p>
            <VoiceWave active={orbState !== "idle"} />
            <p className="text-xs text-center font-mono-os text-muted-foreground mt-3">
              {orbState === "listening" ? "Listening…" : orbState === "thinking" ? "Processing…" : orbState === "speaking" ? "Speaking…" : "Standing By"}
            </p>
            <div className="flex justify-center gap-2 mt-4">
              {[Mic, Activity, ShieldCheck].map((I, i) => (
                <button key={i} className="w-10 h-10 rounded-xl glass flex items-center justify-center text-primary hover:bg-primary/10 transition">
                  <I className="w-4 h-4" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CornerStat({ title, value, subtitle, tone, waveform, className, delay = 0, align = "left" }: {
  title: string; value: string; subtitle?: string; tone: "primary" | "secondary" | "success";
  waveform?: boolean; className?: string; delay?: number; align?: "left" | "right";
}) {
  const color = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : "text-success";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.6 }}
      className={`glass rounded-2xl p-4 ${className} ${align === "right" ? "text-right" : ""}`}
    >
      <p className="text-[10px] uppercase tracking-[0.28em] font-mono-os text-muted-foreground">{title}</p>
      <p className={`font-display text-3xl mt-2 ${color}`}>{value}</p>
      {subtitle && !waveform && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      {waveform && <MiniWave />}
    </motion.div>
  );
}

function MiniWave() {
  return (
    <div className="flex items-end gap-[2px] h-6 mt-2 justify-end">
      {[...Array(20)].map((_, i) => (
        <motion.span key={i} className="w-[2px] rounded-full bg-primary"
          animate={{ height: [3, 8 + ((i * 7) % 14), 4, 12 + ((i * 5) % 8), 3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.04 }} />
      ))}
    </div>
  );
}

function VoiceWave({ active }: { active: boolean }) {
  return (
    <div className="flex items-end justify-center gap-[3px] h-20" style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.6))" }}>
      {[...Array(48)].map((_, i) => (
        <motion.span key={i} className="w-[3px] rounded-full bg-primary"
          animate={active ? { height: [6, 14 + ((i * 11) % 50), 10, 30 + ((i * 7) % 30), 6] } : { height: 6 }}
          transition={{ duration: 1.4, repeat: active ? Infinity : 0, delay: i * 0.03 }} />
      ))}
    </div>
  );
}

function QuickAction({ icon: Icon, title, desc, tone, onClick }: { icon: React.ElementType; title: string; desc: string; tone: "primary" | "secondary" | "success"; onClick?: () => void }) {
  const tones = {
    primary:   { text: "text-primary",   border: "border-primary/40",   glow: "0 0 20px hsl(var(--primary)/0.45)",   ring: "hover:shadow-[0_0_30px_-5px_hsl(var(--primary)/0.6)]" },
    secondary: { text: "text-secondary", border: "border-secondary/40", glow: "0 0 20px hsl(var(--secondary)/0.45)", ring: "hover:shadow-[0_0_30px_-5px_hsl(var(--secondary)/0.6)]" },
    success:   { text: "text-success",   border: "border-success/40",   glow: "0 0 20px hsl(var(--success)/0.45)",   ring: "hover:shadow-[0_0_30px_-5px_hsl(var(--success)/0.6)]" },
  } as const;
  const t = tones[tone];
  return (
    <motion.button onClick={onClick} whileHover={{ y: -3 }} className={`glass rounded-2xl p-4 text-left group transition border border-white/[0.04] ${t.ring}`}>
      <div className={`w-11 h-11 rounded-xl border ${t.border} bg-background/40 flex items-center justify-center mb-3 ${t.text}`} style={{ boxShadow: `inset 0 0 12px hsl(var(--background)), ${t.glow}` }}>
        <Icon className="w-5 h-5" strokeWidth={1.4} style={{ filter: `drop-shadow(0 0 6px currentColor)` }} />
      </div>
      <p className="font-display text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </motion.button>
  );
}

function ActivityRow({ icon: Icon, title, detail, time }: { icon: React.ElementType; title: string; detail: string; time: string }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
        <Icon className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-display text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{detail}</p>
      </div>
      <span className="text-[10px] font-mono-os text-muted-foreground tracking-wider whitespace-nowrap">{time}</span>
    </li>
  );
}