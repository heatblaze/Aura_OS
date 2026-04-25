"use client";

import React, { useState, useEffect } from "react";
import { Brain, Database, Network, Search, Sparkles, ShieldCheck, ChevronRight, Zap, HardDrive, Globe, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CLUSTERS = [
  { name: "Project Aura Specs",      nodes: "1,240", type: "Internal",   icon: HardDrive },
  { name: "User Preference Matrix",  nodes: "842",   type: "Behavioral", icon: Brain     },
  { name: "Global AI Ethics",        nodes: "4,200", type: "Research",   icon: Globe     },
  { name: "System Logic Buffer",     nodes: "156",   type: "Session",    icon: Database  },
];

const VB_W = 1000;
const VB_H = 800;

function generateGraph() {
  const nodes = Array.from({ length: 40 }, (_, i) => ({
    x: 100 + Math.random() * (VB_W - 200),
    y: 80 + Math.random() * (VB_H - 160),
    color: i % 3 === 0 ? "#00E5FF" : i % 3 === 1 ? "#A855F7" : "#4F8EFF",
    size: Math.random() * 5 + 4,
    dx: (Math.random() - 0.5) * 10,
    dy: (Math.random() - 0.5) * 10,
  }));
  const paths = Array.from({ length: 30 }, (_, i) => {
    const fi = Math.floor(Math.random() * nodes.length);
    const ti = Math.floor(Math.random() * nodes.length);
    const f = nodes[fi]; const t = nodes[ti];
    const mx = (f.x + t.x) / 2 + (Math.random() - 0.5) * 140;
    const my = (f.y + t.y) / 2 + (Math.random() - 0.5) * 140;
    return { from: fi, to: ti, d: `M ${f.x} ${f.y} Q ${mx} ${my} ${t.x} ${t.y}`, color: i % 2 === 0 ? "#00E5FF" : "#A855F7" };
  });
  return { nodes, paths };
}

export default function MemoryPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode]   = useState<number | null>(null);
  const [isMounted, setIsMounted]       = useState(false);
  const [graph, setGraph]               = useState<ReturnType<typeof generateGraph> | null>(null);

  useEffect(() => { setIsMounted(true); setGraph(generateGraph()); }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex overflow-hidden"
      style={{ height: "100%", padding: "12px 12px 12px 4px", gap: 14 }}
    >
      {/* ── Sidebar ── */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="flex-shrink-0 h-full flex flex-col overflow-hidden"
        style={{
          width: 310, borderRadius: 22,
          background: "linear-gradient(180deg, rgba(10,18,38,0.92) 0%, rgba(6,12,24,0.95) 100%)",
          border: "1px solid var(--border-card)",
          backdropFilter: "blur(40px) saturate(1.5)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ padding: "28px 24px 16px" }}>
          <h3 style={{ marginBottom: 8 }}>Knowledge Assets</h3>
          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", color: "white", marginBottom: 8 }}>Neural Bank</h2>
          <p className="text-[12px] text-white/40 leading-relaxed">Vectorized semantic memory structures.</p>
        </div>

        <div style={{ padding: "8px 20px 12px" }}>
          <div className="input-container" style={{ padding: 8 }}>
            <Search className="w-4 h-4 text-[var(--text-muted)] ml-1 flex-shrink-0" />
            <input placeholder="Search clusters..." className="bg-transparent border-none outline-none text-sm text-white placeholder-white/15 w-full ml-2.5" style={{ cursor: "text" }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {CLUSTERS.map((cluster, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ x: 4 }}
              onClick={() => setSelectedNode(cluster.name)}
              className="group"
              style={{
                padding: "18px 18px", borderRadius: 16, cursor: "pointer",
                background: selectedNode === cluster.name
                  ? "linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(0,150,200,0.04) 100%)"
                  : "linear-gradient(135deg, rgba(15,25,55,0.5) 0%, rgba(10,18,40,0.4) 100%)",
                border: `1px solid ${selectedNode === cluster.name ? "rgba(0,229,255,0.3)" : "var(--border-card)"}`,
                boxShadow: selectedNode === cluster.name
                  ? "0 0 20px rgba(0,229,255,0.1), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "inset 0 1px 0 rgba(255,255,255,0.04)",
                transition: "all 0.3s",
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <div
                  className="flex items-center justify-center rounded-xl transition-all"
                  style={{
                    width: 36, height: 36,
                    background: selectedNode === cluster.name ? "rgba(0,229,255,0.15)" : "rgba(255,255,255,0.05)",
                    border: selectedNode === cluster.name ? "1px solid rgba(0,229,255,0.25)" : "1px solid var(--border-card)",
                    color: selectedNode === cluster.name ? "var(--accent-cyan)" : "var(--text-muted)",
                  }}
                >
                  <cluster.icon className="w-4 h-4" />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-[var(--text-muted)]">{cluster.type}</span>
              </div>
              <p className="text-[13px] font-semibold text-white group-hover:text-[var(--accent-cyan)] transition-colors" style={{ marginBottom: 4 }}>{cluster.name}</p>
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-white/30 font-bold uppercase tracking-[0.2em]">{cluster.nodes} Nodes</p>
                <ChevronRight className="w-3.5 h-3.5 transition-all" style={{ color: "var(--accent-cyan)", opacity: selectedNode === cluster.name ? 1 : 0 }} />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.aside>

      {/* ── Graph Hero ── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.55, delay: 0.15 }}
        className="flex-1 flex flex-col relative overflow-hidden"
        style={{
          borderRadius: 22,
          background: "linear-gradient(135deg, rgba(4,8,18,0.98) 0%, rgba(2,5,12,0.99) 100%)",
          border: "1px solid var(--border-card)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04, backgroundImage: "radial-gradient(circle, #00E5FF 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 45%, rgba(0,120,200,0.08) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.7) 100%)" }} />

        {/* Top stats */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="relative z-10 flex items-center justify-center"
          style={{ gap: 48, padding: "24px 32px", borderBottom: "1px solid var(--border-card)" }}
        >
          {[
            { l: "Nodes", v: "1.2M", i: Network, c: "#00E5FF" },
            { l: "Recall", v: "99%", i: Sparkles, c: "#A855F7" },
            { l: "Status", v: "Stable", i: ShieldCheck, c: "#10B981" },
          ].map((stat, i) => (
            <motion.div key={i} className="flex items-center group" whileHover={{ scale: 1.04 }} style={{ gap: 14 }}>
              <div
                className="flex items-center justify-center rounded-xl transition-all"
                style={{
                  width: 44, height: 44, color: stat.c,
                  background: `${stat.c}10`, border: `1px solid ${stat.c}22`,
                  boxShadow: `0 0 16px ${stat.c}10`,
                }}
              >
                <stat.i className="w-[18px] h-[18px]" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-[var(--text-muted)]">{stat.l}</p>
                <p className="text-2xl font-semibold tracking-tight text-white">{stat.v}</p>
              </div>
            </motion.div>
          ))}
        </motion.header>

        {/* SVG Graph */}
        <div className="flex-1 relative overflow-hidden">
          {isMounted && graph && (
            <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${VB_W} ${VB_H}`}>
              <defs>
                <filter id="node-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              {graph.paths.map((path, i) => {
                const isActive = hoveredNode === path.from || hoveredNode === path.to;
                return (
                  <motion.path key={i} d={path.d} fill="none" stroke={path.color}
                    strokeWidth={isActive ? 2.5 : 0.8}
                    strokeOpacity={isActive ? 0.7 : 0.12}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ pathLength: { duration: 1.2 + i * 0.03, ease: "easeOut" } }}
                  />
                );
              })}
              {graph.nodes.map((node, i) => {
                const isHovered = hoveredNode === i;
                const isConnected = hoveredNode !== null && graph.paths.some(p => (p.from === hoveredNode && p.to === i) || (p.to === hoveredNode && p.from === i));
                const dimmed = hoveredNode !== null && !isHovered && !isConnected;
                return (
                  <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHoveredNode(i)} onMouseLeave={() => setHoveredNode(null)}>
                    <motion.circle
                      cx={node.x} cy={node.y}
                      r={isHovered ? node.size * 2 : isConnected ? node.size * 1.3 : node.size}
                      fill={node.color}
                      fillOpacity={dimmed ? 0.1 : isHovered ? 1 : 0.6}
                      filter="url(#node-glow)"
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                    <circle cx={node.x} cy={node.y} r={28} fill="transparent" />
                    {isHovered && (
                      <motion.circle cx={node.x} cy={node.y}
                        initial={{ r: node.size, opacity: 0.7 }}
                        animate={{ r: node.size * 4, opacity: 0 }}
                        transition={{ duration: 1.2, ease: "easeOut", repeat: Infinity }}
                        fill="none" stroke={node.color} strokeWidth={1.5}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          )}

          {/* Bottom HUD */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.5 }}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 glass-card z-30 flex items-center"
            style={{ padding: "10px 24px", gap: 24 }}
          >
            <div className="flex items-center" style={{ gap: 8 }}>
              <Zap className="w-4 h-4 text-[var(--accent-cyan)]" style={{ animation: "soft-pulse 2s infinite" }} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/65">Neural Web</span>
            </div>
            <div className="flex" style={{ gap: 16 }}>
              {[["#00E5FF", "Active"], ["#A855F7", "Semantic"]].map(([c, l]) => (
                <div key={l} className="flex items-center" style={{ gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}` }} />
                  <span className="text-[8px] font-bold text-white/35 uppercase tracking-widest">{l}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, scale: 0.94, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="absolute z-50"
              style={{
                top: 88, right: 20, width: 280,
                borderRadius: 20, padding: 24,
                background: "linear-gradient(135deg, rgba(10,18,38,0.96) 0%, rgba(6,12,26,0.97) 100%)",
                border: "1px solid var(--border-card)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,229,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
                backdropFilter: "blur(30px)",
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
                <h3 style={{ margin: 0 }}>Context</h3>
                <button onClick={() => setSelectedNode(null)} className="text-white/25 hover:text-white p-1.5 hover:bg-white/5 rounded-xl transition-all" style={{ cursor: "pointer" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[var(--text-muted)]" style={{ marginBottom: 6 }}>Subject</p>
                  <p className="text-lg font-semibold text-white leading-tight">{selectedNode}</p>
                </div>
                <div className="grid grid-cols-2" style={{ gap: 16, borderTop: "1px solid var(--border-card)", paddingTop: 14 }}>
                  <div><p className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]" style={{ marginBottom: 4 }}>Integrity</p><span className="text-lg font-semibold text-glow-cyan">98.4%</span></div>
                  <div><p className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]" style={{ marginBottom: 4 }}>Nodes</p><span className="text-lg font-semibold text-white">12k</span></div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="btn-futuristic w-full" style={{ cursor: "pointer" }}>
                  Recall Pattern
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}
