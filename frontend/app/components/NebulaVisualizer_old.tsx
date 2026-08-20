"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type VisualizerState = "idle" | "listening" | "thinking" | "speaking";

interface AuraOrbProps {
  state: VisualizerState;
  amplitude?: number;
  size?: number;
  coworker?: string;
}

const COWORKER_THEMES: Record<string, { color1: string; color2: string; color3: string }> = {
  "Jarvis": { color1: "#00d4ff", color2: "#8b5cf6", color3: "#3b82f6" },
  "Bobby":  { color1: "#8b5cf6", color2: "#ec4899", color3: "#f43f5e" }, // Energetic purple/pink
  "Tom":    { color1: "#cbd5e1", color2: "#ffffff", color3: "#475569" }, // Steely engineer silver/white/grey
  "Sarah":  { color1: "#10b981", color2: "#34d399", color3: "#3b82f6" }, // Warm organized green/blue
};

const STATE_CONFIG = {
  idle:      { glow: 0.18, speed: 0.008, waves: 5, amp: 0.12, ringSpeed: 25 },
  listening: { glow: 0.35, speed: 0.016, waves: 7, amp: 0.22, ringSpeed: 15 },
  thinking:  { glow: 0.28, speed: 0.025, waves: 8, amp: 0.15, ringSpeed: 8 },
  speaking:  { glow: 0.4,  speed: 0.02,  waves: 6, amp: 0.3,  ringSpeed: 12 },
} as const;

/* ══════════════════════════════════════════════
   CANVAS ORB — Dynamic energy waves inside sphere
   ══════════════════════════════════════════════ */
function EnergyCanvas({ size, state, amplitude, theme }: { size: number; state: VisualizerState; amplitude: number; theme: { color1: string; color2: string; color3: string } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const timeRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = size * dpr;
    const h = size * dpr;
    canvas.width = w;
    canvas.height = h;
    ctx.scale(dpr, dpr);

    const cfg = STATE_CONFIG[state];
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;
    timeRef.current += cfg.speed;
    const t = timeRef.current;

    ctx.clearRect(0, 0, size, size);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Background sphere gradient
    const bg = ctx.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy, r);
    bg.addColorStop(0, "rgba(20,40,80,0.4)");
    bg.addColorStop(0.6, "rgba(8,16,35,0.6)");
    bg.addColorStop(1, "rgba(4,8,18,0.8)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Draw flowing energy waves
    const waveCount = cfg.waves;
    const baseAmp = r * cfg.amp * (0.6 + amplitude * 0.6);

    for (let w = 0; w < waveCount; w++) {
      const phase = (w / waveCount) * Math.PI * 2;
      const yOffset = cy + (w - waveCount / 2) * (r * 0.15);
      const waveAmp = baseAmp * (0.5 + 0.5 * Math.sin(t * 2 + w));
      const freq = 3 + w * 0.5;

      ctx.beginPath();
      for (let x = cx - r; x <= cx + r; x += 1) {
        const nx = (x - (cx - r)) / (2 * r);
        const envelope = Math.sin(nx * Math.PI);
        const y = yOffset + Math.sin(nx * freq * Math.PI + t * 8 + phase) * waveAmp * envelope
                          + Math.sin(nx * freq * 1.7 * Math.PI + t * 5 + phase * 2) * waveAmp * 0.3 * envelope;
        if (x === cx - r) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const alpha = 0.15 + 0.1 * Math.sin(t * 3 + w);
      const grad = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
      grad.addColorStop(0, "transparent");
      grad.addColorStop(0.2, w % 2 === 0 ? theme.color1 : theme.color2);
      grad.addColorStop(0.5, theme.color3);
      grad.addColorStop(0.8, w % 2 === 0 ? theme.color2 : theme.color1);
      grad.addColorStop(1, "transparent");

      ctx.strokeStyle = grad;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.5 + Math.sin(t + w) * 0.5;
      ctx.stroke();
    }

    // Inner glow
    ctx.globalAlpha = 1;
    const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.6);
    innerGlow.addColorStop(0, `${theme.color1}30`);
    innerGlow.addColorStop(0.5, `${theme.color1}10`);
    innerGlow.addColorStop(1, "transparent");
    ctx.fillStyle = innerGlow;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();

    // Sphere edge highlight (outside clip)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `${theme.color1}25`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top specular
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 1.85);
    ctx.strokeStyle = `rgba(255,255,255,${0.06 + 0.03 * Math.sin(t * 2)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    frameRef.current = requestAnimationFrame(draw);
  }, [size, state, amplitude, theme]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none" }}
    />
  );
}

/* ── Orbital Ring ── */
function OrbitalRing({ size, radius, speed, color, tilt, width = 1 }: {
  size: number; radius: number; speed: number; color: string; tilt: number; width?: number;
}) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: `ring-rotate ${speed}s linear infinite`,
      transform: `rotateX(${tilt}deg) rotateY(15deg)`,
      transformStyle: "preserve-3d",
      pointerEvents: "none",
    }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`rg-${tilt}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="25%" stopColor={color} stopOpacity="0.6" />
            <stop offset="50%" stopColor={color} stopOpacity="0.15" />
            <stop offset="75%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <ellipse cx={size / 2} cy={size / 2} rx={radius} ry={radius * 0.35}
          fill="none" stroke={`url(#rg-${tilt})`} strokeWidth={width} />
      </svg>
    </div>
  );
}

