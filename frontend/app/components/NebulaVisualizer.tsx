"use client";

import React, { useEffect, useRef } from "react";
import { motion, useAnimation, useMotionValue, useSpring, AnimatePresence } from "framer-motion";

export type VisualizerState = "idle" | "listening" | "thinking" | "speaking";

interface AuraOrbProps {
  state: VisualizerState;
  amplitude?: number; // 0–1
  size?: number; // diameter in px, default 360
}

/* ── State configuration ───────────────────── */
const STATE_CONFIG = {
  idle: {
    glowColor: "#00E5FF",
    glowOpacity: 0.22,
    pulseScale: [1, 1.05, 1],
    pulseDuration: 4.2,
    ring1Speed: 28,
    ring2Speed: 18,
    particleSpeed: 22,
    orbBrightness: 1,
    waveformAmplitude: 0.04,
    label: "IDLE",
  },
  listening: {
    glowColor: "#00E5FF",
    glowOpacity: 0.38,
    pulseScale: [1, 1.09, 1],
    pulseDuration: 1.8,
    ring1Speed: 20,
    ring2Speed: 12,
    particleSpeed: 14,
    orbBrightness: 1.3,
    waveformAmplitude: 0.14,
    label: "LISTENING",
  },
  thinking: {
    glowColor: "#8B5CF6",
    glowOpacity: 0.32,
    pulseScale: [1, 1.07, 1],
    pulseDuration: 1.0,
    ring1Speed: 10,
    ring2Speed: 6,
    particleSpeed: 7,
    orbBrightness: 1.15,
    waveformAmplitude: 0.08,
    label: "THINKING",
  },
  speaking: {
    glowColor: "#FFFFFF",
    glowOpacity: 0.28,
    pulseScale: [1, 1.12, 1],
    pulseDuration: 0.6,
    ring1Speed: 14,
    ring2Speed: 9,
    particleSpeed: 10,
    orbBrightness: 1.5,
    waveformAmplitude: 0.22,
    label: "SPEAKING",
  },
} as const;

/* ── Waveform SVG ring ──────────────────────── */
function WaveformRing({
  size,
  amplitude,
  color,
}: {
  size: number;
  amplitude: number;
  color: string;
}) {
  const radius = size * 0.46;
  const cx = size / 2;
  const cy = size / 2;
  const points = 120;

  const pathD = React.useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const wave = Math.sin(angle * 8) * amplitude * radius * 0.18;
      const r = radius + wave;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      pts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }
    pts.push("Z");
    return pts.join(" ");
  }, [amplitude, radius, cx, cy]);

  return (
    <svg
      width={size}
      height={size}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeOpacity={0.45}
        animate={{ pathLength: [0.95, 1, 0.95], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
      />
    </svg>
  );
}

/* ── Orbital particle ───────────────────────── */
function OrbitalParticle({
  index,
  total,
  orbitRadius,
  speed,
  color,
}: {
  index: number;
  total: number;
  orbitRadius: number;
  speed: number;
  color: string;
}) {
  const startAngle = (index / total) * 360;
  const size = 3 + (index % 3);

  return (
    <motion.div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 ${size * 4}px ${size}px ${color}`,
        marginTop: -size / 2,
        marginLeft: -size / 2,
        x: orbitRadius * Math.cos((startAngle * Math.PI) / 180),
        y: orbitRadius * Math.sin((startAngle * Math.PI) / 180),
        opacity: 0.6 + (index % 3) * 0.1,
      }}
      animate={{
        rotate: [startAngle, startAngle + 360],
      }}
      transition={{
        duration: speed,
        ease: "linear",
        repeat: Infinity,
        delay: (index / total) * -speed,
      }}
    />
  );
}

/* ── Ripple ring (listening state) ─────────── */
function RippleRing({
  size,
  color,
  delay,
}: {
  size: number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1px solid ${color}`,
        top: "50%",
        left: "50%",
        x: "-50%",
        y: "-50%",
      }}
      initial={{ scale: 0.6, opacity: 0.6 }}
      animate={{ scale: 2.2, opacity: 0 }}
      transition={{
        duration: 2.4,
        ease: "easeOut",
        repeat: Infinity,
        delay,
      }}
    />
  );
}

