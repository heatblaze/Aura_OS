"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, Brain, Shield, Wrench, Settings } from "lucide-react";

const NAV = [
  { icon: Home,            label: "Home",      href: "/" },
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Brain,           label: "Memory",    href: "/memory" },
  { icon: Shield,          label: "Protocols", href: "/protocols" },
  { icon: Wrench,          label: "Tools",     href: "/tools" },
  { icon: Settings,        label: "Settings",  href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="panel-sidebar">
      {/* Logo */}
      <div style={{ padding: "0 20px", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(139,92,246,0.1) 100%)",
            border: "1px solid rgba(0,212,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 19h20L12 2z" stroke="#00d4ff" strokeWidth="1.5" fill="none" />
              <path d="M12 8L7 17h10L12 8z" stroke="#00d4ff" strokeWidth="1" fill="rgba(0,212,255,0.1)" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white", letterSpacing: "-0.01em" }}>AURA OS</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>v2.1.0</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1 }}>
        {NAV.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${isActive ? "active" : ""}`}>
              <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(139,92,246,0.15))",
            border: "1px solid rgba(0,212,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-cyan)", boxShadow: "0 0 8px var(--accent-cyan)" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "white" }}>OPERATOR</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>AURA</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
