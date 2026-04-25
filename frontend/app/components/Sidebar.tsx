"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal, Activity, Brain, Settings, Command } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ITEMS = [
  { icon: Terminal, label: "Neural Link",    href: "/"          },
  { icon: Activity, label: "System Trace",   href: "/dashboard" },
  { icon: Brain,    label: "Cognitive Bank", href: "/memory"    },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="panel-sidebar">
      {/* ── Logo ── */}
      <motion.div
        whileHover={{ scale: 1.08 }}
        transition={{ type: "spring", stiffness: 350, damping: 15 }}
        style={{ marginBottom: 48, cursor: "pointer", position: "relative" }}
      >
        {/* Ambient glow behind logo on hover */}
        <motion.div
          style={{
            position: "absolute", inset: -16, borderRadius: 20,
            background: "radial-gradient(circle, rgba(0,229,255,0.2) 0%, transparent 70%)",
            filter: "blur(14px)",
          }}
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        <div
          className="flex items-center justify-center relative z-10"
          style={{
            width: 46, height: 46, borderRadius: 14,
            background: "linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(10,18,40,0.6) 100%)",
            border: "1px solid rgba(0,229,255,0.2)",
            boxShadow: "0 0 20px rgba(0,229,255,0.1), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <Command className="w-5 h-5 text-[var(--accent-cyan)]" style={{ filter: "drop-shadow(0 0 6px rgba(0,229,255,0.5))" }} />
        </div>
      </motion.div>

      {/* ── Navigation ── */}
      <nav className="flex flex-col items-center w-full" style={{ gap: 8 }}>
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} style={{ cursor: "pointer", position: "relative" }}>
              {/* Active left indicator bar */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    style={{
                      position: "absolute", left: -16, top: "50%",
                      width: 3, height: 24, borderRadius: 4,
                      background: "var(--accent-cyan)",
                      boxShadow: "4px 0 16px rgba(0,229,255,0.5), 0 0 8px rgba(0,229,255,0.7)",
                      transform: "translateY(-50%)",
                    }}
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    exit={{ scaleY: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
              </AnimatePresence>

              <motion.div
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="flex items-center justify-center group"
                style={{
                  width: 46, height: 46, borderRadius: 14, position: "relative",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(0,229,255,0.12) 0%, rgba(0,150,200,0.06) 100%)"
                    : "transparent",
                  border: isActive ? "1px solid rgba(0,229,255,0.25)" : "1px solid transparent",
                  boxShadow: isActive ? "0 0 24px rgba(0,229,255,0.12), inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
                  color: isActive ? "var(--accent-cyan)" : "var(--text-muted)",
                  transition: "background 0.3s, border 0.3s, color 0.3s, box-shadow 0.3s",
                }}
              >
                <item.icon
                  className="w-[19px] h-[19px]"
                  style={{
                    filter: isActive ? "drop-shadow(0 0 8px rgba(0,229,255,0.7))" : "none",
                    transition: "filter 0.3s",
                  }}
                />

                {/* Tooltip */}
                <div
                  className="pointer-events-none whitespace-nowrap"
                  style={{
                    position: "absolute", left: "calc(100% + 20px)",
                    padding: "7px 14px", borderRadius: 10,
                    background: "linear-gradient(135deg, rgba(10,18,40,0.97) 0%, rgba(6,12,26,0.98) 100%)",
                    border: "1px solid var(--border-card)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,229,255,0.05)",
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.25em",
                    color: "white", zIndex: 999,
                    opacity: 0, transform: "translateX(-8px)",
                    transition: "opacity 0.2s, transform 0.2s",
                  }}
                >
                  {item.label}
                </div>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="mt-auto flex flex-col items-center" style={{ gap: 20, paddingBottom: 8 }}>
        <motion.button
          whileHover={{ scale: 1.12, rotate: 90 }}
          transition={{ type: "spring", stiffness: 300, damping: 12 }}
          style={{
            padding: 10, borderRadius: 12, cursor: "pointer",
            background: "transparent", border: "none",
            color: "var(--text-muted)",
          }}
          className="hover:text-white hover:bg-white/5 transition-colors"
        >
          <Settings className="w-[18px] h-[18px]" />
        </motion.button>

        <div className="flex flex-col items-center" style={{ gap: 8 }}>
          <motion.div
            style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "var(--accent-cyan)",
              boxShadow: "0 0 8px var(--accent-cyan), 0 0 20px rgba(0,229,255,0.3)",
            }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <span
            style={{
              fontSize: 7, fontWeight: 700, letterSpacing: "0.4em",
              textTransform: "uppercase", color: "var(--text-dim)",
              writingMode: "vertical-lr", transform: "rotate(180deg)",
            }}
          >
            v5.0
          </span>
        </div>
      </div>
    </aside>
  );
}
