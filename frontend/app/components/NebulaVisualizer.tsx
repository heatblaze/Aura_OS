"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type VisualizerState = "idle" | "listening" | "thinking" | "speaking";

interface AuraOrbProps {
  state: VisualizerState;
  amplitude?: number;
  size?: number;
  width?: number;
  coworker?: string;
}

// Coworker Theme Definitions (RGB for smooth canvas interpolation)
interface RGB { r: number; g: number; b: number; hex: string; }

const COWORKER_THEMES: Record<string, { primary: RGB; secondary: RGB; tertiary: RGB }> = {
  "Jarvis": {
    primary:   { r: 0,   g: 212, b: 255, hex: "#00d4ff" }, // Cyan
    secondary: { r: 139, g: 92,  b: 246, hex: "#8b5cf6" }, // Purple
    tertiary:  { r: 59,  g: 130, b: 246, hex: "#3b82f6" }, // Blue
  },
  "Bobby": {
    primary:   { r: 139, g: 92,  b: 246, hex: "#8b5cf6" }, // Purple
    secondary: { r: 236, g: 72,  b: 153, hex: "#ec4899" }, // Pink
    tertiary:  { r: 244, g: 63,  b: 94,  hex: "#f43f5e" }, // Rose
  },
  "Claire": {
    primary:   { r: 203, g: 213, b: 225, hex: "#cbd5e1" }, // Slate
    secondary: { r: 255, g: 255, b: 255, hex: "#ffffff" }, // White
    tertiary:  { r: 71,  g: 85,  b: 105, hex: "#475569" }, // Grey
  },
  "Sarah": {
    primary:   { r: 16,  g: 185, b: 129, hex: "#10b981" }, // Green
    secondary: { r: 52,  g: 211, b: 153, hex: "#34d399" }, // Mint
    tertiary:  { r: 59,  g: 130, b: 246, hex: "#3b82f6" }, // Blue
  },
  "Elena": {
    primary:   { r: 244, g: 63,  b: 94,  hex: "#f43f5e" }, // Rose
    secondary: { r: 249, g: 115, b: 22,  hex: "#f97316" }, // Orange
    tertiary:  { r: 168, g: 85,  b: 247, hex: "#a855f7" }, // Violet
  },
  "Marcus": {
    primary:   { r: 251, g: 191, b: 36,  hex: "#fbbf24" }, // Gold
    secondary: { r: 16,  g: 185, b: 129, hex: "#10b981" }, // Emerald
    tertiary:  { r: 20,  g: 184, b: 166, hex: "#14b8a6" }, // Teal
  },
  "Lex": {
    primary:   { r: 79,  g: 70,  b: 229, hex: "#4f46e5" }, // Indigo
    secondary: { r: 225, g: 29,  b: 72,  hex: "#e11d48" }, // Crimson
    tertiary:  { r: 30,  g: 41,  b: 59,  hex: "#1e293b" }, // Dark Slate
  },
  "Mia": {
    primary:   { r: 20,  g: 184, b: 166, hex: "#14b8a6" }, // Teal
    secondary: { r: 52,  g: 211, b: 153, hex: "#34d399" }, // Mint
    tertiary:  { r: 6,   g: 182, b: 212, hex: "#06b6d4" }, // Cyan
  },
};

// ── 3D Brain Core Nodes ──
interface BrainNode3D {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  baseNeuronCount: number;
}

const BRAIN_NODES: BrainNode3D[] = [
  { id: "prefrontal", label: "PREFRONTAL", x: -42, y: -25, z: 20,  baseNeuronCount: 280 },
  { id: "motor",      label: "MOTOR",      x: -10, y: -48, z: -10, baseNeuronCount: 250 },
  { id: "sensory",    label: "SENSORY",    x: 18,  y: -44, z: -15, baseNeuronCount: 220 },
  { id: "concept",    label: "CONCEPT",    x: 38,  y: -15, z: 15,  baseNeuronCount: 110 },
  { id: "hippocampus",label: "MEMORY CORE",x: 0,   y: 0,   z: 0,   baseNeuronCount: 160 },
  { id: "language",   label: "LANGUAGE",   x: -28, y: 5,   z: 15,  baseNeuronCount: 320 },
  { id: "feature",    label: "FEATURES",   x: 22,  y: 18,  z: -12, baseNeuronCount: 180 },
  { id: "cerebellum", label: "CEREBELLUM", x: 36,  y: 38,  z: -25, baseNeuronCount: 250 },
  { id: "brainstem",  label: "BRAINSTEM",  x: 0,   y: 58,  z: 0,   baseNeuronCount: 140 },
];

// Neural connections
const NEURAL_LINKS: { source: string; target: string }[] = [
  { source: "prefrontal", target: "language" },
  { source: "prefrontal", target: "motor" },
  { source: "motor",      target: "sensory" },
  { source: "sensory",    target: "concept" },
  { source: "concept",    target: "hippocampus" },
  { source: "language",   target: "hippocampus" },
  { source: "hippocampus",target: "feature" },
  { source: "feature",    target: "cerebellum" },
  { source: "cerebellum", target: "brainstem" },
  { source: "hippocampus",target: "brainstem" },
  { source: "prefrontal", target: "hippocampus" },
];

// 3D Point Particle definition
interface Particle3D {
  x: number;
  y: number;
  z: number;
  colorOffset: number;
  pulsePhase: number;
  pulseSpeed: number;
  color: RGB; // Store the assigned regional color
  activeColor?: RGB; // Smoothly transitioning active color
}

// 3D Branch / Dendrite definition
interface Branch3D {
  mid: { x: number; y: number; z: number };
  tip1: { x: number; y: number; z: number };
  tip2: { x: number; y: number; z: number };
  tip1a: { x: number; y: number; z: number };
  tip1b: { x: number; y: number; z: number };
  tip2a: { x: number; y: number; z: number };
  tip2b: { x: number; y: number; z: number };
}