/* ── Particle on orbit ── */
function OrbitParticle({ size, radius, speed, delay, color, particleSize = 3 }: {
  size: number; radius: number; speed: number; delay: number; color: string; particleSize?: number;
}) {
  return (
    <motion.div
      style={{
        position: "absolute", top: "50%", left: "50%",
        width: particleSize, height: particleSize, borderRadius: "50%",
        background: color, boxShadow: `0 0 ${particleSize * 3}px ${color}`,
        marginTop: -particleSize / 2, marginLeft: -particleSize / 2,
      }}
      animate={{
        x: [radius, 0, -radius, 0, radius],
        y: [0, radius * 0.35, 0, -radius * 0.35, 0],
        opacity: [0.8, 0.4, 0.8, 0.4, 0.8],
      }}
      transition={{ duration: speed, ease: "linear", repeat: Infinity, delay }}
    />
  );
}

/* ══════════════════════════════════════════════
   MAIN ORB COMPONENT
   ══════════════════════════════════════════════ */
export function AuraOrb({ state, amplitude = 0.5, size = 300, coworker = "Jarvis" }: AuraOrbProps) {
  const cfg = STATE_CONFIG[state];
  const theme = COWORKER_THEMES[coworker] || COWORKER_THEMES["Jarvis"];

  return (
    <div style={{ width: size, height: size, position: "relative" }} className="select-none">
      {/* Ambient glow */}
      <motion.div
        style={{
          position: "absolute", inset: -size * 0.4, borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.color1} 0%, ${theme.color2}40 30%, transparent 65%)`,
          filter: `blur(${size * 0.2}px)`, pointerEvents: "none",
        }}
        animate={{ opacity: [cfg.glow * 0.6, cfg.glow, cfg.glow * 0.6], scale: [1, 1.06, 1] }}
        transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Orbital rings */}
      <OrbitalRing size={size} radius={size * 0.52} speed={cfg.ringSpeed} color={theme.color1} tilt={65} width={1.2} />
      <OrbitalRing size={size} radius={size * 0.48} speed={cfg.ringSpeed * 1.4} color={theme.color2} tilt={72} width={0.8} />
      <OrbitalRing size={size} radius={size * 0.56} speed={cfg.ringSpeed * 0.7} color={`${theme.color1}60`} tilt={58} width={0.6} />

      {/* Orbit particles */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <OrbitParticle key={i} size={size} radius={size * (0.48 + (i % 3) * 0.04)}
          speed={cfg.ringSpeed * (0.8 + i * 0.15)} delay={i * 1.5} color={i % 2 === 0 ? theme.color1 : theme.color2}
          particleSize={2 + (i % 3)} />
      ))}

      {/* Canvas energy waves */}
      <EnergyCanvas size={size} state={state} amplitude={amplitude} theme={theme} />

      {/* Center nucleus */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <motion.div
          style={{
            width: 12, height: 12, borderRadius: "50%",
            background: "white",
            boxShadow: `0 0 16px 4px white, 0 0 40px 10px ${theme.color1}80, 0 0 80px 20px ${theme.color1}30`,
          }}
          animate={{
            scale: [1, 1.15, 1],
            boxShadow: [
              `0 0 16px 4px white, 0 0 40px 10px ${theme.color1}60, 0 0 80px 20px ${theme.color1}20`,
              `0 0 24px 8px white, 0 0 60px 16px ${theme.color1}90, 0 0 100px 30px ${theme.color1}40`,
              `0 0 16px 4px white, 0 0 40px 10px ${theme.color1}60, 0 0 80px 20px ${theme.color1}20`,
            ],
          }}
          transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
        />
      </div>

      {/* Ripples for active states */}
      <AnimatePresence>
        {(state === "listening" || state === "speaking") && [0, 0.8, 1.6].map((delay, i) => (
          <motion.div key={i} style={{
            position: "absolute", top: "50%", left: "50%", width: size * 0.4, height: size * 0.4,
            borderRadius: "50%", border: `1px solid ${theme.color1}`, x: "-50%", y: "-50%",
          }}
            initial={{ scale: 0.5, opacity: 0.6 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 2.4, ease: "easeOut", repeat: Infinity, delay }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export const NebulaVisualizer = AuraOrb;
