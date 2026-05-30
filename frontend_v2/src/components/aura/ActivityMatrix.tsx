import { motion, AnimatePresence } from "framer-motion";
import { Activity, Brain, Database, Zap, ShieldCheck, Network } from "lucide-react";

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  tone: "cyan" | "purple" | "emerald" | "amber";
  icon: keyof typeof ICON_MAP;
}

const ICON_MAP = { Activity, Brain, Database, Zap, ShieldCheck, Network };

const TONE = {
  cyan:    { text: "text-primary",   bg: "bg-primary/10",   border: "border-primary/25" },
  purple:  { text: "text-secondary", bg: "bg-secondary/10", border: "border-secondary/25" },
  emerald: { text: "text-success",   bg: "bg-success/10",   border: "border-success/25" },
  amber:   { text: "text-warning",   bg: "bg-warning/10",   border: "border-warning/25" },
};

export function ActivityMatrix({ items }: { items: ActivityItem[] }) {
  return (
    <div className="glass-strong rounded-3xl p-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-mono-os">Proactive Stream</p>
          <h3 className="font-display text-lg font-semibold mt-0.5">Recent Activity Matrix</h3>
        </div>
        <span className="text-xs font-mono-os text-muted-foreground">{items.length} events</span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <AnimatePresence initial={false}>
          {items.slice(0, 9).map((it, i) => {
            const Icon = ICON_MAP[it.icon];
            const t = TONE[it.tone];
            return (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.04, duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                whileHover={{ y: -2 }}
                className="glass rounded-2xl p-4 group cursor-default relative overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="h-full animate-shimmer" />
                </div>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${t.bg} ${t.border}`}>
                    <Icon className={`w-4 h-4 ${t.text}`} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-medium text-foreground leading-tight">{it.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{it.detail}</p>
                    <p className="text-[10px] font-mono-os text-muted-foreground/60 mt-2 uppercase tracking-wider">
                      {it.timestamp}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}