/* ══════════════════════════════════════════════
   AURA ORB — MAIN COMPONENT
══════════════════════════════════════════════ */
export function AuraOrb({ state, amplitude = 0.5, size = 360 }: AuraOrbProps) {
  const cfg = STATE_CONFIG[state];
  const PARTICLE_COUNT = 8;
  const ORBIT_RADIUS = size * 0.43;

  return (
    <div
      style={{ width: size, height: size, position: "relative" }}
      className="select-none flex items-center justify-center"
    >
      {/* ── Ambient radial glow (behind everything) ── */}
      <motion.div
        style={{
          position: "absolute",
          inset: -size * 0.3,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${cfg.glowColor} 0%, transparent 65%)`,
          filter: `blur(${size * 0.18}px)`,
          pointerEvents: "none",
        }}
        animate={{
          opacity: [cfg.glowOpacity * 0.7, cfg.glowOpacity, cfg.glowOpacity * 0.7],
          scale: cfg.pulseScale,
        }}
        transition={{
          duration: cfg.pulseDuration,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />

      {/* ── Ring 1: Slow breathing outer ring ── */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }}
        animate={{
          rotate: 360,
          scale: cfg.pulseScale,
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          rotate: { duration: cfg.ring1Speed, ease: "linear", repeat: Infinity },
          scale: { duration: cfg.pulseDuration, ease: "easeInOut", repeat: Infinity },
          opacity: { duration: cfg.pulseDuration, ease: "easeInOut", repeat: Infinity },
        }}
      />

      {/* ── Ring 2: Conic gradient rotating orbital ── */}
      <motion.div
        style={{
          position: "absolute",
          inset: size * 0.1,
          borderRadius: "50%",
          background: `conic-gradient(from 0deg, transparent 0deg, ${cfg.glowColor} 60deg, transparent 120deg)`,
          opacity: 0.35,
          pointerEvents: "none",
        }}
        animate={{ rotate: -360 }}
        transition={{
          duration: cfg.ring2Speed,
          ease: "linear",
          repeat: Infinity,
        }}
      />

      {/* ── Thin inner orbit ring ── */}
      <div
        style={{
          position: "absolute",
          inset: size * 0.14,
          borderRadius: "50%",
          border: `1px solid rgba(255,255,255,0.05)`,
          pointerEvents: "none",
        }}
      />

      {/* ── Waveform ring ── */}
      <WaveformRing
        size={size}
        amplitude={state === "speaking" ? amplitude : cfg.waveformAmplitude}
        color={cfg.glowColor}
      />

      {/* ── Orbital particles ── */}
      <div style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <OrbitalParticle
            key={i}
            index={i}
            total={PARTICLE_COUNT}
            orbitRadius={ORBIT_RADIUS}
            speed={cfg.particleSpeed + i * 1.2}
            color={cfg.glowColor}
          />
        ))}
      </div>

      {/* ── Ripple rings (listening / speaking only) ── */}
      <AnimatePresence>
        {(state === "listening" || state === "speaking") && (
          <>
            <RippleRing size={size * 0.5} color={cfg.glowColor} delay={0} />
            <RippleRing size={size * 0.5} color={cfg.glowColor} delay={0.9} />
            <RippleRing size={size * 0.5} color={cfg.glowColor} delay={1.8} />
          </>
        )}
      </AnimatePresence>

      {/* ── Nucleus — glowing core ── */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Core glow halo */}
        <motion.div
          style={{
            position: "absolute",
            width: size * 0.32,
            height: size * 0.32,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${cfg.glowColor}55 0%, ${cfg.glowColor}22 40%, transparent 70%)`,
            filter: `blur(${size * 0.03}px)`,
          }}
          animate={{
            scale: cfg.pulseScale,
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: cfg.pulseDuration,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />

        {/* Mid ring */}
        <div
          style={{
            position: "absolute",
            width: size * 0.22,
            height: size * 0.22,
            borderRadius: "50%",
            border: `1px solid ${cfg.glowColor}40`,
          }}
        />

        {/* White nucleus */}
        <motion.div
          style={{
            position: "absolute",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "white",
            boxShadow: `0 0 20px 6px white, 0 0 40px 12px ${cfg.glowColor}80`,
          }}
          animate={{
            scale: cfg.pulseScale,
            boxShadow: [
              `0 0 16px 5px white, 0 0 32px 10px ${cfg.glowColor}60`,
              `0 0 24px 8px white, 0 0 52px 16px ${cfg.glowColor}90`,
              `0 0 16px 5px white, 0 0 32px 10px ${cfg.glowColor}60`,
            ],
          }}
          transition={{
            duration: cfg.pulseDuration,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />

        {/* Inner cyan dot */}
        <div
          style={{
            position: "absolute",
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: cfg.glowColor,
            zIndex: 2,
          }}
        />
      </div>

      {/* ── State label ── */}
      <motion.div
        key={state}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{
          position: "absolute",
          top: -36,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5em",
            color: cfg.glowColor,
            opacity: 0.7,
          }}
        >
          {cfg.label}
        </span>
        <div
          style={{
            width: 40,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${cfg.glowColor}60, transparent)`,
          }}
        />
      </motion.div>
    </div>
  );
}

/* Re-export legacy name for compatibility */
export const NebulaVisualizer = AuraOrb;
