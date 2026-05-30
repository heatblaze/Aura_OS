import { motion } from "framer-motion";
import { AppHeader } from "@/components/layout/AppHeader";

const KPIS = [
  { label: "Overall Efficiency", value: "82%", desc: "Excellent",  tone: "primary",   spark: [3,5,4,7,6,9,8,11,10,12] },
  { label: "Neural Load",        value: "62%", desc: "Moderate",   tone: "warning",   spark: [6,5,7,4,8,6,9,7,10,8] },
  { label: "Memory Usage",       value: "74%", desc: "Optimized",  tone: "success",   spark: [4,6,5,8,7,10,9,11,12,13] },
  { label: "Response Time",      value: "98%", desc: "Ultra Fast", tone: "secondary", spark: [10,8,12,9,11,13,12,14,13,15] },
] as const;

const PROTOCOLS = [
  { name: "Memory Consolidation", status: "Running" },
  { name: "Self Optimization",    status: "Running" },
  { name: "Neural Calibration",   status: "Running" },
  { name: "Threat Detection",     status: "Monitoring" },
];

const COGNITION = [
  { label: "Core Reasoning",        pct: 96 },
  { label: "Long Term Memory",      pct: 91 },
  { label: "Pattern Recognition",   pct: 88 },
  { label: "Adaptive Learning",     pct: 91 },
];

const LOGS = [
  { msg: "System optimized",     time: "2m ago" },
  { msg: "Memory indexed",       time: "5m ago" },
  { msg: "Protocol activated",   time: "11m ago" },
  { msg: "Neural sync completed", time: "20m ago" },
];

