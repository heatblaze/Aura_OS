"use client";

import React, { useState, useEffect } from "react";
import { Activity, Brain, HardDrive, Clock, Cpu, Shield, BarChart3, Zap, ArrowRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = "http://localhost:8000";

interface SystemStats {
  uptime_str: string;
  uptime_seconds: number;
  neural_load_pct: number;
  vector_bank_nodes: number;
  directives_processed: number;
  latency_ms: number;
}


const PROTOCOLS = [
  { name: "Memory Consolidation", status: "Running", color: "#00d4ff" },
  { name: "Self Optimization",    status: "Running", color: "#8b5cf6" },
  { name: "Neural Calibration",   status: "Running", color: "#3b82f6" },
  { name: "Adaptive Learning",    status: "81%",     color: "#10b981" },
  { name: "Threat Detection",     status: "Monitoring", color: "#f59e0b" },
];

const CLUSTER_NODES = [
  { name: "Core Reasoning",       x: 35, y: 30 },
  { name: "Long-Term Memory",     x: 65, y: 25 },
  { name: "Pattern Recognition",  x: 50, y: 55 },
  { name: "Adaptive Learning",    x: 25, y: 65 },
];

const LOGS = [
  { msg: "System optimized", time: "2m ago", color: "#00d4ff" },
  { msg: "Memory indexed",   time: "1m ago", color: "#8b5cf6" },
  { msg: "Protocol activated", time: "1m ago", color: "#10b981" },
  { msg: "Neurallink completed", time: "30m ago", color: "#3b82f6" },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [liveStats, setLiveStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    setMounted(true);
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/stats`);
        if (res.ok) setLiveStats(await res.json());
      } catch { /* Backend offline, use placeholders */ }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: "Overall Efficiency", value: liveStats ? `${100 - Math.round(liveStats.neural_load_pct * 0.3)}` : "82",  unit: "%", sub: "Excellent",  color: "#00d4ff" },
    { label: "Neural Load",        value: liveStats ? `${Math.round(liveStats.neural_load_pct)}` : "62",              unit: "%", sub: "Moderate",   color: "#8b5cf6" },
    { label: "Vector Nodes",       value: liveStats ? `${liveStats.vector_bank_nodes}` : "—",                         unit: "",  sub: "Indexed",   color: "#3b82f6" },
    { label: "Latency",            value: liveStats ? `${liveStats.latency_ms}` : "—",                                unit: "ms",sub: "Ultra Fast", color: "#10b981" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 28px 14px", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.02em", marginBottom: 2 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>System overview and performance insights</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[Activity, Brain, Cpu].map((Icon, i) => (
            <button key={i} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}>
              <Icon style={{ width: 15, height: 15 }} />
            </button>
          ))}
        </div>
      </header>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 20px" }} className="scrollbar-hide">

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {stats.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}<span style={{ fontSize: 16, color: "var(--text-secondary)" }}>{s.unit}</span></div>
              <div className="stat-sub" style={{ color: s.color }}>{s.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Cognitive Cluster + Active Protocols */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>

          {/* Cognitive Cluster */}
          <div className="glass-card" style={{ minHeight: 220 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="section-header" style={{ marginBottom: 0 }}>Cognitive Cluster</div>
              <ArrowUpRight style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
            </div>
            {mounted && (
              <svg width="100%" height="160" viewBox="0 0 100 80" style={{ overflow: "visible" }}>
                <defs>
                  <filter id="glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                {/* Connection lines */}
                {CLUSTER_NODES.map((n, i) =>
                  CLUSTER_NODES.slice(i + 1).map((m, j) => (
                    <line key={`${i}-${j}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="#00d4ff" strokeWidth="0.3" strokeOpacity="0.3" />
                  ))
                )}
                {/* Nodes */}
                {CLUSTER_NODES.map((n, i) => (
                  <g key={i}>
                    <circle cx={n.x} cy={n.y} r="4" fill={i % 2 === 0 ? "#00d4ff" : "#8b5cf6"} filter="url(#glow)" opacity="0.8" />
                    <text x={n.x} y={n.y + 10} fill="white" fontSize="3.5" fontWeight="500" textAnchor="middle" opacity="0.6">{n.name}</text>
                  </g>
                ))}
                {/* Extra decorative nodes */}
                {[{x:15,y:45},{x:80,y:50},{x:50,y:15},{x:75,y:70},{x:30,y:75}].map((p, i) => (
                  <circle key={`d${i}`} cx={p.x} cy={p.y} r="1.5" fill={i % 3 === 0 ? "#00d4ff" : "#8b5cf6"} opacity="0.4" />
                ))}
              </svg>
            )}
          </div>

          {/* Active Protocols */}
          <div className="glass-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="section-header" style={{ marginBottom: 0 }}>Active Protocols</div>
              <span style={{ fontSize: 11, color: "var(--accent-cyan)", fontWeight: 600 }}>4 Running</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {PROTOCOLS.map((p, i) => (
                <div key={i} className="protocol-item">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="protocol-dot" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{p.name}</span>
                  </div>
                  <span className="protocol-badge" style={{
                    background: p.status === "Running" ? `${p.color}15` : "rgba(255,255,255,0.05)",
                    color: p.status === "Running" ? p.color : "var(--text-muted)",
                    border: `1px solid ${p.status === "Running" ? `${p.color}30` : "var(--border)"}`,
                  }}>{p.status}</span>
                </div>
              ))}
              <div style={{ marginTop: 6 }}>
                <button style={{ fontSize: 11, color: "var(--accent-cyan)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                  View All <ArrowRight style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Resource Allocation + System Uptime + Recent Logs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>

          {/* Resource Allocation */}
          <div className="glass-card">
            <div className="section-header">Resource Allocation</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Donut chart */}
              <div style={{ position: "relative", width: 70, height: 70, flexShrink: 0 }}>
                <svg width="70" height="70" viewBox="0 0 70 70">
                  <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <circle cx="35" cy="35" r="28" fill="none" stroke="#00d4ff" strokeWidth="6"
                    strokeDasharray={`${0.68 * 176} ${176}`} strokeLinecap="round"
                    transform="rotate(-90 35 35)" />
                  <circle cx="35" cy="35" r="28" fill="none" stroke="#8b5cf6" strokeWidth="6"
                    strokeDasharray={`${0.18 * 176} ${176}`} strokeLinecap="round"
                    transform="rotate(155 35 35)" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "white" }}>68%</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 6, height: 6, borderRadius: 2, background: "#00d4ff" }} /><span style={{ color: "var(--text-secondary)" }}>CPU · 68%</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 6, height: 6, borderRadius: 2, background: "#8b5cf6" }} /><span style={{ color: "var(--text-secondary)" }}>Memory · 74%</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 6, height: 6, borderRadius: 2, background: "#10b981" }} /><span style={{ color: "var(--text-secondary)" }}>Storage · 58%</span></div>
              </div>
            </div>
          </div>

          {/* System Uptime */}
          <div className="glass-card">
            <div className="section-header">System Uptime</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "white", marginBottom: 4, letterSpacing: "-0.02em" }}>
              {liveStats?.uptime_str ?? "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>Up and running</div>
            <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 40 }}>
              {Array.from({ length: 14 }).map((_, i) => {
                const h = 10 + Math.random() * 28;
                return <div key={i} style={{ flex: 1, height: h, borderRadius: 2, background: `linear-gradient(180deg, var(--accent-cyan), var(--accent-purple))`, opacity: 0.4 + Math.random() * 0.4 }} />;
              })}
            </div>
          </div>

          {/* Recent Logs */}
          <div className="glass-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="section-header" style={{ marginBottom: 0 }}>Recent Logs</div>
              <span style={{ fontSize: 10, color: "var(--accent-cyan)", fontWeight: 600, cursor: "pointer" }}>View All</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {LOGS.map((log, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < LOGS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: log.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1 }}>{log.msg}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Over Time */}
        <div className="glass-card" style={{ marginBottom: 16 }}>
          <div className="section-header">Performance Over Time</div>
          <div style={{ height: 140 }}>
            {mounted && (
              <svg width="100%" height="140" viewBox="0 0 500 140" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 35, 70, 105, 140].map(y => (
                  <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                ))}
                {/* Efficiency line */}
                <motion.path
                  d="M0,100 C50,95 100,80 150,70 C200,60 250,50 300,55 C350,60 400,45 450,40 L500,38"
                  fill="none" stroke="#00d4ff" strokeWidth="2"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5 }}
                />
                {/* Neural Load line */}
                <motion.path
                  d="M0,110 C50,100 100,90 150,85 C200,80 250,75 300,80 C350,85 400,70 450,65 L500,60"
                  fill="none" stroke="#8b5cf6" strokeWidth="2" strokeOpacity="0.7"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.2 }}
                />
                {/* Response Time line */}
                <motion.path
                  d="M0,120 C50,115 100,105 150,100 C200,90 250,80 300,85 C350,90 400,75 450,70 L500,68"
                  fill="none" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.5"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.4 }}
                />
                {/* Memory Usage line */}
                <motion.path
                  d="M0,90 C50,85 100,75 150,80 C200,85 250,90 300,85 C350,80 400,75 450,78 L500,75"
                  fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.4"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.6 }}
                />
              </svg>
            )}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
            {[{ l: "Efficiency", c: "#00d4ff" }, { l: "Neural Load", c: "#8b5cf6" }, { l: "Response Time", c: "#10b981" }, { l: "Memory Usage", c: "#f59e0b" }].map(item => (
              <div key={item.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 3, borderRadius: 2, background: item.c }} />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="system-footer" style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="footer-label">System Status</span>
            <span className="footer-value">Optimal</span>
          </div>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>CPU 18% · RAM 32%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="footer-label">Operator</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "white" }}>AURA</span>
        </div>
      </div>
    </div>
  );
}