// Generate branches for nodes extending outwards from center
const generateNodeBranches = (nodes: BrainNode3D[]): Record<string, Branch3D[]> => {
  const branches: Record<string, Branch3D[]> = {};
  for (const node of nodes) {
    if (node.id === "hippocampus") continue;
    
    // Outward vector
    const len = Math.sqrt(node.x * node.x + node.y * node.y + node.z * node.z) || 1;
    const dx = node.x / len;
    const dy = node.y / len;
    const dz = node.z / len;
    
    const nodeBranches: Branch3D[] = [];
    // 16 branches per outer node to make it extremely dense and rich
    const numBranches = 16;
    for (let b = 0; b < numBranches; b++) {
      // Fan out angles from -0.9 to +0.9 radians
      let angle = -0.9 + (b / (numBranches - 1)) * 1.8;
      angle += (Math.random() - 0.5) * 0.06;
      
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      
      const bx = dx * cosA - dy * sinA;
      const by = dx * sinA + dy * cosA;
      const bz = dz + (Math.random() - 0.5) * 0.35; // wider 3D dispersion
      
      // Segment 1: Trunk (Node to Mid)
      const d1 = 6 + Math.random() * 8;
      const mid = {
        x: bx * d1,
        y: by * d1,
        z: bz * d1
      };
      
      // Segment 2: First Split (Mid to Tip1 and Tip2)
      const splitAngle1 = 0.25 + Math.random() * 0.15;
      const t1x = bx * Math.cos(splitAngle1) - by * Math.sin(splitAngle1);
      const t1y = bx * Math.sin(splitAngle1) + by * Math.cos(splitAngle1);
      const t2x = bx * Math.cos(-splitAngle1) - by * Math.sin(-splitAngle1);
      const t2y = bx * Math.sin(-splitAngle1) + by * Math.cos(-splitAngle1);
      
      const d2 = 5 + Math.random() * 5;
      const tip1 = {
        x: mid.x + t1x * d2,
        y: mid.y + t1y * d2,
        z: mid.z + bz * d2
      };
      const tip2 = {
        x: mid.x + t2x * d2,
        y: mid.y + t2y * d2,
        z: mid.z + bz * d2
      };
      
      // Segment 3: Second Split (Tip1 -> Tip1a/b, Tip2 -> Tip2a/b)
      const splitAngle2 = 0.35 + Math.random() * 0.15;
      
      // Directions for Tip1 splitting
      const t1ax = t1x * Math.cos(splitAngle2) - t1y * Math.sin(splitAngle2);
      const t1ay = t1x * Math.sin(splitAngle2) + t1y * Math.cos(splitAngle2);
      const t1bx = t1x * Math.cos(-splitAngle2) - t1y * Math.sin(-splitAngle2);
      const t1by = t1x * Math.sin(-splitAngle2) + t1y * Math.cos(-splitAngle2);
      
      // Directions for Tip2 splitting
      const t2ax = t2x * Math.cos(splitAngle2) - t2y * Math.sin(splitAngle2);
      const t2ay = t2x * Math.sin(splitAngle2) + t2y * Math.cos(splitAngle2);
      const t2bx = t2x * Math.cos(-splitAngle2) - t2y * Math.sin(-splitAngle2);
      const t2by = t2x * Math.sin(-splitAngle2) + t2y * Math.cos(-splitAngle2);
      
      const d3 = 4 + Math.random() * 4;
      const tip1a = {
        x: tip1.x + t1ax * d3,
        y: tip1.y + t1ay * d3,
        z: tip1.z + bz * d3
      };
      const tip1b = {
        x: tip1.x + t1bx * d3,
        y: tip1.y + t1by * d3,
        z: tip1.z + bz * d3
      };
      const tip2a = {
        x: tip2.x + t2ax * d3,
        y: tip2.y + t2ay * d3,
        z: tip2.z + bz * d3
      };
      const tip2b = {
        x: tip2.x + t2bx * d3,
        y: tip2.y + t2by * d3,
        z: tip2.z + bz * d3
      };
      
      nodeBranches.push({ mid, tip1, tip2, tip1a, tip1b, tip2a, tip2b });
    }
    branches[node.id] = nodeBranches;
  }
  return branches;
};

// Fixed regional colors matching the zones in the reel visualizer
const REGIONAL_COLORS: Record<string, RGB> = {
  prefrontal:  { r: 0,   g: 212, b: 255, hex: "#00d4ff" }, // Cyan (top-left)
  motor:       { r: 0,   g: 140, b: 255, hex: "#008cff" }, // Blue (top-center)
  sensory:     { r: 0,   g: 212, b: 255, hex: "#00d4ff" }, // Cyan (top-right)
  concept:     { r: 139, g: 92,  b: 246, hex: "#8b5cf6" }, // Purple (middle-right)
  language:    { r: 245, g: 158, b: 11,  hex: "#f59e0b" }, // Yellow/Orange (middle-left)
  feature:     { r: 236, g: 72,  b: 153, hex: "#ec4899" }, // Pink (lower-right)
  cerebellum:  { r: 16,  g: 185, b: 129, hex: "#10b981" }, // Green (bottom-right)
  brainstem:   { r: 16,  g: 185, b: 129, hex: "#10b981" }, // Green (bottom-center)
};

// Map base coordinates dynamically to regional colors
const getParticleColor = (x: number, y: number, colorOffset: number): RGB => {
  // Bottom region (Green)
  if (y > 15) {
    return REGIONAL_COLORS.brainstem;
  }
  // Left region (Yellow/Orange)
  if (x < -10) {
    return colorOffset < 0.5
      ? REGIONAL_COLORS.language
      : { r: 239, g: 68, b: 68, hex: "#ef4444" }; // Red-Orange accents
  }
  // Right region (Purple/Pink)
  if (x >= 15) {
    return colorOffset < 0.5
      ? REGIONAL_COLORS.concept
      : REGIONAL_COLORS.feature;
  }
  // Top region (Blue/Cyan)
  return colorOffset < 0.5
    ? REGIONAL_COLORS.motor
    : REGIONAL_COLORS.prefrontal;
};

