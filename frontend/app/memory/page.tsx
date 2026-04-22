"use client";

import React, { useState, useEffect } from "react";
import { 
  Brain, Database, Network, Search, Sparkles, 
  ShieldCheck, ChevronRight, Activity, Zap, 
  HardDrive, Globe, X
} from "lucide-react";

export default function MemoryPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [nodes, setNodes] = useState<{x: number, y: number, color: string, size: number}[]>([]);
  const [paths, setPaths] = useState<{from: number, to: number, d: string, color: string}[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Use a fixed viewBox coordinate system for the SVG to avoid percentage issues in paths
  const VB_WIDTH = 1000;
  const VB_HEIGHT = 800;

  useEffect(() => {
    setIsMounted(true);
    const newNodes = [...Array(35)].map((_, i) => ({
      x: 100 + Math.random() * (VB_WIDTH - 200),
      y: 100 + Math.random() * (VB_HEIGHT - 200),
      color: i % 3 === 0 ? "var(--accent-cyan)" : i % 3 === 1 ? "var(--accent-purple)" : "var(--accent-blue)",
      size: Math.random() * 6 + 4
    }));
    setNodes(newNodes);

    const newPaths = [...Array(25)].map((_, i) => {
      const fromIdx = Math.floor(Math.random() * newNodes.length);
      const toIdx = Math.floor(Math.random() * newNodes.length);
      const start = newNodes[fromIdx];
      const end = newNodes[toIdx];
      return {
        from: fromIdx,
        to: toIdx,
        d: `M ${start.x} ${start.y} Q ${VB_WIDTH/2} ${VB_HEIGHT/2} ${end.x} ${end.y}`,
        color: i % 2 === 0 ? "var(--accent-cyan)" : "var(--accent-purple)"
      };
    });
    setPaths(newPaths);
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden animate-fade-in bg-[#030508] p-6 gap-8">
      
      {/* ── Neural Bank Sidebar ── */}
      <aside className="w-[360px] h-full border border-white/10 rounded-[20px] flex flex-col bg-black/20 backdrop-blur-3xl z-40 overflow-hidden shadow-2xl">
        <div className="p-10 pb-6 space-y-4">
           <h3 className="text-[9px] font-black tracking-[0.4em] text-[var(--accent-purple)]">Knowledge Assets</h3>
           <h1 className="text-3xl font-extrabold text-white tracking-tight">Neural Bank</h1>
           <p className="text-[12px] text-white/50 font-bold leading-relaxed">Vectorized structures stored in semantic nodes.</p>
        </div>

        <div className="px-10 py-6">
           <div className="input-container !p-3 !bg-black/40 border-white/10">
              <Search className="w-5 h-5 text-[var(--text-muted)] ml-1" />
              <input placeholder="Search clusters..." className="bg-transparent border-none outline-none text-sm text-white placeholder-white/10 w-full ml-3" />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 px-10 pb-10 mt-4">
          {[
            { name: "Project Aura Specs", nodes: "1,240", type: "Internal", icon: HardDrive },
            { name: "User Preference Matrix", nodes: "842", type: "Behavioral", icon: Brain },
            { name: "Global AI Ethics", nodes: "4,200", type: "Research", icon: Globe },
            { name: "System Logic Buffer", nodes: "156", type: "Session", icon: Database },
          ].map((cluster, i) => (
            <div 
              key={i} 
              onClick={() => setSelectedNode(cluster.name)}
              className={`glass-card !p-6 cursor-pointer group transition-all duration-500 border-white/5 ${selectedNode === cluster.name ? 'border-[var(--accent-cyan)]/50 bg-[var(--accent-cyan)]/10' : 'hover:bg-white/[0.03]'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl transition-all border border-transparent ${selectedNode === cluster.name ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)]' : 'bg-white/5 text-[var(--text-muted)] group-hover:text-white'}`}>
                   <cluster.icon className="w-5 h-5" />
                </div>
                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">{cluster.type}</span>
              </div>
              <p className="text-base font-bold text-white mb-1 group-hover:text-[var(--accent-cyan)] transition-colors">{cluster.name}</p>
              <div className="flex items-center justify-between">
                 <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">{cluster.nodes} Nodes</p>
                 <ChevronRight className={`w-4 h-4 transition-all ${selectedNode === cluster.name ? 'opacity-100' : 'opacity-0'}`} />
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Neural Explorer Center ── */}
      <section className="flex-1 flex flex-col relative bg-[#030508] border border-white/5 rounded-[20px] overflow-hidden">
        
        {/* Background Depth */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
           <div className="absolute w-[800px] h-[800px] rounded-full border border-white animate-[orb-rotate_80s_linear_infinite]" />
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
           <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, var(--accent-cyan) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        {/* Top Metrics Banner */}
        <header className="p-10 flex items-center justify-center gap-24 z-20 animate-fade-in relative max-w-5xl mx-auto w-full">
          {[
            { l: "Nodes", v: "1.2M", i: Network, c: "var(--accent-cyan)" },
            { l: "Recall", v: "99%", i: Sparkles, c: "var(--accent-purple)" },
            { l: "Status", v: "Stable", i: ShieldCheck, c: "#10B981" },
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-8 group">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center group-hover:border-current transition-all" style={{ color: stat.c }}>
                <stat.i className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)]">{stat.l}</p>
                <p className="text-3xl font-extrabold tracking-tight text-white">{stat.v}</p>
              </div>
            </div>
          ))}
        </header>

        {/* Interactive Neural Graph (Fixed Coordinate System) */}
        <div className="flex-1 relative overflow-hidden group">
          <svg className="absolute inset-0 w-full h-full p-20 scale-[0.85]" viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}>
            <defs>
              <filter id="node-glow-scaled">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Connection Paths */}
            {isMounted && paths.map((path, i) => {
              const isActive = hoveredNode === path.from || hoveredNode === path.to;
              return (
                <path 
                  key={i}
                  d={path.d}
                  stroke={path.color}
                  strokeWidth={isActive ? "2" : "0.6"}
                  strokeOpacity={isActive ? "0.6" : "0.1"}
                  fill="none"
                  className="transition-all duration-500"
                />
              );
            })}

            {/* Neural Nodes */}
            {isMounted && nodes.map((node, i) => (
                <g 
                  key={i} 
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredNode(i)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <circle 
                    cx={node.x} 
                    cy={node.y} 
                    r={hoveredNode === i ? node.size * 1.5 : node.size} 
                    fill={node.color}
                    fillOpacity={hoveredNode === i ? "1" : "0.7"}
                    filter="url(#node-glow-scaled)"
                    className="transition-all duration-300"
                  />
                  <circle 
                    cx={node.x} 
                    cy={node.y} 
                    r="30" 
                    fill="transparent"
                  />
                </g>
            ))}
          </svg>

          {/* Interaction HUD */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 glass-card !py-4 !px-10 flex items-center gap-12 animate-fade-in border-white/10 z-30">
            <div className="flex items-center gap-4">
              <Zap className="w-5 h-5 text-[var(--accent-cyan)] animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/80">Neural Web Exploration</span>
            </div>
            <div className="flex gap-8">
               <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]" />
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Active</span>
               </div>
               <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent-purple)] shadow-[0_0_8px_var(--accent-purple)]" />
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Semantic</span>
               </div>
            </div>
          </div>
        </div>

        {/* Selected Cluster HUD */}
        {selectedNode && (
          <div className="absolute top-10 right-10 w-80 glass-card animate-fade-in border-white/10 z-50 !p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black text-[var(--accent-cyan)] m-0">Context</h3>
              <button onClick={() => setSelectedNode(null)} className="text-white/20 hover:text-white p-2 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Subject</p>
                <p className="text-xl font-bold text-white tracking-tight leading-tight">{selectedNode}</p>
              </div>
              <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-6">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Integrity</p>
                  <span className="text-lg font-bold text-[var(--accent-cyan)]">98.4%</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Nodes</p>
                  <span className="text-lg font-bold text-white">12k</span>
                </div>
              </div>
              <button className="btn-futuristic w-full justify-center group !py-4">
                <span className="group-hover:tracking-[0.2em] transition-all font-black">Recall Pattern</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
