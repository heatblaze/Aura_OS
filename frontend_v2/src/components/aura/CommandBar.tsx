import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Mic, ArrowUp, Sparkles, Command } from "lucide-react";
import type { VisualizerState } from "./AuraOrb";

interface Props {
  state: VisualizerState;
  onSubmit: (msg: string) => void;
}

export function CommandBar({ state, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    setValue("");
  };

  const showWaves = listening || state === "listening" || state === "thinking";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="glass-strong rounded-2xl p-2 pl-4 flex items-center gap-3 group focus-within:border-primary/40 focus-within:shadow-[0_0_50px_-10px_hsl(var(--primary)/0.5)] transition-all">
        <Sparkles className="w-4 h-4 text-primary shrink-0" strokeWidth={1.5} />

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Issue a command to Aura…"
          className="flex-1 bg-transparent outline-none text-sm font-display placeholder:text-muted-foreground/60 py-2.5"
        />

        {/* Mini waveform — activates on listening */}
        <div className="hidden md:flex items-center gap-[3px] h-7 px-3">
          {[...Array(14)].map((_, i) => (
            <motion.span
              key={i}
              className="w-[2px] rounded-full bg-primary/70"
              animate={
                showWaves
                  ? { height: [4, 6 + ((i * 7) % 16), 10 + ((i * 5) % 8), 4] }
                  : { height: 3 }
              }
              transition={{ duration: 0.9, repeat: showWaves ? Infinity : 0, delay: i * 0.05, ease: "easeInOut" }}
              style={{ height: 4 }}
            />
          ))}
        </div>

        <button
          onClick={() => setListening((l) => !l)}
          className={`p-2 rounded-xl transition-all ${listening ? "bg-primary/20 text-primary glow-cyan" : "hover:bg-white/5 text-muted-foreground"}`}
          aria-label="Toggle voice input"
        >
          <Mic className="w-4 h-4" strokeWidth={1.5} />
        </button>

        <button
          onClick={submit}
          disabled={!value.trim()}
          className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 transition-transform"
          aria-label="Send command"
        >
          <ArrowUp className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] uppercase tracking-[0.2em] font-mono-os text-muted-foreground/70">
        <span className="flex items-center gap-1.5"><Command className="w-3 h-3" strokeWidth={1.5} /> + K to focus</span>
        <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
        <span>↵ to dispatch</span>
        <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
        <span>Aura · v2.0.4-neural</span>
      </div>
    </motion.div>
  );
}