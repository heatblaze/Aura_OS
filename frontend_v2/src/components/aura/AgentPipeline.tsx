import { motion, AnimatePresence } from "framer-motion";
import { Brain, Compass, ListTree, Cpu, Database, ShieldCheck, ChevronRight } from "lucide-react";
import type { AgentName, AgentLogEntry } from "@/lib/jarvis-types";

interface Props {
  activeAgent: AgentName | null;
  logs: AgentLogEntry[];
}

const PIPELINE: { id: AgentName; label: string; icon: typeof Brain; tone: "cyan" | "purple" | "emerald" }[] = [
  { id: "intent",    label: "Intent",    icon: Compass,     tone: "cyan" },
  { id: "commander", label: "Commander", icon: Brain,       tone: "purple" },
  { id: "planner",   label: "Planner",   icon: ListTree,    tone: "purple" },
  { id: "executor",  label: "Executor",  icon: Cpu,         tone: "cyan" },
  { id: "memory",    label: "Memory",    icon: Database,    tone: "emerald" },
  { id: "critic",    label: "Critic",    icon: ShieldCheck, tone: "emerald" },
];

const TONE = {
  cyan:    { bg: "bg-primary/15",   border: "border-primary/40",   text: "text-primary",   glow: "shadow-[0_0_30px_-4px_hsl(var(--primary)/0.7)]" },
  purple:  { bg: "bg-secondary/15", border: "border-secondary/40", text: "text-secondary", glow: "shadow-[0_0_30px_-4px_hsl(var(--secondary)/0.7)]" },
  emerald: { bg: "bg-success/15",   border: "border-success/40",   text: "text-success",   glow: "shadow-[0_0_30px_-4px_hsl(var(--success)/0.7)]" },
};

export function AgentPipeline({ activeAgent, logs }: Props) {
  return (
    <div className="glass-strong rounded-3xl p-6 h-full flex flex-col">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-mono-os">Neural Loop</p>
          <h3 className="font-display text-lg font-semibold mt-0.5">Agent Pipeline</h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono-os text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-soft" />
          live
        </div>
      </header>

      {/* Pipeline strip */}
      <div className="relative grid grid-cols-6 gap-2 mb-5">
        {PIPELINE.map((a, i) => {
          const tone = TONE[a.tone];
          const isActive = activeAgent === a.id;
          const Icon = a.icon;
          return (
            <div key={a.id} className="flex flex-col items-center relative">
              <motion.div
                animate={{
                  scale: isActive ? 1.06 : 1,
                  borderColor: isActive ? undefined : "hsl(var(--border))",
                }}
                transition={{ duration: 0.4 }}
                className={`relative w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors
                  ${isActive ? `${tone.bg} ${tone.border} ${tone.glow}` : "bg-white/[0.02] border-border"}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? tone.text : "text-muted-foreground"}`} strokeWidth={1.5} />
                {isActive && (
                  <motion.span
                    layoutId="agent-active-ring"
                    className={`absolute inset-0 rounded-2xl border ${tone.border}`}
                    animate={{ scale: [1, 1.25, 1.5], opacity: [0.7, 0.2, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  />
                )}
              </motion.div>
              <span className={`mt-2 text-[10px] uppercase tracking-[0.16em] font-mono-os ${isActive ? tone.text : "text-muted-foreground"}`}>
                {a.label}
              </span>
              {i < PIPELINE.length - 1 && (
                <ChevronRight className="absolute -right-2 top-3.5 w-4 h-4 text-border" strokeWidth={1.5} />
              )}
            </div>
          );
        })}
      </div>

      {/* Log stream */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-[hsl(var(--surface))] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[hsl(var(--surface))] to-transparent z-10 pointer-events-none" />
        <div className="h-full overflow-y-auto scrollbar-hide pr-1 space-y-1.5">
          <AnimatePresence initial={false}>
            {logs.slice(-40).map((log) => {
              const tone = log.agent ? TONE[PIPELINE.find(p => p.id === log.agent)?.tone ?? "cyan"] : TONE.cyan;
              return (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-start gap-3 text-xs font-mono-os py-1.5 px-2 rounded-lg hover:bg-white/[0.02]"
                >
                  <span className="text-muted-foreground/60 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span className={`shrink-0 uppercase tracking-wider ${tone.text}`}>
                    {log.agent ?? "system"}
                  </span>
                  <span className="text-foreground/80 truncate">{log.title}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}