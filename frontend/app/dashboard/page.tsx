"use client";

import React, { useState, useEffect } from "react";
import { Activity, Brain, HardDrive, Clock, Cpu, Shield, BarChart3, Zap, ArrowRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") : "http://localhost:8000";

interface SystemStats {
  uptime_str: string;
  uptime_seconds: number;
  neural_load_pct: number;
  vector_bank_nodes: number;
  directives_processed: number;
  latency_ms: number;
  resources?: {
    cpu: number;
    ram: number;
    storage: number;
  };
  protocols?: Array<{ name: string; status: string; color: string }>;
  recent_logs?: Array<{ msg: string; time: string; color: string }>;
  cognitive_nodes?: Array<{ name: string; x: number; y: number; value: number; color: string }>;
  cognitive_connections?: Array<[number, number]>;
  performance_history?: Array<{ efficiency: number; load: number; latency: number; memory: number }>;
}

const PROTOCOLS = [
  { name: "Memory Consolidation", status: "Running", color: "#00d4ff" },
  { name: "Self Optimization",    status: "Running", color: "#8b5cf6" },
  { name: "Neural Calibration",   status: "Running", color: "#3b82f6" },
  { name: "Adaptive Learning",    status: "81%",     color: "#10b981" },
  { name: "Threat Detection",     status: "Monitoring", color: "#f59e0b" },
];

const DEFAULT_COGNITIVE_NODES = [
  { name: "Core Reasoning",       x: 50, y: 12, value: 88, color: "#00d4ff" },
  { name: "Short-Term Memory",    x: 18, y: 28, value: 72, color: "#8b5cf6" },
  { name: "Long-Term Memory",     x: 82, y: 28, value: 65, color: "#3b82f6" },
  { name: "Vector Knowledge",     x: 35, y: 42, value: 84, color: "#10b981" },
  { name: "Intent Analyzer",      x: 65, y: 42, value: 91, color: "#f59e0b" },
  { name: "Tool Registry",        x: 15, y: 58, value: 58, color: "#00d4ff" },
  { name: "Proactive Engine",     x: 85, y: 58, value: 76, color: "#8b5cf6" },
  { name: "Feedback Evaluator",   x: 50, y: 70, value: 62, color: "#3b82f6" },
  { name: "Speech Synthesizer",   x: 32, y: 82, value: 48, color: "#10b981" },
  { name: "Directives Compiler",  x: 68, y: 82, value: 78, color: "#f59e0b" },
  { name: "Experience Core",      x: 50, y: 48, value: 82, color: "#00d4ff" },
  { name: "Health Calibration",   x: 50, y: 30, value: 95, color: "#8b5cf6" },
];

const DEFAULT_COGNITIVE_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [0, 2], [0, 11], [1, 10], [2, 10], [3, 10], [4, 10], 
  [10, 7], [7, 8], [7, 9], [5, 0], [6, 4], [6, 2], [3, 1], [11, 10]
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
  const [showAllProtocols, setShowAllProtocols] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);

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

  // Dynamic values calculation
  const liveCpu = liveStats?.resources?.cpu ?? 68;
  const liveRam = liveStats?.resources?.ram ?? 74;
  const liveStorage = liveStats?.resources?.storage ?? 58;

  const displayedProtocols = liveStats?.protocols
    ? (showAllProtocols ? liveStats.protocols : liveStats.protocols.slice(0, 4))
    : PROTOCOLS;

  const displayedLogs = liveStats?.recent_logs
    ? (showAllLogs ? liveStats.recent_logs : liveStats.recent_logs.slice(0, 3))
    : LOGS;

  const buildPath = (key: "efficiency" | "load" | "latency" | "memory", minVal: number, maxVal: number) => {
    if (!liveStats || !liveStats.performance_history || liveStats.performance_history.length === 0) {
      if (key === "efficiency") return "M0,100 C50,95 100,80 150,70 C200,60 250,50 300,55 C350,60 400,45 450,40 L500,38";
      if (key === "load") return "M0,110 C50,100 100,90 150,85 C200,80 250,75 300,80 C350,85 400,70 450,65 L500,60";
      if (key === "latency") return "M0,120 C50,115 100,105 150,100 C200,90 250,80 300,85 C350,90 400,75 450,70 L500,68";
      return "M0,90 C50,85 100,75 150,80 C200,85 250,90 300,85 C350,80 400,75 450,78 L500,75";
    }

    const points = liveStats.performance_history;
    const width = 500;
    const minSvgY = 15;
    const maxSvgY = 125;
    const stepX = width / (points.length - 1);
    
    return points.map((p, idx) => {
      const x = idx * stepX;
      const val = p[key] ?? minVal;
      const pct = (val - minVal) / (maxVal - minVal);
      const y = maxSvgY - pct * (maxSvgY - minSvgY);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }} className="scrollbar-hide">
        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "white", letterSpacing: "-0.02em", marginBottom: 2 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>System overview and performance insights</p>
        </div>

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
              <svg width="100%" height="180" viewBox="0 0 100 90" style={{ overflow: "visible" }}>
                <defs>
                  <filter id="glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                {/* Connection lines */}
                {(liveStats?.cognitive_connections ?? DEFAULT_COGNITIVE_CONNECTIONS).map(([i, j], idx) => {
                  const nodes = liveStats?.cognitive_nodes ?? DEFAULT_COGNITIVE_NODES;
                  const n = nodes[i];
                  const m = nodes[j];
                  if (!n || !m) return null;
                  return (
                    <line key={idx} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="#00d4ff" strokeWidth="0.25" strokeOpacity="0.25" />
                  );
                })}
                {/* Nodes */}
                {(liveStats?.cognitive_nodes ?? DEFAULT_COGNITIVE_NODES).map((n, i) => {
                  const val = n.value ?? 80;
                  const rOuter = 2.2 + (val / 100) * 2.8;
                  return (
                    <g key={i}>
                      {/* Glow halo */}
                      <circle cx={n.x} cy={n.y} r={rOuter} fill={n.color} filter="url(#glow)" opacity={0.3 + (val / 300)} />
                      {/* Node core */}
                      <circle cx={n.x} cy={n.y} r="1.2" fill="#ffffff" />
                      {/* Name below node */}
                      <text x={n.x} y={n.y + 6} fill="white" fontSize="2.0" fontWeight="600" textAnchor="middle" opacity="0.8">
                        {n.name}
                      </text>
                      {/* Value above node */}
                      <text x={n.x} y={n.y - 3.5} fill={n.color} fontSize="1.8" fontWeight="700" textAnchor="middle" opacity="0.9">
                        {val}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Active Protocols */}
          <div className="glass-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="section-header" style={{ marginBottom: 0 }}>Active Protocols</div>
              <span style={{ fontSize: 11, color: "var(--accent-cyan)", fontWeight: 600 }}>
                {liveStats?.protocols ? `${liveStats.protocols.filter(p => p.status === "Active" || p.status === "Running" || p.status === "Online").length} Active` : "4 Running"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {displayedProtocols.map((p, i) => (
                <div key={i} className="protocol-item">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="protocol-dot" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{p.name}</span>
                  </div>
                  <span className="protocol-badge" style={{
                    background: p.status === "Running" || p.status === "Active" || p.status === "Online" ? `${p.color}15` : "rgba(255,255,255,0.05)",
                    color: p.status === "Running" || p.status === "Active" || p.status === "Online" ? p.color : "var(--text-muted)",
                    border: `1px solid ${p.status === "Running" || p.status === "Active" || p.status === "Online" ? `${p.color}30` : "var(--border)"}`,
                  }}>{p.status}</span>
                </div>
              ))}
              <div style={{ marginTop: 6 }}>
                <button 
                  onClick={() => setShowAllProtocols(!showAllProtocols)}
                  style={{ fontSize: 11, color: "var(--accent-cyan)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}
                >
                  {showAllProtocols ? "Show Less" : "View All"} <ArrowRight style={{ width: 12, height: 12, transform: showAllProtocols ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
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
                    strokeDasharray={`${(liveCpu / 100) * 176} 176`} strokeLinecap="round"
                    transform="rotate(-90 35 35)" />
                  <circle cx="35" cy="35" r="28" fill="none" stroke="#8b5cf6" strokeWidth="6"
                    strokeDasharray={`${(liveRam / 100 * 0.25) * 176} 176`} strokeLinecap="round"
                    transform="rotate(155 35 35)" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{Math.round(liveCpu)}%</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 6, height: 6, borderRadius: 2, background: "#00d4ff" }} /><span style={{ color: "var(--text-secondary)" }}>CPU · {liveCpu}%</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 6, height: 6, borderRadius: 2, background: "#8b5cf6" }} /><span style={{ color: "var(--text-secondary)" }}>Memory · {liveRam}%</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 6, height: 6, borderRadius: 2, background: "#10b981" }} /><span style={{ color: "var(--text-secondary)" }}>Storage · {liveStorage}%</span></div>
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
              <span 
                onClick={() => setShowAllLogs(!showAllLogs)}
                style={{ fontSize: 10, color: "var(--accent-cyan)", fontWeight: 600, cursor: "pointer", userSelect: "none" }}
              >
                {showAllLogs ? "Show Less" : "View All"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {displayedLogs.map((log, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < displayedLogs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
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
                  d={buildPath("efficiency", 60, 100)}
                  fill="none" stroke="#00d4ff" strokeWidth="2"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5 }}
                />
                {/* Neural Load line */}
                <motion.path
                  d={buildPath("load", 0, 100)}
                  fill="none" stroke="#8b5cf6" strokeWidth="2" strokeOpacity="0.7"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.2 }}
                />
                {/* Response Time line */}
                <motion.path
                  d={buildPath("latency", 10, 80)}
                  fill="none" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.5"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.4 }}
                />
                {/* Memory Usage line */}
                <motion.path
                  d={buildPath("memory", 50, 90)}
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
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>CPU {Math.round(liveCpu)}% · RAM {Math.round(liveRam)}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="footer-label">Operator</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "white" }}>AURA</span>
        </div>
      </div>
    </div>
  );
}
