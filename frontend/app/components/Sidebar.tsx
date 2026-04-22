"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal, Activity, Brain, Zap, Settings, Command } from "lucide-react";

const NAV_ITEMS = [
  { icon: Terminal, label: "Neural Link", href: "/" },
  { icon: Activity, label: "System Trace", href: "/dashboard" },
  { icon: Brain, label: "Cognitive Bank", href: "/memory" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="panel-sidebar">
      {/* OS Branding Core */}
      <div className="mb-16 relative group cursor-pointer">
        <div className="absolute inset-[-10px] bg-[var(--accent-cyan)] opacity-0 blur-xl group-hover:opacity-10 transition-opacity duration-700" />
        <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center relative z-10 group-hover:border-[var(--accent-cyan)]/30 transition-all duration-500">
          <Command className="w-6 h-6 text-[var(--accent-cyan)]" />
        </div>
      </div>

      {/* Primary Navigation */}
      <nav className="flex flex-col gap-10 w-full items-center">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-500 group ${
                isActive 
                  ? "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/20" 
                  : "text-[var(--text-muted)] hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className={`w-5.5 h-5.5 transition-all duration-500 group-hover:scale-110 ${isActive ? 'drop-shadow-[0_0_10px_var(--accent-cyan)]' : ''}`} />
              
              {/* Tooltip Overlay */}
              <div className="absolute left-full ml-6 px-4 py-2 bg-black/95 text-[10px] font-black uppercase tracking-[0.3em] text-white rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0 z-[200] border border-white/10 shadow-2xl whitespace-nowrap">
                {item.label}
              </div>

              {/* Active Indicator Bar */}
              {isActive && (
                <div className="absolute -left-[var(--sp-2)] w-1 h-8 bg-[var(--accent-cyan)] rounded-r-full shadow-[4px_0_12px_var(--accent-cyan)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="mt-auto flex flex-col items-center gap-10 pb-4">
        <button className="text-[var(--text-muted)] hover:text-white hover:bg-white/5 p-2.5 rounded-lg transition-all group">
          <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-700" />
        </button>
        <div className="flex flex-col items-center gap-3">
           <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] opacity-40 shadow-[0_0_8px_var(--accent-cyan)]" />
           <span className="text-[8px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] rotate-[-90deg] origin-center translate-y-[-10px] whitespace-nowrap">
            V4.2
           </span>
        </div>
      </div>
    </aside>
  );
}
