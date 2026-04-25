"use client";

import React, { useState, useEffect } from "react";
import { Cpu, Database, Activity, Zap, ShieldCheck, Globe, Network, Brain, ChevronRight, Server, BarChart3, Terminal } from "lucide-react";
import { motion } from "framer-motion";
import { JarvisWebSocket } from "@/lib/websocket";

const STAGGER = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const ITEM = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export default function DashboardPage() {
  const [stats, setStats] = useState({ neural_load_pct: 24.2, vector_bank_nodes: 1400000, latency_ms: 28, directives_processed: 1400, uptime_str: "0d 0h 0m" });
  const [tools, setTools]   = useState<any[]>([]);
  const [agents, setAgents] = useState([
    { name: "Commander", role: "Strategy",   status: "Idle", color: "#00E5FF" },
    { name: "Planner",   role: "Logic",      status: "Idle", color: "#A855F7" },
    { name: "Executor",  role: "Sequence",   status: "Idle", color: "#4F8EFF" },
    { name: "Memory",    role: "Context",    status: "Idle", color: "#10B981" },
    { name: "Critic",    role: "Validation", status: "Idle", color: "#F59E0B" },
  ]);

  useEffect(() => {
    const f = async () => {
      try {
        const [sR, tR] = await Promise.all([fetch("http://localhost:8000/system/stats"), fetch("http://localhost:8000/tools")]);
        if (sR.ok) setStats(await sR.json());
        if (tR.ok) { const t = await tR.json(); setTools(t.tools); }
      } catch {}
    };
    f(); const iv = setInterval(f, 5000); return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const ws = new JarvisWebSocket("global");
    ws.connect().catch(() => {});
    ws.on("*", (e: any) => {
      if (e.type === "agent_thinking" || e.type === "pipeline_start")
        setAgents(p => p.map(a => a.name.toLowerCase() === (e.agent || "commander").toLowerCase() ? { ...a, status: "Thinking" } : { ...a, status: "Active" }));
      else if (e.type === "pipeline_complete" || e.type === "pipeline_error")
        setAgents(p => p.map(a => ({ ...a, status: "Idle" })));
    });
    return () => ws.disconnect();
  }, []);

  const toggleTool = async (name: string) => {
    try { const r = await fetch(`http://localhost:8000/tools/${name}/toggle`, { method: "POST" }); if (r.ok) { const d = await r.json(); setTools(p => p.map(t => t.name === name ? { ...t, enabled: d.enabled } : t)); } } catch {}
  };

  const getIcon = (n: string) => n.includes("WebSearch") ? Globe : n.includes("System") ? Terminal : n.includes("Memory") || n.includes("Knowledge") ? Brain : Network;

  const STATS = [
    { label: "Neural Load",  value: `${stats.neural_load_pct}%`,                      icon: Cpu,      color: "#00E5FF",  sub: "Dynamic Load" },
    { label: "Vector Bank",  value: `${(stats.vector_bank_nodes / 1000).toFixed(1)}k`, icon: Database, color: "#A855F7",  sub: "Active Nodes" },
    { label: "Latency",      value: `${stats.latency_ms}ms`,                           icon: Activity, color: "#10B981",  sub: "Internal Bus" },
    { label: "Directives",   value: `${stats.directives_processed}`,                   icon: Zap,      color: "#F59E0B",  sub: "Processed" },
  ];

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <motion.div variants={STAGGER} initial="hidden" animate="visible" className="content-constrained" style={{ padding: "32px 32px 48px" }}>

        {/* ── Header ── */}
        <motion.header variants={ITEM} className="flex items-center justify-between" style={{ marginBottom: 36, padding: "0 4px" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Diagnostics</h3>
            <h1 style={{ fontSize: 42 }}>Neural Control</h1>
          </div>
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="glass-card flex items-center"
            style={{ padding: "12px 22px", gap: 14 }}
          >
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.2)" }}
            >
              <Server className="w-4 h-4 text-[var(--accent-cyan)]" />
            </div>
            <div>
              <span className="block text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Uptime</span>
              <span className="block text-sm font-semibold text-white tracking-wider">{stats.uptime_str}</span>
            </div>
          </motion.div>
        </motion.header>

        {/* ── Stat Cards ── */}
        <motion.section variants={STAGGER} className="grid grid-cols-4" style={{ gap: 16, marginBottom: 36, padding: "0 4px" }}>
          {STATS.map((s, i) => (
            <motion.div
              key={i} variants={ITEM}
              whileHover={{ y: -5, scale: 1.015, transition: { duration: 0.25 } }}
              className="glass-card group cursor-default"
              style={{ padding: 22 }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
                <div
                  className="flex items-center justify-center rounded-xl transition-all"
                  style={{
                    width: 42, height: 42, color: s.color,
                    background: `${s.color}12`, border: `1px solid ${s.color}25`,
                    boxShadow: `0 0 16px ${s.color}12`,
                  }}
                >
                  <s.icon className="w-[18px] h-[18px]" />
                </div>
                {/* Live indicator dots */}
                <div style={{ display: "flex", gap: 3 }}>
                  {[0,1,2].map(j => (
                    <motion.div key={j}
                      style={{ width: 4, height: 4, borderRadius: "50%", background: s.color }}
                      animate={{ opacity: [0.15, 0.8, 0.15] }}
                      transition={{ duration: 1.8, delay: j * 0.35, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]" style={{ marginBottom: 4 }}>{s.label}</p>
              <p className="text-[26px] font-semibold tracking-tight text-white">{s.value}</p>
              <div style={{ borderTop: "1px solid var(--border-card)", marginTop: 14, paddingTop: 10 }}>
                <p className="text-[10px] text-[var(--text-secondary)] font-medium">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </motion.section>

        {/* ── Neural Cluster ── */}
        <motion.section variants={ITEM} style={{ marginBottom: 36, padding: "0 4px" }}>
          <div className="flex items-center" style={{ gap: 16, marginBottom: 18 }}>
            <h3 className="whitespace-nowrap">Neural Cluster</h3>
            <motion.div style={{ height: 1, flex: 1, background: "var(--border-card)" }} initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, delay: 0.3 }} />
          </div>
          <div className="grid grid-cols-5" style={{ gap: 14 }}>
            {agents.map((agent, i) => {
              const isActive = agent.status === "Active" || agent.status === "Thinking";
              return (
                <motion.div key={i} variants={ITEM} whileHover={{ scale: 1.04, y: -4 }} className="glass-card flex flex-col items-center text-center" style={{ padding: 22 }}>
                  <div className="relative" style={{ marginBottom: 14 }}>
                    {isActive && (
                      <motion.div
                        className="absolute rounded-full"
                        style={{ inset: -10, background: agent.color }}
                        animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.35, 0.15] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                    <div
                      className="flex items-center justify-center relative z-10"
                      style={{
                        width: 48, height: 48, borderRadius: "50%",
                        border: `1px solid ${agent.color}30`,
                        background: `${agent.color}08`,
                        transition: "all 0.3s",
                      }}
                    >
                      <ShieldCheck className="w-5 h-5" style={{ color: agent.color }} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-white" style={{ marginBottom: 2 }}>{agent.name}</p>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]" style={{ marginBottom: 12 }}>{agent.role}</p>
                  <div
                    className="flex items-center justify-center"
                    style={{
                      padding: "5px 14px", borderRadius: 20, minWidth: 80, gap: 6,
                      fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em",
                      background: isActive ? `${agent.color}15` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isActive ? agent.color + "35" : "var(--border-card)"}`,
                      color: isActive ? agent.color : "var(--text-muted)",
                      boxShadow: isActive ? `0 0 14px ${agent.color}20` : "none",
                      transition: "all 0.3s",
                    }}
                  >
                    {isActive && (
                      <motion.div
                        style={{ width: 5, height: 5, borderRadius: "50%", background: agent.color }}
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.7, repeat: Infinity }}
                      />
                    )}
                    {agent.status}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Bottom Section ── */}
        <motion.div variants={ITEM} className="grid grid-cols-2" style={{ gap: 24, padding: "0 4px" }}>
          {/* Protocol Manifest */}
          <section>
            <div className="flex items-center" style={{ gap: 14, marginBottom: 14 }}>
              <h3 className="whitespace-nowrap">Protocol Manifest</h3>
              <motion.div style={{ height: 1, flex: 1, background: "var(--border-card)" }} initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.4 }} />
            </div>
            <div className="glass-card" style={{ padding: 14 }}>
              {tools.map((tool, i) => {
                const Icon = getIcon(tool.name);
                return (
                  <motion.div key={i} whileHover={{ x: 4 }} onClick={() => toggleTool(tool.name)}
                    className="flex items-center justify-between rounded-xl transition-all group relative overflow-hidden"
                    style={{
                      padding: "14px 16px", cursor: "pointer",
                      borderBottom: i < tools.length - 1 ? "1px solid var(--border-card)" : "none",
                    }}
                  >
                    <div className="flex items-center" style={{ gap: 14 }}>
                      <div
                        className="flex items-center justify-center rounded-xl transition-all"
                        style={{
                          width: 38, height: 38,
                          background: tool.enabled !== false ? "rgba(0,229,255,0.08)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${tool.enabled !== false ? "rgba(0,229,255,0.15)" : "var(--border-card)"}`,
                          color: tool.enabled !== false ? "var(--accent-cyan)" : "var(--text-dim)",
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-[13px] font-semibold transition-colors ${tool.enabled !== false ? "text-white group-hover:text-[var(--accent-cyan)]" : "text-white/30"}`}>{tool.name}</p>
                        <p className="text-[9px] text-[var(--text-muted)] font-medium uppercase tracking-[0.1em]">{tool.description?.slice(0, 35)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center" style={{ gap: 10 }}>
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${tool.enabled !== false ? "text-[var(--accent-green)]" : "text-red-400/60"}`}>{tool.enabled !== false ? "Active" : "Off"}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-white/10 group-hover:text-[var(--accent-cyan)] transition-all" />
                    </div>
                  </motion.div>
                );
              })}
              {tools.length === 0 && <div className="text-center text-[var(--text-muted)] text-sm" style={{ padding: 28 }}>Loading manifest...</div>}
            </div>
          </section>

          {/* Neural Architectures */}
          <section>
            <div className="flex items-center" style={{ gap: 14, marginBottom: 14 }}>
              <h3 className="whitespace-nowrap">Neural Architectures</h3>
              <motion.div style={{ height: 1, flex: 1, background: "var(--border-card)" }} initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.5 }} />
            </div>
            <div className="glass-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                { l: "L 01", n: "Context Buffer",    d: "Ephemeral neural state control.",    c: "#00E5FF" },
                { l: "L 02", n: "Vector Store",      d: "High-dimensional memory mapping.",   c: "#A855F7" },
                { l: "L 03", n: "Heuristic Planner", d: "Predictive strategy generation.",    c: "#4F8EFF" },
              ].map((layer, i) => (
                <motion.div key={i} className="flex group" whileHover={{ x: 4 }} style={{ gap: 18, cursor: "default" }}>
                  <div className="relative flex-shrink-0" style={{ width: 3 }}>
                    <div className="absolute inset-0 rounded-full" style={{ background: "var(--border-card)" }} />
                    <motion.div
                      className="absolute top-0 left-0 w-full rounded-full"
                      style={{ background: layer.c, boxShadow: `0 0 8px ${layer.c}50` }}
                      initial={{ height: "25%" }}
                      whileHover={{ height: "100%" }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: layer.c, textShadow: `0 0 12px ${layer.c}40` }}>{layer.l}</span>
                      <BarChart3 className="w-4 h-4 opacity-15 group-hover:opacity-80 transition-all" style={{ color: layer.c }} />
                    </div>
                    <p className="text-lg font-semibold text-white tracking-tight" style={{ marginBottom: 3 }}>{layer.n}</p>
                    <p className="text-[12px] text-white/45 leading-relaxed">{layer.d}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </motion.div>
      </motion.div>
    </div>
  );
}