// Generate particles inside the biological brain structure (High Fidelity Folding)
const generateBrainParticles = (count: number): Particle3D[] => {
  const pts: Particle3D[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let x = 0, y = 0, z = 0;
    
    if (r < 0.75) {
      // 1. Cerebrum (Two Hemispheres with complex folding)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      // Folding pattern simulating gyri and sulci
      const foldFrequency = 9;
      const foldAmplitude = 0.08;
      const folding = 1.0 + foldAmplitude * Math.sin(theta * foldFrequency) * Math.sin(phi * foldFrequency);
      
      const baseRadius = 58;
      const dist = (0.2 + Math.random() * 0.8) * baseRadius * folding;
      
      x = dist * Math.sin(phi) * Math.cos(theta);
      y = dist * Math.sin(phi) * Math.sin(theta) - 10;
      z = dist * Math.cos(phi) * 0.85; // slightly flattened depth
      
      // Separate hemispheres (longitudinal fissure gap at x = 0)
      const gap = 2.0;
      if (Math.abs(x) < gap) {
        x += x >= 0 ? gap : -gap;
      }
    } else if (r < 0.90) {
      // 2. Cerebellum (Dense cluster at the back-bottom with fine folds)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      const folding = 1.0 + 0.12 * Math.sin(phi * 16);
      const dist = (0.3 + Math.random() * 0.7) * 22 * folding;
      
      x = (25 + dist * Math.sin(phi) * Math.cos(theta)) * 0.9; // shifted back
      y = 28 + dist * Math.sin(phi) * Math.sin(theta) * 0.8;  // shifted down
      z = -16 + dist * Math.cos(phi);
    } else {
      // 3. Brainstem (Tapered cylinder extending downwards)
      const h = Math.random() * 40;
      const rad = (1 - h / 50) * 9 + 2.5;
      const angle = Math.random() * Math.PI * 2;
      
      x = Math.cos(angle) * rad;
      y = 22 + h;
      z = Math.sin(angle) * rad;
    }
    
    const colorOffset = Math.random();
    const color = getParticleColor(x, y, colorOffset);
    
    pts.push({
      x, y, z,
      colorOffset,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.02,
      color
    });
  }
  return pts;
};

// Animated message signals carrying signals
interface SignalPulse {
  sourceId: string;
  targetId: string;
  progress: number;
  speed: number;
}

interface BranchSignal {
  nodeId: string;
  branchIndex: number;
  progress: number; // 0.0 to 3.0 (0-1: trunk, 1-2: mid fork, 2-3: outer twig)
  speed: number;
  pathIndex1: 1 | 2; // Split direction at first fork
  pathIndex2: 1 | 2; // Split direction at second fork
}

