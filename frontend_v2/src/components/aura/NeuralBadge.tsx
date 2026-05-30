import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: "cyan" | "purple" | "emerald";
  delay?: number;
  className?: string;
}

const ACCENT = {
  cyan:    { dot: "bg-primary",   ring: "shadow-[0_0_20px_-2px_hsl(var(--primary)/0.6)]" },
  purple:  { dot: "bg-secondary", ring: "shadow-[0_0_20px_-2px_hsl(var(--secondary)/0.6)]" },
  emerald: { dot: "bg-success",   ring: "shadow-[0_0_20px_-2px_hsl(var(--success)/0.6)]" },
};

export function NeuralBadge({ icon: Icon, label, value, accent = "cyan", delay = 0, className }: Props) {
  const a = ACCENT[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      className={`glass rounded-2xl px-4 py-3 flex items-center gap-3 min-w-[200px] ${className ?? ""}`}
    >
      <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 ${a.ring}`}>
        <Icon className="w-4 h-4 text-foreground/90" strokeWidth={1.5} />
        <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${a.dot} animate-pulse-soft`} />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono-os">{label}</span>
        <span className="text-sm font-display font-medium text-foreground">{value}</span>
      </div>
    </motion.div>
  );
}