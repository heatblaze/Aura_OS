"use client";

import React, { useMemo } from "react";

export type VisualizerState = "idle" | "listening" | "thinking" | "speaking";

interface NebulaVisualizerProps {
  state: VisualizerState;
  amplitude?: number; // 0 to 1
}

export function NebulaVisualizer({ state, amplitude = 0.5 }: NebulaVisualizerProps) {
  const config = useMemo(() => {
    switch (state) {
      case "listening":
        return { 
          glowColor: "var(--accent-cyan)",
          particleSpeed: "8s",
          ringOpacity: 0.6,
          pulseSpeed: "1.5s",
          scale: 1 + (amplitude * 0.1),
          brightness: "brightness(1.2)"
        };
      case "thinking":
        return { 
          glowColor: "var(--accent-purple)",
          particleSpeed: "4s",
          ringOpacity: 0.5,
          pulseSpeed: "0.8s",
          scale: 1.05,
          brightness: "brightness(1.1)"
        };
      case "speaking":
        return { 
          glowColor: "#fff",
          particleSpeed: "12s",
          ringOpacity: 0.7,
          pulseSpeed: "2s",
          scale: 1 + (amplitude * 0.2),
          brightness: "brightness(1.5)"
        };
      default: // idle
        return { 
          glowColor: "var(--accent-blue)",
          particleSpeed: "20s",
          ringOpacity: 0.3,
          pulseSpeed: "4s",
          scale: 1,
          brightness: "brightness(1)"
        };
    }
  }, [state, amplitude]);

  return (
    <div className="relative w-[380px] h-[380px] flex items-center justify-center select-none">
      
      {/* ── Background Pulsing Glow (Scaled Down) ── */}
      <div 
        className="absolute inset-0 rounded-full transition-all duration-1000"
        style={{ 
          background: `radial-gradient(circle, ${config.glowColor} 0%, transparent 70%)`,
          opacity: 0.2,
          transform: `scale(${config.scale * 1.2})`,
          filter: `blur(60px) ${config.brightness}`,
          animation: `pulse-glow ${config.pulseSpeed} ease-in-out infinite`
        }}
      />

      {/* ── Outer Orbital Particles (Smaller) ── */}
      <div 
        className="absolute inset-[-30px] animate-[orb-rotate_linear_infinite]"
        style={{ animationDuration: config.particleSpeed }}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              top: '50%',
              left: '50%',
              transform: `rotate(${i * 60}deg) translateY(-200px)`,
              background: config.glowColor,
              boxShadow: `0 0 15px 2px ${config.glowColor}`,
              opacity: 0.5
            }}
          />
        ))}
      </div>

      {/* ── Dynamic Concentric Rings (Lighter) ── */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Ring 1 */}
        <div 
          className="absolute inset-0 rounded-full border border-white/5 animate-[orb-rotate_30s_linear_infinite]"
          style={{ opacity: config.ringOpacity }}
        />
        {/* Ring 2 */}
        <div 
          className="absolute inset-[50px] rounded-full border border-white/5 animate-[orb-rotate_20s_linear_infinite_reverse]"
          style={{ opacity: config.ringOpacity * 0.8 }}
        />
        {/* Ring 3 */}
        <div 
          className="absolute inset-[100px] rounded-full p-[1px] animate-[orb-rotate_10s_linear_infinite]"
          style={{ 
            background: `conic-gradient(from 0deg, transparent, ${config.glowColor}, transparent)`,
            opacity: config.ringOpacity,
          }}
        >
          <div className="w-full h-full rounded-full bg-[var(--bg-primary)]" />
        </div>
      </div>

      {/* ── Central Neural Core ── */}
      <div className="relative z-10">
        {/* Inner Glow Core */}
        <div 
          className="w-24 h-24 rounded-full transition-all duration-300"
          style={{ 
            background: `radial-gradient(circle, ${config.glowColor} 0%, transparent 80%)`,
            opacity: 0.5,
            transform: `scale(${config.scale})`,
            boxShadow: `0 0 40px ${config.glowColor}30`,
            filter: config.brightness
          }}
        />
        
        {/* Central Point */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_20px_5px_#fff] flex items-center justify-center transition-all duration-500"
          style={{ transform: `scale(${config.scale})` }}
        >
          <div className="w-1 h-1 rounded-full bg-[var(--accent-cyan)]" />
        </div>
      </div>

      {/* ── State Indicator HUD (Smaller) ── */}
      <div className="absolute bottom-[-60px] flex flex-col items-center gap-3">
         <div className="h-[1px] w-20 bg-white/10" />
         <span className="text-[9px] font-black uppercase tracking-[0.6em] text-[var(--text-muted)]">
           Core: <span className="text-white transition-all duration-700" style={{ color: config.glowColor }}>{state}</span>
         </span>
      </div>
    </div>
  );
}
