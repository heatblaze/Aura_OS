import { Home, LayoutDashboard, Brain, ShieldCheck, Wrench, Settings as SettingsIcon } from "lucide-react";
import { motion } from "framer-motion";
import { NavLink } from "@/components/NavLink";

const ITEMS = [
  { to: "/",          label: "Home",      icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/memory",    label: "Memory",    icon: Brain },
  { to: "/protocols", label: "Protocols", icon: ShieldCheck },
  { to: "/tools",     label: "Tools",     icon: Wrench },
  { to: "/settings",  label: "Settings",  icon: SettingsIcon },
];

export function AppSidebar() {
  return (
    <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-border/40 bg-background/40 backdrop-blur-xl px-4 py-6">
      {/* Brand */}
      <div className="flex flex-col items-center gap-2 pb-8">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }}
          className="relative w-12 h-12 flex items-center justify-center"
        >
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
          <svg viewBox="0 0 24 24" className="relative w-10 h-10" fill="none" stroke="hsl(190 100% 65%)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px hsl(190 100% 60% / 0.7))" }}>
            <path d="M12 3 L4 20 L12 16 L20 20 Z" />
            <path d="M12 3 L12 16" opacity="0.9" />
          </svg>
        </motion.div>
        <p className="font-display text-sm tracking-[0.32em] text-foreground/95">AURA OS</p>
        <p className="text-[10px] font-mono-os text-muted-foreground tracking-[0.2em]">v2.1.0</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1.5 flex-1">
        {ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-colors border border-transparent"
            activeClassName="!text-primary !bg-primary/10 !border-primary/30 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.6)]"
          >
            <it.icon className="w-4 h-4" strokeWidth={1.5} />
            <span className="font-display tracking-wide">{it.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* System status */}
      <div className="mt-6 glass rounded-xl p-3 space-y-2">
        <p className="text-[9px] uppercase tracking-[0.24em] font-mono-os text-muted-foreground">System Status</p>
        <p className="text-success text-sm font-display">Optimal</p>
        <Sparkline />
        <div className="flex justify-between text-[9px] font-mono-os text-muted-foreground tracking-wider">
          <span>CPU 18%</span><span>RAM 32%</span>
        </div>
      </div>

      {/* Operator chip */}
      <div className="mt-4 glass rounded-xl p-3 flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[10px] font-bold text-primary-foreground">AU</div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
        </div>
        <div className="leading-tight">
          <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground font-mono-os">Operator</p>
          <p className="text-sm font-display text-foreground">AURA</p>
        </div>
      </div>
    </aside>
  );
}

function Sparkline() {
  const pts = [4, 7, 5, 9, 6, 11, 8, 12, 9, 14, 11, 15];
  const max = Math.max(...pts);
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * 100} ${24 - (v / max) * 22}`).join(" ");
  return (
    <svg viewBox="0 0 100 24" className="w-full h-6">
      <defs>
        <linearGradient id="spark" x1="0" x2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--secondary))" />
        </linearGradient>
      </defs>
      <path d={path} stroke="url(#spark)" strokeWidth="1.5" fill="none" />
    </svg>
  );
}