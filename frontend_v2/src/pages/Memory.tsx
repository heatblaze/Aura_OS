import { motion } from "framer-motion";
import { Filter, Search } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";

const STATS = [
  { label: "Total Memories", value: "12,458",  sub: "Items"   },
  { label: "Connections",    value: "98,721",  sub: "Links"   },
  { label: "Clusters",       value: "128",     sub: "Active"  },
  { label: "Memory Usage",   value: "2.34 TB", sub: "Indexed" },
];

const RECENT = [
  { title: "Project Nexus",            type: "Insight",    time: "2m ago"  },
  { title: "Neural Pattern",           type: "Pattern",    time: "8m ago"  },
  { title: "User Preference",          type: "Preference", time: "15m ago" },
  { title: "System Event",             type: "Event",      time: "22m ago" },
];

export default function Memory() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader
        title="Memory"
        subtitle="Explore and interact with AURA's memory network."
        rightSlot={
          <div className="hidden md:flex items-center gap-2">
            <div className="glass rounded-xl flex items-center gap-2 px-3 py-2 w-56">
              <Search className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
              <input placeholder="Search memory…" className="bg-transparent outline-none text-xs flex-1" />
            </div>
            <button className="w-10 h-10 rounded-xl glass flex items-center justify-center text-muted-foreground"><Filter className="w-4 h-4" strokeWidth={1.5} /></button>
          </div>
        }
      />
      <div className="px-8 py-6 flex flex-col gap-6 pb-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-[0.26em] font-mono-os text-muted-foreground">{s.label}</p>
              <p className="font-display text-3xl mt-2 text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Network + details */}
        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 lg:col-span-8 glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] uppercase tracking-[0.28em] font-mono-os text-muted-foreground">Memory Network</p>
            </div>
            <MemoryNetwork />
            <div className="flex flex-wrap gap-4 mt-4 text-[11px] font-mono-os text-muted-foreground">
              <Legend color="hsl(var(--primary))"   label="High Importance" />
              <Legend color="hsl(var(--secondary))" label="Medium Importance" />
              <Legend color="hsl(330 90% 60%)"      label="Low Importance" />
            </div>
          </section>
          <section className="col-span-12 lg:col-span-4 glass rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] font-mono-os text-muted-foreground mb-4">Memory Details</p>
            <p className="font-display text-lg text-foreground">Core Insight</p>
            <p className="text-[11px] font-mono-os text-muted-foreground mb-4">ID: MEM-98273</p>
            <dl className="space-y-3 text-sm">
              <Detail k="Type"        v="Insight" />
              <Detail k="Date Created" v="May 12, 2025" />
              <Detail k="Connections" v="24" />
              <Detail k="Importance"  v={<span className="text-destructive">High</span>} />
              <Detail k="Status"      v={<span className="text-success">Indexed</span>} />
            </dl>
            <button className="mt-6 w-full h-11 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display text-sm hover:opacity-90 transition">Open Memory</button>
          </section>
        </div>

        {/* Recent memories */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-[0.28em] font-mono-os text-muted-foreground">Recent Memories</p>
            <button className="text-xs text-primary font-mono-os">View All</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {RECENT.map((r, i) => {
              const dotColor = i % 2 === 0 ? "hsl(var(--secondary))" : "hsl(var(--primary))";
              return (
                <motion.div key={r.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full border flex items-center justify-center" style={{ borderColor: dotColor, boxShadow: `0 0 10px ${dotColor}` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
                    </span>
                  </div>
                  <p className="text-sm font-display">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.type}</p>
                  <p className="text-[10px] font-mono-os text-muted-foreground mt-2">{r.time} »</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Memory activity */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-[0.28em] font-mono-os text-muted-foreground">Memory Activity</p>
            <button className="text-xs text-primary font-mono-os">View Analytics</button>
          </div>
          <div className="flex items-end gap-[3px] h-32">
            {[...Array(60)].map((_, i) => (
              <motion.span key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/70 via-secondary/70 to-secondary"
                initial={{ height: 0 }} animate={{ height: `${10 + ((i * 17) % 90)}%` }} transition={{ delay: i * 0.01 }} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-border/30 pb-2">
      <dt className="text-muted-foreground text-xs uppercase tracking-wider font-mono-os">{k}</dt>
      <dd className="text-foreground/90">{v}</dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: color }} />{label}</span>;
}

function MemoryNetwork() {
  // Pseudo-random but stable layout
  const seed = (n: number) => ((Math.sin(n) + 1) / 2);
  const nodes = Array.from({ length: 32 }, (_, i) => ({
    x: 10 + seed(i * 1.7) * 80,
    y: 10 + seed(i * 2.3 + 1) * 80,
    r: 1 + seed(i) * 2.5,
    color: i % 3 === 0 ? "hsl(var(--primary))" : i % 3 === 1 ? "hsl(var(--secondary))" : "hsl(330 90% 60%)",
  }));
  const center = { x: 50, y: 50 };
  return (
    <svg viewBox="0 0 100 100" className="w-full h-72">
      <defs>
        <radialGradient id="memCore">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={center.x} cy={center.y} r="20" fill="url(#memCore)" />
      {nodes.map((n, i) => (
        <line key={`l${i}`} x1={center.x} y1={center.y} x2={n.x} y2={n.y} stroke={n.color} strokeOpacity="0.25" strokeWidth="0.3" />
      ))}
      {nodes.map((n, i) => (
        <circle key={`n${i}`} cx={n.x} cy={n.y} r={n.r} fill={n.color}>
          <animate attributeName="opacity" values="0.4;1;0.4" dur={`${2 + (i % 5)}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <circle cx={center.x} cy={center.y} r="3" fill="hsl(var(--primary))" />
    </svg>
  );
}