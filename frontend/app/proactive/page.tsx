"use client";

import { useState, useEffect } from "react";
import { Sparkles, Power, ArrowLeft, Clock, History, CheckCircle2, XCircle, Zap, Terminal, Activity } from "lucide-react";
import { AutoModeState, ProactiveSuggestion } from "@/lib/types";

export default function ProactivePage() {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    fetch("http://localhost:8000/proactive/status")
      .then(r => r.json())
      .then(data => setStatus(data))
      .catch(console.error);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden grid-bg text-[var(--text-primary)] relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[var(--accent-purple)] opacity-[0.12] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[var(--accent-cyan)] opacity-[0.12] rounded-full blur-[120px]" />
      </div>

      {/* ── Side Dock (Floating) ─────────────────────────── */}
      <aside className="w-[84px] flex-shrink-0 glass border-[rgba(255,255,255,0.08)] flex flex-col z-10 m-3 mr-0 rounded-[20px] shadow-2xl bg-[rgba(5,5,10,0.6)] items-center">
        <div className="flex items-center justify-center p-5 border-b border-[rgba(255,255,255,0.05)] w-full relative">
          <Zap className="w-6 h-6 text-white relative z-10" />
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col py-6 w-full gap-4 items-center scrollbar-hide">
          <nav className="flex flex-col gap-4">
            <a href="/" className="p-3.5 rounded-2xl transition-all text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.04)]"><Terminal className="w-5 h-5" /></a>
            <a href="/dashboard" className="p-3.5 rounded-2xl transition-all text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.04)]"><Activity className="w-5 h-5" /></a>
            <a href="/proactive" className="relative flex items-center justify-center p-3.5 rounded-2xl transition-all bg-[rgba(255,255,255,0.08)] text-[var(--accent-purple)] shadow-sm border border-[rgba(255,255,255,0.1)]"><Sparkles className="w-5 h-5 drop-shadow-[0_0_10px_rgba(192,132,252,0.5)]" /></a>
          </nav>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 z-10 m-3 glass rounded-[20px] shadow-2xl bg-[rgba(10,10,15,0.6)] border-[rgba(255,255,255,0.05)] relative overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-4xl mx-auto w-full space-y-10">
          <header className="flex items-end justify-between border-b border-[rgba(255,255,255,0.05)] pb-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-[var(--text-secondary)] text-transparent bg-clip-text">Initiative Engine</h2>
              <p className="text-[14px] text-[var(--text-secondary)] mt-1 font-light tracking-wide">Configure JARVIS autonomous behavior and proactive triggers</p>
            </div>
          </header>

          {status ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="glass bg-[rgba(255,255,255,0.01)] rounded-2xl p-8 border border-[rgba(255,255,255,0.03)] shadow-inner flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2.5">
                    <Power className="w-5 h-5 text-[var(--success)]" />
                    Engine Lifecycle
                  </h3>
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.2em] border transition-all ${status.auto_mode.enabled ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "bg-white/5 text-[var(--text-muted)] border-white/10"}`}>
                    {status.auto_mode.enabled ? "ACTIVE" : "STANDBY"}
                  </span>
                </div>
                
                <div className="flex-1 space-y-6">
                  <div className="p-5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
                    <p className="text-[13px] text-white/90 leading-relaxed font-light italic">
                      "{status.auto_mode.policy_description}"
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] flex items-center gap-2">
                       <div className="w-1 h-1 rounded-full bg-[var(--accent-purple)]" />
                       Active Perception Triggers
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {status.engine.triggers.map((t: string) => (
                        <div key={t} className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/5 group hover:bg-white/5 transition-all">
                           <span className="text-sm text-white/80 capitalize tracking-wide">{t.replace(/_/g, " ")}</span>
                           <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] group-hover:scale-125 transition-transform" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass bg-[rgba(255,255,255,0.01)] rounded-2xl p-8 border border-[rgba(255,255,255,0.03)] shadow-inner">
                 <h3 className="text-lg font-semibold text-white mb-8 flex items-center gap-2.5">
                   <History className="w-5 h-5 text-[var(--accent-cyan)]" />
                   Initiative Log
                 </h3>
                 <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                   <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                     <Clock className="w-5 h-5 text-white/20" />
                   </div>
                   <p className="text-xs text-white/30 uppercase tracking-[0.3em]">No recent triggers recorded</p>
                 </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 gap-3 text-[var(--text-muted)]">
              <div className="w-5 h-5 border-2 border-[var(--accent-cyan)] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm tracking-widest uppercase font-bold opacity-50">Synchronizing Engine State...</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