export default function Dashboard() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Dashboard" subtitle="System overview and performance insights." />
      <div className="px-8 py-6 flex flex-col gap-6 pb-10">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPIS.map((k, i) => (
            <motion.div key={k.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-[0.26em] font-mono-os text-muted-foreground">{k.label}</p>
              <p className={`font-display text-3xl mt-2 ${
                k.tone === "primary" ? "text-primary" :
                k.tone === "warning" ? "text-warning"  :
                k.tone === "success" ? "text-success"  : "text-secondary"
              }`}>{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.desc}</p>
              <Sparkline data={k.spark} tone={k.tone} />
            </motion.div>
          ))}
        </div>

        {/* Cognitive cluster + protocols */}
        <div className="grid grid-cols-12 gap-6">
          <Panel title="Cognitive Cluster" className="col-span-12 lg:col-span-7">
            <div className="flex items-center gap-6">
              <BrainCluster />
              <ul className="space-y-3 flex-1">
                {COGNITION.map((c) => (
                  <li key={c.label} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-secondary glow-purple" />
                    <span className="text-sm flex-1">{c.label}</span>
                    <span className="text-xs font-mono-os text-primary">{c.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 text-right">
              <button className="text-xs text-primary font-mono-os tracking-wider">View Details →</button>
            </div>
          </Panel>

          <Panel title="Active Protocols" right={<span className="text-xs font-mono-os text-primary">{PROTOCOLS.length} Running</span>} className="col-span-12 lg:col-span-5">
            <ul className="space-y-3">
              {PROTOCOLS.map((p) => (
                <li key={p.name} className="flex items-center justify-between glass rounded-xl px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft" />
                    </div>
                    <span className="text-sm">{p.name}</span>
                  </div>
                  <span className="text-[10px] font-mono-os tracking-wider text-success uppercase">{p.status}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-right">
              <button className="text-xs text-primary font-mono-os tracking-wider">View All →</button>
            </div>
          </Panel>
        </div>

        {/* Resource + uptime + logs */}
        <div className="grid grid-cols-12 gap-6">
          <Panel title="Resource Allocation" className="col-span-12 md:col-span-4">
            <Donut value={68} segments={[
              { label: "CPU",     value: 68, color: "hsl(var(--primary))" },
              { label: "Memory",  value: 74, color: "hsl(var(--secondary))" },
              { label: "Storage", value: 56, color: "hsl(var(--success))" },
              { label: "Network", value: 61, color: "hsl(var(--warning))" },
            ]} />
          </Panel>
          <Panel title="System Uptime" className="col-span-12 md:col-span-4">
            <p className="font-display text-3xl text-primary">7d 14h 32m</p>
            <p className="text-xs text-muted-foreground mb-4">Up and running</p>
            <div className="flex items-end gap-[3px] h-20">
              {[...Array(28)].map((_, i) => (
                <motion.span key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/60 to-secondary/80"
                  initial={{ height: 0 }} animate={{ height: `${20 + ((i * 13) % 70)}%` }} transition={{ delay: i * 0.02 }} />
              ))}
            </div>
          </Panel>
          <Panel title="Recent Logs" right={<button className="text-xs text-primary font-mono-os">View All</button>} className="col-span-12 md:col-span-4">
            <ul className="space-y-3">
              {LOGS.map((l) => (
                <li key={l.msg} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    <span className="text-foreground/90">{l.msg}</span>
                  </div>
                  <span className="text-[10px] font-mono-os text-muted-foreground">{l.time}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Performance chart */}
        <Panel title="Performance Over Time">
          <PerformanceChart />
          <div className="flex flex-wrap gap-4 mt-4 text-[11px] font-mono-os text-muted-foreground">
            <Legend color="hsl(var(--primary))"   label="Efficiency" />
            <Legend color="hsl(var(--secondary))" label="Neural Load" />
            <Legend color="hsl(330 90% 60%)"      label="Response Time" />
            <Legend color="hsl(var(--warning))"   label="Memory Usage" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children, className, right }: { title: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`glass rounded-2xl p-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-[0.28em] font-mono-os text-muted-foreground">{title}</p>
        {right}
      </div>
      {children}
    </motion.section>
  );
}

function Sparkline({ data, tone }: { data: readonly number[]; tone: string }) {
  const max = Math.max(...data);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (data.length - 1)) * 100} ${24 - (v / max) * 22}`).join(" ");
  const stroke = tone === "warning" ? "hsl(var(--warning))" : tone === "success" ? "hsl(var(--success))" : tone === "secondary" ? "hsl(var(--secondary))" : "hsl(var(--primary))";
  return <svg viewBox="0 0 100 24" className="w-full h-7 mt-2"><path d={path} stroke={stroke} strokeWidth="1.5" fill="none" /></svg>;
}

function BrainCluster() {
  const nodes = Array.from({ length: 28 }, (_, i) => ({
    x: 50 + Math.cos((i / 28) * Math.PI * 2) * (25 + (i % 4) * 6),
    y: 50 + Math.sin((i / 28) * Math.PI * 2) * (25 + (i % 3) * 5),
  }));
  return (
    <svg viewBox="0 0 100 100" className="w-40 h-40">
      <defs>
        <radialGradient id="brainCore">
          <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.8" />
          <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="30" fill="url(#brainCore)" />
      {nodes.map((n, i) => (
        <g key={i}>
          <line x1="50" y1="50" x2={n.x} y2={n.y} stroke="hsl(var(--secondary))" strokeOpacity="0.25" strokeWidth="0.4" />
          <circle cx={n.x} cy={n.y} r="1.2" fill="hsl(var(--primary))" />
        </g>
      ))}
      <circle cx="50" cy="50" r="3" fill="hsl(var(--primary))" />
    </svg>
  );
}

function Donut({ value, segments }: { value: number; segments: { label: string; value: number; color: string }[] }) {
  const r = 38, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" opacity="0.4" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`} />
      </svg>
      <div className="flex-1 space-y-2">
        <p className="font-display text-2xl text-primary">{value}%</p>
        <p className="text-[10px] font-mono-os text-muted-foreground tracking-wider">Allocated</p>
        <ul className="space-y-1 mt-2">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <span className="font-mono-os text-muted-foreground">{s.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PerformanceChart() {
  const series = [
    { color: "hsl(var(--primary))",   data: [3,4,3,5,4,6,5,7,6,8,7,9] },
    { color: "hsl(var(--secondary))", data: [5,4,6,5,7,6,8,7,8,9,8,10] },
    { color: "hsl(330 90% 60%)",      data: [2,3,2,4,3,5,4,6,5,7,6,8] },
    { color: "hsl(var(--warning))",   data: [4,5,4,6,5,7,6,8,7,9,8,10] },
  ];
  const max = 11;
  const path = (d: number[]) => d.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (d.length - 1)) * 100} ${100 - (v / max) * 90}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" className="w-full h-48">
      {[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth="0.3" />)}
      {series.map((s, i) => <path key={i} d={path(s.data)} stroke={s.color} strokeWidth="1.2" fill="none" />)}
    </svg>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: color }} />{label}</span>;
}