import { Search, Bell } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}

export function AppHeader({ title, subtitle, rightSlot }: Props) {
  return (
    <header className="flex items-center justify-between px-8 py-6 border-b border-border/30">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="font-display text-2xl text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </motion.div>
      <div className="flex items-center gap-3">
        {rightSlot}
        <button className="w-10 h-10 rounded-xl glass flex items-center justify-center text-muted-foreground hover:text-foreground transition" aria-label="Search">
          <Search className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button className="w-10 h-10 rounded-xl glass flex items-center justify-center text-muted-foreground hover:text-foreground transition relative" aria-label="Notifications">
          <Bell className="w-4 h-4" strokeWidth={1.5} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-secondary animate-pulse-soft" />
        </button>
        <div className="relative w-10 h-10 rounded-full border border-primary/50 flex items-center justify-center bg-background/60 glow-cyan">
          <span className="absolute inset-1 rounded-full bg-primary/20 blur-md" />
          <span className="relative w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] animate-pulse-soft" />
        </div>
      </div>
    </header>
  );
}