// ══════════════════════════════════════════════
// MAIN BRAIN ORB COMPONENT
// ══════════════════════════════════════════════
export function AuraOrb({ state, amplitude = 0.5, size = 300, width = 300, coworker = "Jarvis" }: AuraOrbProps) {
  const height = size;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  
  // Constant particle data
  const particlesRef = useRef<Particle3D[]>([]);
  // Travelling signal pulses
  const signalsRef = useRef<SignalPulse[]>([]);
  
  // Outer neural branches and signals
  const branchesRef = useRef<Record<string, Branch3D[]>>({});
  const branchSignalsRef = useRef<BranchSignal[]>([]);
  
  // Smoothly transitioning node colors
  const nodeColorsRef = useRef<Record<string, RGB>>({});
  
  // Theme state for smooth color morphing
  const currentThemeRef = useRef<{ primary: RGB; secondary: RGB; tertiary: RGB } | null>(null);

  // User interactive drag rotation references
  const userRotationRef = useRef({ x: 0.15, y: 0 }); // Start with slight pitch tilt
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rotationStartRef = useRef({ x: 0.15, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const autoSpinAngleRef = useRef(0);
  const lastMoveTimeRef = useRef(0);

  // Mouse & Touch Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    rotationStartRef.current = { ...userRotationRef.current };
    velocityRef.current = { x: 0, y: 0 };
    if (canvasRef.current) {
      canvasRef.current.style.cursor = "grabbing";
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    rotationStartRef.current = { ...userRotationRef.current };
    velocityRef.current = { x: 0, y: 0 };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    const sensitivity = 0.007;
    const newX = rotationStartRef.current.x + dy * sensitivity;
    const newY = rotationStartRef.current.y + dx * sensitivity;
    
    const rawVelX = newX - userRotationRef.current.x;
    const rawVelY = newY - userRotationRef.current.y;
    
    // Cap and heavily damp the velocity to prevent spinning too fast on release
    const maxVel = 0.015;
    velocityRef.current.x = Math.max(-maxVel, Math.min(maxVel, rawVelX * 0.15));
    velocityRef.current.y = Math.max(-maxVel, Math.min(maxVel, rawVelY * 0.15));
    
    userRotationRef.current.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, newX));
    userRotationRef.current.y = newY;
    
    lastMoveTimeRef.current = performance.now();
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    
    const sensitivity = 0.009;
    const newX = rotationStartRef.current.x + dy * sensitivity;
    const newY = rotationStartRef.current.y + dx * sensitivity;
    
    const rawVelX = newX - userRotationRef.current.x;
    const rawVelY = newY - userRotationRef.current.y;
    
    const maxVel = 0.015;
    velocityRef.current.x = Math.max(-maxVel, Math.min(maxVel, rawVelX * 0.15));
    velocityRef.current.y = Math.max(-maxVel, Math.min(maxVel, rawVelY * 0.15));
    
    userRotationRef.current.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, newX));
    userRotationRef.current.y = newY;
    
    lastMoveTimeRef.current = performance.now();
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = "grab";
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const onMouseUp = () => handleMouseUp();
    const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const onTouchEnd = () => handleTouchEnd();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Initialize particles and branches once (High density point-cloud)
  useEffect(() => {
    particlesRef.current = generateBrainParticles(1200);
    branchesRef.current = generateNodeBranches(BRAIN_NODES);
  }, []);

  // Smooth color interpolation helper
  const interpolateColor = (c1: RGB, c2: RGB, factor: number): string => {
    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);
    return `rgb(${r},${g},${b})`;
  };

  // Helper to draw lightning arcs for "thinking" state
  const drawLightningArc = (
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    color: string
  ) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(dist / 14);

    let currX = x1;
    let currY = y1;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const tx = x1 + dx * t;
      const ty = y1 + dy * t;

      const px = -dy / dist;
      const py = dx / dist;

      const envelope = Math.sin(t * Math.PI);
      const displacement = (Math.random() - 0.5) * 14 * envelope;

      currX = tx + px * displacement;
      currY = ty + py * displacement;

      ctx.lineTo(currX, currY);
    }
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.0 + Math.random() * 1.5;
    ctx.stroke();
  };

  // Main drawing loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // ── 1. Update Time & Coworker Theme Morphing ──
    const speedCoef = state === "listening" ? 2.5 : state === "thinking" ? 4.0 : state === "speaking" ? 2.0 : 1.0;
    timeRef.current += 0.006 * speedCoef;
    const t = timeRef.current;

    const targetTheme = COWORKER_THEMES[coworker] || COWORKER_THEMES["Jarvis"];
    if (!currentThemeRef.current) {
      currentThemeRef.current = { ...targetTheme };
    } else {
      // Morph colors slowly (LERP factor 0.08 per frame)
      const lerp = 0.08;
      const morphColor = (curr: RGB, target: RGB) => {
        curr.r += (target.r - curr.r) * lerp;
        curr.g += (target.g - curr.g) * lerp;
        curr.b += (target.b - curr.b) * lerp;
      };
      morphColor(currentThemeRef.current.primary, targetTheme.primary);
      morphColor(currentThemeRef.current.secondary, targetTheme.secondary);
      morphColor(currentThemeRef.current.tertiary, targetTheme.tertiary);
    }

    const theme = currentThemeRef.current;
    const primaryColorHex = `rgb(${Math.round(theme.primary.r)},${Math.round(theme.primary.g)},${Math.round(theme.primary.b)})`;
    const secondaryColorHex = `rgb(${Math.round(theme.secondary.r)},${Math.round(theme.secondary.g)},${Math.round(theme.secondary.b)})`;

    // Dynamic brain scale factor relative to base size 260
    const scaleRatio = height / 260;
    const brainScale = 2.2 * scaleRatio;

    // Center of canvas
    const cx = width / 2;
    // Shift Y center upward to prevent overlap with coworker buttons at the bottom
    const cy = height / 2 - 30;
    
    // Camera settings
    const camDist = 240;

    // ── 2. Rotate & Project 3D Nodes ──
    // Apply user drag momentum/decay
    if (isDraggingRef.current) {
      // If user holds still for >50ms before releasing, clear the release momentum
      if (performance.now() - lastMoveTimeRef.current > 50) {
        velocityRef.current = { x: 0, y: 0 };
      }
    } else {
      userRotationRef.current.x += velocityRef.current.x;
      userRotationRef.current.y += velocityRef.current.y;
      
      velocityRef.current.x *= 0.88; // Tighter decay friction
      velocityRef.current.y *= 0.88;
      
      // Gently return the pitch (X rotation) to its default beautiful tilt of 0.15
      userRotationRef.current.x += (0.15 - userRotationRef.current.x) * 0.015;
      
      autoSpinAngleRef.current += 0.006 * speedCoef * 0.45;
    }
    
    const yaw = autoSpinAngleRef.current + userRotationRef.current.y;
    const pitch = userRotationRef.current.x;
    
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    const rotatePoint = (x: number, y: number, z: number) => {
      // 1. Rotate around X axis (pitch)
      const x1 = x;
      const y1 = y * cosP - z * sinP;
      const z1 = y * sinP + z * cosP;
      
      // 2. Rotate around Y axis (yaw)
      const rx = x1 * cosY - z1 * sinY;
      const ry = y1;
      const rz = x1 * sinY + z1 * cosY;
      
      return { rx, ry, rz };
    };

    const projectedNodes = new Map<string, { sx: number; sy: number; sz: number; scale: number; node: BrainNode3D }>();

    for (const node of BRAIN_NODES) {
      // Apply 3D pitch and yaw rotation
      const { rx, ry, rz } = rotatePoint(node.x, node.y, node.z);

      const scale = camDist / (camDist + rz);
      const sx = cx + rx * scale * brainScale; // Scale up the projected brain dynamically
      const sy = cy + ry * scale * brainScale * 0.82;

      projectedNodes.set(node.id, { sx, sy, sz: rz, scale, node });
    }

    // Helper to get spatial color shifted by coworker index
    const getShiftedColor = (bx: number, by: number, colorOffset: number): RGB => {
      let rx = bx;
      let ry = by;
      
      // Permute spatial coordinates based on coworker to shift color zones
      if (coworker === "Bobby") {
        rx = -by;
        ry = bx;
      } else if (coworker === "Tom") {
        rx = -bx;
        ry = -by;
      } else if (coworker === "Sarah") {
        rx = by;
        ry = -bx;
      }
      
      return getParticleColor(rx, ry, colorOffset);
    };

    // ── Update and Interpolate Node Colors ──
    const nodeColors = nodeColorsRef.current;
    for (const node of BRAIN_NODES) {
      const targetColor = node.id === "hippocampus" 
        ? theme.primary 
        : getShiftedColor(node.x, node.y, 0.2);
        
      if (!nodeColors[node.id]) {
        nodeColors[node.id] = { ...targetColor };
      } else {
        const lerpVal = 0.05; // Smooth color morphing transition
        nodeColors[node.id].r += (targetColor.r - nodeColors[node.id].r) * lerpVal;
        nodeColors[node.id].g += (targetColor.g - nodeColors[node.id].g) * lerpVal;
        nodeColors[node.id].b += (targetColor.b - nodeColors[node.id].b) * lerpVal;
      }
    }

    // Helper to get regional node colors (center core dynamically matches coworker theme, outer nodes shift)
    const getNodeColor = (nodeId: string): RGB => {
      return nodeColors[nodeId] || theme.primary;
    };

    // Enable WebGL-like additive blending for the glow layers
    ctx.globalCompositeOperation = "lighter";

    // ── 3. Render Neural Pathways (Edges) ──
    for (const link of NEURAL_LINKS) {
      const s = projectedNodes.get(link.source);
      const tg = projectedNodes.get(link.target);
      if (!s || !tg) continue;

      // Draw path line with transparency matching z-depth
      const avgZ = (s.sz + tg.sz) / 2;
      const depthOpacity = Math.max(0.06, Math.min(0.45, 0.25 - avgZ / 120));

      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(tg.sx, tg.sy);

      const sourceColor = getNodeColor(link.source);
      const targetColor = getNodeColor(link.target);

      const grad = ctx.createLinearGradient(s.sx, s.sy, tg.sx, tg.sy);
      grad.addColorStop(0, `rgb(${sourceColor.r},${sourceColor.g},${sourceColor.b})`);
      grad.addColorStop(1, `rgb(${targetColor.r},${targetColor.g},${targetColor.b})`);

      ctx.strokeStyle = grad;
      ctx.globalAlpha = depthOpacity;
      ctx.lineWidth = 1.0;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Helper to project relative coordinates (adds relative offset to node, rotates, and projects)
    const projectRelativePoint = (node: BrainNode3D, rxRel: number, ryRel: number, rzRel: number) => {
      // Add relative coordinate to node absolute position in 3D
      const ax = node.x + rxRel;
      const ay = node.y + ryRel;
      const az = node.z + rzRel;
      
      // Rotate using 3D pitch/yaw rotation
      const { rx, ry, rz } = rotatePoint(ax, ay, az);
      
      const scale = camDist / (camDist + rz);
      const sx = cx + rx * scale * brainScale;
      const sy = cy + ry * scale * brainScale * 0.82;
      return { sx, sy, sz: rz, scale };
    };

    // Cache projected branch points so that they aren't calculated multiple times
    const projectedBranchesMap = new Map<string, {
      mid: { sx: number; sy: number; sz: number; scale: number };
      tip1: { sx: number; sy: number; sz: number; scale: number };
      tip2: { sx: number; sy: number; sz: number; scale: number };
      tip1a: { sx: number; sy: number; sz: number; scale: number };
      tip1b: { sx: number; sy: number; sz: number; scale: number };
      tip2a: { sx: number; sy: number; sz: number; scale: number };
      tip2b: { sx: number; sy: number; sz: number; scale: number };
    }[]>();

    // ── 3.5. Render Neural Branches (Dendrites) ──
    const nodeBranches = branchesRef.current;
    for (const node of BRAIN_NODES) {
      if (node.id === "hippocampus") continue;
      const pNode = projectedNodes.get(node.id);
      if (!pNode) continue;
      
      const branches = nodeBranches[node.id] || [];
      const nodeColor = getNodeColor(node.id);
      
      const depthOpacity = Math.max(0.06, Math.min(0.45, 0.25 - pNode.sz / 120));
      const branchOpacity = 0.75 * depthOpacity;

      // Project coordinates exactly once per branch to preserve 60fps
      const projectedBranches = branches.map(branch => {
        return {
          mid: projectRelativePoint(node, branch.mid.x, branch.mid.y, branch.mid.z),
          tip1: projectRelativePoint(node, branch.tip1.x, branch.tip1.y, branch.tip1.z),
          tip2: projectRelativePoint(node, branch.tip2.x, branch.tip2.y, branch.tip2.z),
          tip1a: projectRelativePoint(node, branch.tip1a.x, branch.tip1a.y, branch.tip1a.z),
          tip1b: projectRelativePoint(node, branch.tip1b.x, branch.tip1b.y, branch.tip1b.z),
          tip2a: projectRelativePoint(node, branch.tip2a.x, branch.tip2a.y, branch.tip2a.z),
          tip2b: projectRelativePoint(node, branch.tip2b.x, branch.tip2b.y, branch.tip2b.z)
        };
      });

      projectedBranchesMap.set(node.id, projectedBranches);

      ctx.strokeStyle = `rgba(${nodeColor.r},${nodeColor.g},${nodeColor.b},${branchOpacity})`;

      // 1. Group & draw trunks (thickest)
      ctx.lineWidth = 2.0 * scaleRatio;
      ctx.beginPath();
      for (const bProj of projectedBranches) {
        ctx.moveTo(pNode.sx, pNode.sy);
        ctx.lineTo(bProj.mid.sx, bProj.mid.sy);
      }
      ctx.stroke();

      // 2. Group & draw first splits (medium thickness)
      ctx.lineWidth = 1.35 * scaleRatio;
      ctx.beginPath();
      for (const bProj of projectedBranches) {
        ctx.moveTo(bProj.mid.sx, bProj.mid.sy);
        ctx.lineTo(bProj.tip1.sx, bProj.tip1.sy);
        ctx.moveTo(bProj.mid.sx, bProj.mid.sy);
        ctx.lineTo(bProj.tip2.sx, bProj.tip2.sy);
      }
      ctx.stroke();

      // 3. Group & draw second splits (thinnest)
      ctx.lineWidth = 0.8 * scaleRatio;
      ctx.beginPath();
      for (const bProj of projectedBranches) {
        ctx.moveTo(bProj.tip1.sx, bProj.tip1.sy);
        ctx.lineTo(bProj.tip1a.sx, bProj.tip1a.sy);
        ctx.moveTo(bProj.tip1.sx, bProj.tip1.sy);
        ctx.lineTo(bProj.tip1b.sx, bProj.tip1b.sy);
        
        ctx.moveTo(bProj.tip2.sx, bProj.tip2.sy);
        ctx.lineTo(bProj.tip2a.sx, bProj.tip2a.sy);
        ctx.moveTo(bProj.tip2.sx, bProj.tip2.sy);
        ctx.lineTo(bProj.tip2b.sx, bProj.tip2b.sy);
      }
      ctx.stroke();
    }

    // ── 3.6. Spawn & Animate Branch Signals ──
    // Filter active branch signals (signals travel 0.0 -> 3.0 across double-fork)
    branchSignalsRef.current = branchSignalsRef.current.filter(sig => sig.progress < 3.0);

    // Spawn new branch signals randomly
    const branchSignalLimit = state === "listening" ? 48 : state === "thinking" ? 60 : state === "speaking" ? 40 : 20;
    if (branchSignalsRef.current.length < branchSignalLimit && Math.random() < 0.45) {
      const outerNodes = BRAIN_NODES.filter(n => n.id !== "hippocampus");
      const randomNode = outerNodes[Math.floor(Math.random() * outerNodes.length)];
      const branches = nodeBranches[randomNode.id] || [];
      if (branches.length > 0) {
        const branchIdx = Math.floor(Math.random() * branches.length);

        branchSignalsRef.current.push({
          nodeId: randomNode.id,
          branchIndex: branchIdx,
          progress: 0.0,
          speed: 0.03 + Math.random() * 0.015,
          pathIndex1: Math.random() < 0.5 ? 1 : 2,
          pathIndex2: Math.random() < 0.5 ? 1 : 2
        });
      }
    }

    // Render branch signals
    for (const sig of branchSignalsRef.current) {
      const pNode = projectedNodes.get(sig.nodeId);
      const projBranches = projectedBranchesMap.get(sig.nodeId);
      if (!pNode || !projBranches) continue;

      const bProj = projBranches[sig.branchIndex];
      if (!bProj) continue;

      sig.progress += sig.speed;
      const progress = sig.progress;

      const midProj = bProj.mid;
      const tipProj = sig.pathIndex1 === 1 ? bProj.tip1 : bProj.tip2;

      let subTipProj;
      if (sig.pathIndex1 === 1) {
        subTipProj = sig.pathIndex2 === 1 ? bProj.tip1a : bProj.tip1b;
      } else {
        subTipProj = sig.pathIndex2 === 1 ? bProj.tip2a : bProj.tip2b;
      }

      let sigX = 0;
      let sigY = 0;
      let currentScale = 1;

      if (progress < 1.0) {
        // Trunk: Node to mid
        sigX = pNode.sx + (midProj.sx - pNode.sx) * progress;
        sigY = pNode.sy + (midProj.sy - pNode.sy) * progress;
        currentScale = pNode.scale + (midProj.scale - pNode.scale) * progress;
      } else if (progress < 2.0) {
        // Mid to Tip1/2
        const p = progress - 1.0;
        sigX = midProj.sx + (tipProj.sx - midProj.sx) * p;
        sigY = midProj.sy + (tipProj.sy - midProj.sy) * p;
        currentScale = midProj.scale + (tipProj.scale - midProj.scale) * p;
      } else {
        // Tip1/2 to SubTip
        const p = Math.min(1.0, progress - 2.0);
        sigX = tipProj.sx + (subTipProj.sx - tipProj.sx) * p;
        sigY = tipProj.sy + (subTipProj.sy - tipProj.sy) * p;
        currentScale = tipProj.scale + (subTipProj.scale - tipProj.scale) * p;
      }

      const nodeColor = getNodeColor(sig.nodeId);
      // Fade in and out smoothly
      const opacity = Math.sin(Math.min(progress, 3.0 - progress) * Math.PI / 3) * 0.95;
      const sizeMult = state === "speaking" ? 1.0 + amplitude * 1.5 : 1.0;
      const signalSize = 2.0 * currentScale * scaleRatio * sizeMult;

      // Draw double-arc glow (100x faster than shadowBlur)
      ctx.beginPath();
      ctx.arc(sigX, sigY, signalSize * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${nodeColor.r},${nodeColor.g},${nodeColor.b},${opacity * 0.25})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sigX, sigY, signalSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${nodeColor.r},${nodeColor.g},${nodeColor.b},${opacity})`;
      ctx.fill();
    }

    // ── 4. Spawn & Animate Signal Pulses ──
    // Spawn signals based on visualizer state
    const signalLimit = state === "listening" ? 6 : state === "thinking" ? 8 : state === "speaking" ? 5 : 2;
    const signalSpeed = state === "listening" ? 0.04 : state === "thinking" ? 0.06 : state === "speaking" ? 0.03 : 0.015;

    // Filter out completed signals
    signalsRef.current = signalsRef.current.filter(sig => sig.progress < 1.0);

    // Spawn new signals randomly to keep network alive
    if (signalsRef.current.length < signalLimit && Math.random() < 0.09) {
      // Standard random pathway
      const randomLink = NEURAL_LINKS[Math.floor(Math.random() * NEURAL_LINKS.length)];
      
      let source = randomLink.source;
      let target = randomLink.target;

      if (state === "listening") {
        // Listening: signals travel INWARDS to Memory Core (Hippocampus)
        // Find paths ending in hippocampus
        const inwardsPaths = NEURAL_LINKS.filter(l => l.target === "hippocampus" || l.source === "hippocampus");
        const link = inwardsPaths[Math.floor(Math.random() * inwardsPaths.length)];
        source = link.source === "hippocampus" ? link.target : link.source;
        target = "hippocampus";
      } else if (state === "speaking") {
        // Speaking: signals travel OUTWARDS from Memory Core
        const outwardsPaths = NEURAL_LINKS.filter(l => l.source === "hippocampus" || l.target === "hippocampus");
        const link = outwardsPaths[Math.floor(Math.random() * outwardsPaths.length)];
        source = "hippocampus";
        target = link.source === "hippocampus" ? link.target : link.source;
      }

      signalsRef.current.push({
        sourceId: source,
        targetId: target,
        progress: 0.0,
        speed: signalSpeed * (0.85 + Math.random() * 0.3),
      });
    }

    // Render active traveling signals
    for (const sig of signalsRef.current) {
      const s = projectedNodes.get(sig.sourceId);
      const tg = projectedNodes.get(sig.targetId);
      if (!s || !tg) continue;

      sig.progress += sig.speed;
      const prog = Math.min(1.0, sig.progress);

      // Interpolate current signal coordinate
      const sigX = s.sx + (tg.sx - s.sx) * prog;
      const sigY = s.sy + (tg.sy - s.sy) * prog;

      const currentScale = s.scale + (tg.scale - s.scale) * prog;
      const signalSize = (state === "speaking" ? 3.5 + amplitude * 5.0 : 2.5) * currentScale * scaleRatio;

      // Interpolate signal color dynamically as it travels between different regional zones
      const sColor = getNodeColor(sig.sourceId);
      const tgColor = getNodeColor(sig.targetId);
      const signalColor = state === "speaking" ? "#ffffff" : interpolateColor(sColor, tgColor, prog);

      // Draw double-arc glow (100x faster than shadowBlur)
      ctx.beginPath();
      ctx.arc(sigX, sigY, signalSize * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = state === "speaking" ? "rgba(255, 255, 255, 0.25)" : `rgba(${sColor.r},${sColor.g},${sColor.b},0.25)`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sigX, sigY, signalSize, 0, Math.PI * 2);
      ctx.fillStyle = signalColor;
      ctx.fill();
    }

    // ── 5. Render Electric Discharges (Thinking Lightning) ──
    if (state === "thinking") {
      const core = projectedNodes.get("hippocampus");
      if (core && Math.random() < 0.35) {
        // Choose a random node to discharge towards
        const targetKeys = ["prefrontal", "motor", "sensory", "concept", "language", "feature"];
        const destKey = targetKeys[Math.floor(Math.random() * targetKeys.length)];
        const dest = projectedNodes.get(destKey);
        if (dest) {
          drawLightningArc(ctx, core.sx, core.sy, dest.sx, dest.sy, primaryColorHex);
        }
      }
    }

    // ── 6. Render Shimmering Brain Particle Cloud (Depth of Field & Volumetric Glow) ──
    // Optimized single-pass rendering loop (No sorting, No object allocations)
    const pts = particlesRef.current;
    const len = pts.length;
    for (let i = 0; i < len; i++) {
      const p = pts[i];
      
      // Apply 3D pitch and yaw rotation
      const { rx, ry, rz } = rotatePoint(p.x, p.y, p.z);
      const scale = camDist / (camDist + rz);
      const sx = cx + rx * scale * brainScale;
      const sy = cy + ry * scale * brainScale * 0.82;
      
      p.pulsePhase += p.pulseSpeed;
      
      // Depth opacity scaling
      const baseOpacity = Math.max(0.12, Math.min(0.9, 0.5 - rz / 140));
      const pulseMultiplier = 0.7 + 0.3 * Math.sin(p.pulsePhase);
      
      // Dynamic Depth of Field (Focal plane at sz = 0)
      const distFromFocus = Math.abs(rz);
      const blurFactor = Math.min(2.5, distFromFocus / 25);
      
      // Scale radius and opacity based on blur distance
      const rad = (0.7 + p.colorOffset * 1.0) * scale * scaleRatio * (1.0 + blurFactor * 0.65);
      const finalOpacity = baseOpacity * pulseMultiplier * (1.0 - blurFactor * 0.28);

      // Calculate shifted color dynamically on coworker switch (smooth morph LERP)
      const targetColor = getShiftedColor(p.x, p.y, p.colorOffset);
      if (!p.activeColor) {
        p.activeColor = { ...targetColor };
      } else {
        const lerpVal = 0.05;
        p.activeColor.r += (targetColor.r - p.activeColor.r) * lerpVal;
        p.activeColor.g += (targetColor.g - p.activeColor.g) * lerpVal;
        p.activeColor.b += (targetColor.b - p.activeColor.b) * lerpVal;
      }
      const col = `rgb(${Math.round(p.activeColor.r)},${Math.round(p.activeColor.g)},${Math.round(p.activeColor.b)})`;

      // Draw two-layer glowing WebGL-like soft particles:
      
      // 1. Soft Volumetric Outer Glow
      ctx.beginPath();
      ctx.arc(sx, sy, rad * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.globalAlpha = finalOpacity * 0.22;
      ctx.fill();

      // 2. Sharp Core Dot
      ctx.beginPath();
      ctx.arc(sx, sy, rad * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.globalAlpha = finalOpacity * 0.85;
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // ── 7. Render Brain Centers (Nodes & Halos) ──
    for (const [id, nodeData] of projectedNodes.entries()) {
      ctx.globalCompositeOperation = "lighter"; // Restore additive blending for glows
      const { sx, sy, sz, scale, node } = nodeData;
      const isCore = id === "hippocampus";

      // Get regional node colors (shifted dynamically by coworker), while the center core morphs dynamically
      const nodeColorRGB = isCore ? theme.tertiary : getNodeColor(id);
      const nodeBaseColor = `rgb(${nodeColorRGB.r},${nodeColorRGB.g},${nodeColorRGB.b})`;

      // Pulse scaling based on speaking state
      const pulseScale = (id === "hippocampus" && state === "speaking") 
        ? 1.0 + amplitude * 1.8 
        : 1.0;

      const baseRad = (isCore ? 9 : 5) * scaleRatio;
      const rad = baseRad * scale * pulseScale;

      // Ambient halo glow (wider and more vibrant for the central core)
      const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad * (isCore ? 3.0 : 2.5));
      const coreAlpha = isCore ? 0.45 : 0.25;
      glowGrad.addColorStop(0, isCore ? `rgba(${theme.primary.r},${theme.primary.g},${theme.primary.b},${coreAlpha})` : `rgba(${nodeColorRGB.r},${nodeColorRGB.g},${nodeColorRGB.b},${coreAlpha})`);
      glowGrad.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.arc(sx, sy, rad * (isCore ? 3.0 : 2.5), 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // Core reflecting 3D dot
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      
      if (isCore) {
        // High-end 3D glossy marble glass sphere gradient for the central node
        const sphereGrad = ctx.createRadialGradient(sx - rad * 0.25, sy - rad * 0.25, 0, sx, sy, rad);
        sphereGrad.addColorStop(0, "#ffffff"); // specular reflection shine
        sphereGrad.addColorStop(0.35, `rgb(${theme.primary.r},${theme.primary.g},${theme.primary.b})`);
        sphereGrad.addColorStop(1, `rgb(${theme.tertiary.r},${theme.tertiary.g},${theme.tertiary.b})`);
        ctx.fillStyle = sphereGrad;
      } else {
        ctx.fillStyle = nodeBaseColor;
      }
      
      ctx.shadowColor = isCore ? `rgb(${theme.primary.r},${theme.primary.g},${theme.primary.b})` : nodeBaseColor;
      ctx.shadowBlur = isCore ? 20 : 6;
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      // Border outline
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(t * 5)})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── 8. Draw Firing Rate Text labels (Matches video metrics) ──
      // Don't draw labels for the main core to keep UI uncluttered
      if (!isCore) {
        ctx.globalCompositeOperation = "source-over"; // Reset to standard blending for sharp text
        // Persona dynamic calculations
        let firingRate = 0.5 + Math.sin(t * 3 + node.x) * 0.3;
        let neuronCount = node.baseNeuronCount;

        if (coworker.toLowerCase() === "bobby") {
          if (id === "concept" || id === "prefrontal") {
            firingRate = 2.0 + Math.sin(t * 8) * 0.7;
            neuronCount += Math.floor(Math.sin(t * 12) * 5);
          }
        } else if (coworker.toLowerCase() === "tom") {
          if (id === "motor" || id === "brainstem") {
            firingRate = 2.4 + Math.sin(t * 10) * 0.8;
            neuronCount += Math.floor(Math.sin(t * 15) * 8);
          }
        } else if (coworker.toLowerCase() === "sarah") {
          if (id === "language" || id === "sensory") {
            firingRate = 1.9 + Math.sin(t * 7) * 0.6;
            neuronCount += Math.floor(Math.sin(t * 10) * 4);
          }
        }

        // Project text with tiny depth offset
        const isFront = sz < 15;
        const textOpacity = isFront ? 0.8 : 0.35;
        const fontSize = Math.max(7, Math.round(7.5 * scaleRatio));

        ctx.font = `600 ${fontSize}px JetBrains Mono, Courier Prime, Courier, monospace`;
        ctx.fillStyle = `rgba(255, 255, 255, ${textOpacity})`;
        ctx.textBaseline = "middle";

        const textContent = `${node.label}: ${neuronCount}n - ${firingRate.toFixed(1)}%`;
        // Smart label alignment: draw left if node is on the left, right if on the right
        const textOffset = rad + 5 * scaleRatio;
        if (sx > cx) {
          ctx.textAlign = "left";
          ctx.fillText(textContent, sx + textOffset, sy);
        } else {
          ctx.textAlign = "right";
          ctx.fillText(textContent, sx - textOffset, sy);
        }
      }
    }

    // Reset global composite operation for the next drawing frame context
    ctx.globalCompositeOperation = "source-over";

    frameRef.current = requestAnimationFrame(draw);
  }, [width, height, state, amplitude, coworker]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  return (
    <div style={{ width: width, height: height, position: "relative" }} className="select-none">
      {/* Ambient background workspace glow */}
      {currentThemeRef.current && (
        <motion.div
          style={{
            position: "absolute", inset: -height * 0.35, borderRadius: "50%",
            background: `radial-gradient(circle, rgb(${currentThemeRef.current.primary.r},${currentThemeRef.current.primary.g},${currentThemeRef.current.primary.b}) 0%, rgba(${currentThemeRef.current.secondary.r},${currentThemeRef.current.secondary.g},${currentThemeRef.current.secondary.b},0.2) 35%, transparent 65%)`,
            filter: `blur(${height * 0.22}px)`, pointerEvents: "none",
          }}
          animate={{
            opacity: state === "listening" ? 0.3 : state === "thinking" ? 0.25 : state === "speaking" ? 0.35 : 0.15,
            scale: state === "speaking" ? 1.05 + amplitude * 0.15 : 1.0
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      )}

      {/* 3D Canvas visualizer */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          width: width,
          height: height,
          display: "block",
          pointerEvents: "auto",
          cursor: "grab",
        }}
      />
    </div>
  );
}

export const NebulaVisualizer = AuraOrb;
