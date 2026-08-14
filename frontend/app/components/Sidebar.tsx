"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, Brain } from "lucide-react";

const NAV = [
  { icon: Home,            label: "Home",      href: "/" },
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Brain,           label: "Memory",    href: "/memory" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isLandingPage, setIsLandingPage] = useState(false);

  useEffect(() => {
    const checkLandingPage = () => {
      if (typeof document !== "undefined") {
        const el = document.querySelector('[data-landing-page="true"]');
        setIsLandingPage(!!el);
      }
    };

    checkLandingPage();
    const observer = new MutationObserver(checkLandingPage);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  if (isLandingPage) {
    return null;
  }

  return (
    <aside className="panel-sidebar">
      {/* Logo */}
      <div style={{ padding: "0 17px", marginBottom: 28 }} className="sidebar-tooltip-trigger">
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(139,92,246,0.1) 100%)",
            border: "1px solid rgba(0,212,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 19h20L12 2z" stroke="#00d4ff" strokeWidth="1.5" fill="none" />
              <path d="M12 8L7 17h10L12 8z" stroke="#00d4ff" strokeWidth="1" fill="rgba(0,212,255,0.1)" />
            </svg>
          </div>
          <div className="sidebar-tooltip" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "white", lineHeight: 1.2 }}>AURA OS</div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.2 }}>v2.1.0</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1 }}>
        {NAV.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`nav-item sidebar-tooltip-trigger ${isActive ? "active" : ""}`}>
              <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span className="sidebar-tooltip">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "16px 20px" }} className="sidebar-tooltip-trigger">
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(139,92,246,0.15))",
            border: "1px solid rgba(0,212,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-cyan)", boxShadow: "0 0 8px var(--accent-cyan)" }} />
          </div>
          <div className="sidebar-tooltip" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "white", lineHeight: 1.2 }}>OPERATOR</div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1.2 }}>AURA</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
