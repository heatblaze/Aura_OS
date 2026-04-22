"use client";

import React from "react";
import { 
  Cpu, Database, Activity, Zap, ShieldCheck, 
  Globe, Network, Brain, ChevronRight, 
  Server, BarChart3, Radio, Terminal
} from "lucide-react";

const SYSTEM_STATS = [
  { label: "Neural Load", value: "24.2%", icon: Cpu, color: "var(--accent-cyan)", sub: "Mistral v4.2" },
  { label: "Vector Bank", value: "1.2 GB", icon: Database, color: "var(--accent-purple)", sub: "1.4M Nodes" },
  { label: "Latency", value: "28ms", icon: Activity, color: "#10B981", sub: "Internal Bus" },
  { label: "Directives", value: "1.4k", icon: Zap, color: "#F59E0B", sub: "Processed" },
];

const AGENTS = [
  { name: "Commander", role: "Strategy", status: "Active", color: "var(--accent-cyan)" },
  { name: "Planner", role: "Logic", status: "Thinking", color: "var(--accent-purple)" },
  { name: "Executor", role: "Sequence", status: "Idle", color: "rgba(255,255,255,0.2)" },
  { name: "Memory", role: "Context", status: "Syncing", color: "#10B981" },
  { name: "Critic", role: "Validation", status: "Ready", color: "#F59E0B" },
];

export default function DashboardPage() {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="content-constrained p-12 space-y-20 animate-fade-in">
        
        {/* ── System Header (Scaled) ── */}
        <header className="flex items-end justify-between px-4">
          <div className="space-y-3">
            <h3 className="text-[10px] font-black tracking-[0.4em] text-[var(--accent-cyan)]">Diagnostics</h3>
            <h1 className="text-4xl font-extrabold tracking-tight text-white m-0">Neural Control</h1>
          </div>
          <div className="glass-card !py-3 !px-6 flex items-center gap-5 border-white/10 shadow-lg">
            <Server className="w-4.5 h-4.5 text-[var(--accent-cyan)]" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Uptime</span>
              <span className="text-xs font-bold text-white tracking-widest">42d 12h 04m</span>
            </div>
          </div>
        </header>

        {/* ── Top Stats (Smaller/Spaced) ── */}
        <section className="grid grid-cols-4 gap-6 px-4">
          {SYSTEM_STATS.map((stat, i) => (
            <div key={i} className="glass-card !p-6 group transition-all relative">
              <div className="flex items-center justify-between mb-8">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 group-hover:border-current transition-all" style={{ color: stat.color }}>
                  <stat.icon className="w-5.5 h-5.5" />
                </div>
                <div className="flex gap-1">
                   {[...Array(3)].map((_, j) => (
                     <div key={j} className="w-1 h-1 rounded-full bg-[var(--accent-cyan)] opacity-20" />
                   ))}
                </div>
              </div>
              <div className="space-y-1.5">
                 <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{stat.label}</p>
                 <p className="text-2xl font-bold tracking-tight text-white">{stat.value}</p>
                 <p className="text-[9px] font-bold text-[var(--text-secondary)] pt-3 border-t border-white/5 mt-3">{stat.sub}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── Cognitive Cluster (Reduced Size) ── */}
        <section className="space-y-10 py-6 px-4">
          <div className="flex items-center gap-8">
            <h3 className="whitespace-nowrap text-[9px]">Neural Cluster</h3>
            <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <div className="grid grid-cols-5 gap-8">
            {AGENTS.map((agent, i) => (
              <div key={i} className="glass-card !p-6 flex flex-col items-center text-center group hover:scale-[1.05] border-white/5">
                <div className="relative mb-6">
                   <div className="absolute inset-[-15px] blur-[20px] opacity-10 group-hover:opacity-40 transition-opacity" style={{ background: agent.color }} />
                   <div className="w-12 h-12 rounded-full border border-white/15 flex items-center justify-center relative z-10 bg-white/[0.03] group-hover:border-current transition-all" style={{ color: agent.color }}>
                      <ShieldCheck className="w-6 h-6" />
                   </div>
                </div>
                <p className="text-sm font-bold text-white mb-1">{agent.name}</p>
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4">{agent.role}</p>
                <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] transition-all ${
                  agent.status === 'Active' || agent.status === 'Thinking' 
                    ? 'bg-[var(--accent-cyan)]/15 border-[var(--accent-cyan)]/30 text-[var(--accent-cyan)]' 
                    : 'bg-white/5 border-white/10 text-[var(--text-muted)]'
                }`}>
                  {agent.status}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom Section (Scaled) ── */}
        <div className="grid grid-cols-2 gap-12 px-4">
          
          {/* Protocol Manifest */}
          <section className="space-y-8">
            <h3 className="text-[9px] px-2">Protocol Manifest</h3>
            <div className="glass-card !p-4 space-y-2 bg-white/[0.02] border-white/10">
              {[
                { name: "Semantic Bridge", type: "RAG / Vector", status: "Active", icon: Brain },
                { name: "Autonomous Shell", type: "Execution", status: "Secure", icon: Terminal },
                { name: "Live Intelligence", type: "Web Search", status: "Ready", icon: Globe },
                { name: "Distributed Tasking", type: "Process Engine", status: "Active", icon: Network },
              ].map((tool, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-white/[0.04] transition-all group cursor-pointer border border-transparent hover:border-white/5 relative">
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 rounded-r-full bg-[var(--accent-cyan)] transition-all group-hover:h-1/2`} />
                  <div className="flex items-center gap-5 pl-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:text-[var(--accent-cyan)] transition-all">
                      <tool.icon className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white mb-0.5 group-hover:text-[var(--accent-cyan)] transition-colors">{tool.name}</p>
                      <p className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">{tool.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 pr-3">
                     <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{tool.status}</span>
                     <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-[var(--accent-cyan)] transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Neural Architectures */}
          <section className="space-y-8">
            <h3 className="text-[9px] px-2">Neural Architectures</h3>
            <div className="glass-card !p-8 space-y-10 bg-white/[0.02] border-white/10">
              {[
                { l: "L 01", n: "Context Buffer", d: "Ephemeral neural state control.", c: "var(--accent-cyan)" },
                { l: "L 02", n: "Vector Store", d: "High-dimensional memory mapping.", c: "var(--accent-purple)" },
                { l: "L 03", n: "Heuristic Planner", d: "Predictive strategy generation.", c: "var(--accent-blue)" },
              ].map((layer, i) => (
                <div key={i} className="flex gap-8 group">
                  <div className="relative">
                     <div className="w-1.5 h-full rounded-full bg-white/10 transition-colors" />
                     <div className="absolute top-0 w-1.5 h-1/4 rounded-full transition-all duration-1000 group-hover:h-full" style={{ background: layer.c }} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: layer.c }}>{layer.l}</span>
                      <BarChart3 className="w-4.5 h-4.5 opacity-20 group-hover:opacity-100 transition-all" />
                    </div>
                    <p className="text-lg font-bold text-white tracking-tight">{layer.n}</p>
                    <p className="text-[12px] text-white/60 leading-relaxed font-medium">{layer.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
