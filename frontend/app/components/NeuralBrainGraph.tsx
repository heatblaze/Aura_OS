"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────
export interface BrainNode {
  id: string;
  label: string;
  filename: string;
  size: number;
  color: string;
  modified_at: string;
  line_count: number;
  excerpt: string;
  // Physics properties (set at runtime)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  value?: number; // optional live value
}

export interface BrainEdge {
  source: string;
  target: string;
  type: "wiki_link" | "mention";
}

interface NeuralBrainGraphProps {
  nodes: BrainNode[];
  edges: BrainEdge[];
  activeNodeId?: string | null;
  width?: number;
  height?: number;
  onNodeClick?: (node: BrainNode) => void;
}

// ── Force Simulation ────────────────────────────────────────────
function useForceSimulation(nodes: BrainNode[], edges: BrainEdge[], width: number, height: number) {
  const nodesRef = useRef<BrainNode[]>([]);
  const edgesRef = useRef<BrainEdge[]>([]);
  const frameRef = useRef<number>(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Sync external nodes with ref, maintaining existing coordinates if available
    const existingCoords = new Map(nodesRef.current.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]));
    
    nodesRef.current = nodes.map((n) => {
      const coords = existingCoords.get(n.id);
      return {
        ...n,
        x: coords?.x ?? n.x ?? (width / 2 + (Math.random() - 0.5) * width * 0.4),
        y: coords?.y ?? n.y ?? (height / 2 + (Math.random() - 0.5) * height * 0.4),
        vx: coords?.vx ?? n.vx ?? 0,
        vy: coords?.vy ?? n.vy ?? 0,
        fx: null,
        fy: null,
      };
    });
    edgesRef.current = edges;
  }, [nodes, edges, width, height]);

  const simulate = useCallback(() => {
    const ns = nodesRef.current;
    if (ns.length === 0) return;

    const alpha = 0.25;
    const repulsion = 3200;
    const linkStrength = 0.18;
    const linkDistance = 145;
    const centerStrength = 0.03;
    const damping = 0.82;

    // Repulsion (each node repels all others)
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j].x! - ns[i].x!;
        const dy = ns[j].y! - ns[i].y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 300) continue; // Skip far nodes to speed up
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force * alpha;
        const fy = (dy / dist) * force * alpha;
        ns[i].vx! -= fx;
        ns[i].vy! -= fy;
        ns[j].vx! += fx;
        ns[j].vy! += fy;
      }
    }

    // Link attraction (edges pull nodes together)
    const nodeMap = new Map(ns.map(n => [n.id, n]));
    for (const edge of edgesRef.current) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;
      const dx = target.x! - source.x!;
      const dy = target.y! - source.y!;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - linkDistance) * linkStrength * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      source.vx! += fx;
      source.vy! += fy;
      target.vx! -= fx;
      target.vy! -= fy;
    }

    // Center gravity
    for (const n of ns) {
      n.vx! += (width / 2 - n.x!) * centerStrength * alpha;
      n.vy! += (height / 2 - n.y!) * centerStrength * alpha;
    }

    // Apply velocity + damping + boundary constraints
    for (const n of ns) {
      if (n.fx != null) {
        n.x = n.fx;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx! *= damping;
      n.vy! *= damping;
      n.x = Math.max(20, Math.min(width - 20, n.x! + n.vx!));
      n.y = Math.max(20, Math.min(height - 20, n.y! + n.vy!));
    }

    setTick(t => t + 1);
    frameRef.current = requestAnimationFrame(simulate);
  }, [width, height]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [simulate]);

  return nodesRef;
}

// ── Main Component ──────────────────────────────────────────────
export function NeuralBrainGraph({
  nodes,
  edges,
  activeNodeId = null,
  width: propWidth,
  height: propHeight,
  onNodeClick,
}: NeuralBrainGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: propWidth || 600, height: propHeight || 400 });

  // Handle auto-resizing if dimensions are not explicitly passed as props
  useEffect(() => {
    if (propWidth && propHeight) {
      setDimensions({ width: propWidth, height: propHeight });
      return;
    }
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: width || 600, height: height || 400 });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [propWidth, propHeight]);

  const { width, height } = dimensions;

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<BrainNode | null>(null);
  const nodesRef = useForceSimulation(nodes, edges, width, height);
  const animTimeRef = useRef(0);

  // Pan and Zoom State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1.0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<BrainNode | null>(null);

  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (width > 0 && height > 0 && !hasInitializedRef.current) {
      const defaultScale = 1.35;
      setTransform({
        x: (width - width * defaultScale) / 2,
        y: (height - height * defaultScale) / 2,
        scale: defaultScale
      });
      hasInitializedRef.current = true;
    }
  }, [width, height]);

  // Traversal dynamic pulses simulating AI "learning"
  const pulsesRef = useRef<Array<{
    sourceId: string;
    targetId: string;
    progress: number;
    speed: number;
    color: string;
  }>>([]);

  // Helper to resolve coordinates relative to canvas zoom/pan scale transforms
  const getTransformedCoords = useCallback((clientX: number, clientY: number, canvasElement: HTMLCanvasElement) => {
    const rect = canvasElement.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    return {
      x: (mouseX - transform.x) / transform.scale,
      y: (mouseY - transform.y) / transform.scale
    };
  }, [transform]);

  // Node detection logic helper
  const getNodeAtPoint = useCallback((x: number, y: number): BrainNode | null => {
    const ns = nodesRef.current;
    for (const node of [...ns].reverse()) {
      if (node.x == null || node.y == null) continue;
      const radius = (node.size || 10) + 6;
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) return node;
    }
    return null;
  }, [nodesRef]);

  // ── Canvas Render Loop ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    animTimeRef.current += 0.015;
    const t = animTimeRef.current;
    const ns = nodesRef.current;
    const nodeMap = new Map(ns.map(n => [n.id, n]));

    // ── 1. Draw High-Tech Grid background ──
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
    const gridSize = 40;
    const startX = Math.floor((-transform.x) / (gridSize * transform.scale)) * gridSize;
    const startY = Math.floor((-transform.y) / (gridSize * transform.scale)) * gridSize;
    const endX = startX + (width / transform.scale) + gridSize * 2;
    const endY = startY + (height / transform.scale) + gridSize * 2;
    
    for (let gx = startX; gx < endX; gx += gridSize) {
      for (let gy = startY; gy < endY; gy += gridSize) {
        ctx.beginPath();
        // Screen space coordinate conversion
        const sx = gx * transform.scale + transform.x;
        const sy = gy * transform.scale + transform.y;
        ctx.arc(sx, sy, 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // ── Apply Zoom & Pan Transform Matrix ──
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // ── 2. Draw Connections (Edges) ──
    for (const edge of edges) {
      const s = nodeMap.get(edge.source);
      const tg = nodeMap.get(edge.target);
      if (!s || !tg || s.x == null || s.y == null || tg.x == null || tg.y == null) continue;

      const isActiveEdge =
        hoveredNode === edge.source || hoveredNode === edge.target ||
        activeNodeId === edge.source || activeNodeId === edge.target;

      const alpha = isActiveEdge ? 0.45 : 0.14;
      const lineWidth = isActiveEdge ? 1.5 : 0.65;

      const grad = ctx.createLinearGradient(s.x, s.y, tg.x, tg.y);
      grad.addColorStop(0, `${s.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
      grad.addColorStop(1, `${tg.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tg.x, tg.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    // ── 3. Spawn & Draw real-time traversal learning pulses ──
    if (Math.random() < 0.04 && edges.length > 0 && pulsesRef.current.length < 30) {
      const randEdge = edges[Math.floor(Math.random() * edges.length)];
      const srcNode = nodeMap.get(randEdge.source);
      if (srcNode) {
        pulsesRef.current.push({
          sourceId: randEdge.source,
          targetId: randEdge.target,
          progress: 0,
          speed: 0.005 + Math.random() * 0.01,
          color: srcNode.color
        });
      }
    }

    pulsesRef.current = pulsesRef.current.filter(p => {
      p.progress += p.speed;
      if (p.progress >= 1.0) return false;

      const s = nodeMap.get(p.sourceId);
      const tg = nodeMap.get(p.targetId);
      if (s && tg && s.x != null && s.y != null && tg.x != null && tg.y != null) {
        const px = s.x + (tg.x - s.x) * p.progress;
        const py = s.y + (tg.y - s.y) * p.progress;

        // Draw glowing particle pulse
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      return true;
    });

    // ── 4. Draw Nodes ──
    for (const node of ns) {
      if (node.x == null || node.y == null) continue;

      const isHovered = hoveredNode === node.id;
      const isActive = activeNodeId === node.id;
      const isSelected = selectedNode?.id === node.id;
      const baseSize = (node.size || 12) * 1.5;
      const radius = baseSize + (isHovered || isActive ? 4 : 0);

      // Outer glow
      const glowRadius = radius * 2.4;
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
      const glowAlpha = isHovered || isActive ? 0.38 : 0.12;
      glow.addColorStop(0, `${node.color}${Math.round(glowAlpha * 255).toString(16).padStart(2, "0")}`);
      glow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Pulsing orbital ring + particle satellites for active nodes
      if (isActive || isSelected || isHovered) {
        // Dynamic dashed sweep ring
        ctx.save();
        ctx.strokeStyle = `${node.color}55`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 3 orbiters revolving around the node core
        for (let o = 0; o < 3; o++) {
          const angle = t * 2.4 + (o * Math.PI * 2) / 3;
          const ox = node.x + Math.cos(angle) * (radius + 10);
          const oy = node.y + Math.sin(angle) * (radius + 10);
          ctx.beginPath();
          ctx.arc(ox, oy, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }
      }

      // Glassy Marble Spherical Gradient core fill
      const fill = ctx.createRadialGradient(
        node.x - radius * 0.25, node.y - radius * 0.25, 0,
        node.x, node.y, radius
      );
      fill.addColorStop(0, "#ffffff");
      fill.addColorStop(0.3, node.color);
      fill.addColorStop(1, `${node.color}55`);

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();

      // Border outline
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isHovered || isActive ? "#ffffff" : `${node.color}99`;
      ctx.lineWidth = isHovered || isActive ? 1.5 : 1;
      ctx.stroke();

      // Sharp central glossy dot
      ctx.beginPath();
      ctx.arc(node.x, node.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Node label text styling
      const textAlpha = isHovered || isActive ? 1.0 : 0.65;
      ctx.save();
      ctx.globalAlpha = textAlpha;
      ctx.font = `${isHovered || isActive ? "600" : "500"} ${isHovered ? "13" : "11.5"}px 'Inter', sans-serif`;
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, node.x, node.y + radius + 14);
      ctx.restore();
    }

    ctx.restore(); // Restore zoom/pan matrix for correct layout operations
  });

  // ── Panning & Zooming Event Handlers ──
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getTransformedCoords(e.clientX, e.clientY, canvas);
    const clickedNode = getNodeAtPoint(x, y);

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      clickedNode.fx = clickedNode.x;
      clickedNode.fy = clickedNode.y;
    } else {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX - transform.x,
        y: e.clientY - transform.y
      };
    }
  }, [getTransformedCoords, getNodeAtPoint, transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getTransformedCoords(e.clientX, e.clientY, canvas);

    if (draggedNodeRef.current) {
      const node = draggedNodeRef.current;
      node.fx = Math.max(10, Math.min(width - 10, x));
      node.fy = Math.max(10, Math.min(height - 10, y));
      node.x = node.fx;
      node.y = node.fy;
    } else if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      }));
    } else {
      const hoverNode = getNodeAtPoint(x, y);
      setHoveredNode(hoverNode?.id || null);
      canvas.style.cursor = hoverNode ? "pointer" : isPanning ? "grabbing" : "default";
    }
  }, [getTransformedCoords, getNodeAtPoint, isPanning, transform, width, height]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
    }
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = 1.05;
    const nextScale = e.deltaY < 0 ? transform.scale * zoomFactor : transform.scale / zoomFactor;
    const cappedScale = Math.max(0.4, Math.min(3.5, nextScale));
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const dx = mouseX - transform.x;
    const dy = mouseY - transform.y;
    
    setTransform({
      x: mouseX - dx * (cappedScale / transform.scale),
      y: mouseY - dy * (cappedScale / transform.scale),
      scale: cappedScale
    });
  }, [transform]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getTransformedCoords(e.clientX, e.clientY, canvas);
    const clickedNode = getNodeAtPoint(x, y);
    
    if (clickedNode) {
      setSelectedNode(prev => prev?.id === clickedNode.id ? null : clickedNode);
      onNodeClick?.(clickedNode);
    } else {
      setSelectedNode(null);
    }
  }, [getTransformedCoords, getNodeAtPoint, onNodeClick]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", borderRadius: 12 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoveredNode(null);
          if (draggedNodeRef.current) {
            draggedNodeRef.current.fx = null;
            draggedNodeRef.current.fy = null;
            draggedNodeRef.current = null;
          }
          setIsPanning(false);
        }}
        onWheel={handleWheel}
        onClick={handleClick}
      />

      {/* Node tooltip on hover */}
      <AnimatePresence>
        {hoveredNode && !selectedNode && (() => {
          const node = nodesRef.current.find(n => n.id === hoveredNode);
          if (!node || node.x == null || node.y == null) return null;
          
          // Project tooltips relative to translated/scaled layout viewport coordinates
          const tipX = Math.max(10, Math.min(node.x * transform.scale + transform.x + 20, width - 190));
          const tipY = Math.max(10, Math.min(node.y * transform.scale + transform.y - 10, height - 120));
          
          return (
            <motion.div
              key={hoveredNode}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "absolute", left: tipX, top: tipY,
                background: "rgba(6,10,22,0.95)", border: `1px solid ${node.color}40`,
                borderRadius: 10, padding: "10px 14px", pointerEvents: "none",
                backdropFilter: "blur(12px)", width: 170, zIndex: 10,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: node.color, marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {node.label}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                {node.line_count} lines · {node.filename}
              </div>
              {node.excerpt && (
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>
                  {node.excerpt.slice(0, 80)}...
                </div>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Selected node detail panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            key="selected-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute", bottom: 12, left: 12, right: 12,
              background: "rgba(6,10,22,0.95)", border: `1px solid ${selectedNode.color}40`,
              borderRadius: 12, padding: "14px 16px", backdropFilter: "blur(16px)", zIndex: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: selectedNode.color, marginBottom: 2 }}>
                  {selectedNode.label}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                  {selectedNode.filename} · {selectedNode.line_count} lines
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14 }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, maxHeight: 60, overflow: "hidden" }}>
              {selectedNode.excerpt}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>
              Last modified: {new Date(selectedNode.modified_at).toLocaleString()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Static fallback graph (for when backend is offline) ─────────
export function BrainGraphFallback() {
  const fallbackNodes: BrainNode[] = [
    { id: "memory",             label: "Memory System",       filename: "memory.md",             size: 16, color: "#00d4ff", modified_at: new Date().toISOString(), line_count: 42, excerpt: "Central repository of active learnings, factual extractions, and operator notes..." },
    { id: "tasks",              label: "Task Director",       filename: "tasks.md",              size: 14, color: "#10b981", modified_at: new Date().toISOString(), line_count: 24, excerpt: "Persistent tracking of active system directives, sub-agent workloads, and user reminders..." },
    { id: "personality",        label: "Core Personality",    filename: "personality.md",        size: 12, color: "#8b5cf6", modified_at: new Date().toISOString(), line_count: 18, excerpt: "Custom communication profiles, interactive behaviors, and voice engine configuration..." },
    { id: "context",            label: "Active Context",      filename: "context.md",            size: 18, color: "#f59e0b", modified_at: new Date().toISOString(), line_count: 65, excerpt: "Project stack details, live socket port addresses, and active workspace references..." },
    { id: "registry",           label: "Tool Registry",       filename: "registry.md",           size: 11, color: "#00d4ff", modified_at: new Date().toISOString(), line_count: 15, excerpt: "Registered local tools, authorization tokens, calendar mappings, and credentials..." },
    { id: "proactive",          label: "Proactive Loop",      filename: "proactive.md",          size: 13, color: "#10b981", modified_at: new Date().toISOString(), line_count: 31, excerpt: "Scheduled cron events, background triggers, and user message context scanners..." },
    { id: "sessions",           label: "Session Manager",     filename: "sessions.md",           size: 15, color: "#3b82f6", modified_at: new Date().toISOString(), line_count: 52, excerpt: "Recent active channels, workspace directories, and past operator chat transcripts..." },
    { id: "calibration",        label: "Health Calibrator",   filename: "calibration.md",        size: 10, color: "#8b5cf6", modified_at: new Date().toISOString(), line_count: 12, excerpt: "Ollama connection latency metrics, active processes, and model memory load logs..." },
    { id: "skills",             label: "Skill Knowledge",     filename: "skills.md",             size: 13, color: "#f59e0b", modified_at: new Date().toISOString(), line_count: 28, excerpt: "Trained system commands, prompt bypass rules, and learned user command frequencies..." },
    { id: "learned_experience", label: "Learned Experience",  filename: "learned_experience.md", size: 15, color: "#8b5cf6", modified_at: new Date().toISOString(), line_count: 22, excerpt: "Summary of AURA's recent state, wins (successes), and failures (learnings)..." }
  ];

  const fallbackEdges: BrainEdge[] = [
    { source: "context",            target: "tasks",              type: "mention" },
    { source: "context",            target: "memory",             type: "mention" },
    { source: "memory",             target: "personality",        type: "mention" },
    { source: "tasks",              target: "memory",             type: "wiki_link" },
    { source: "registry",           target: "context",            type: "wiki_link" },
    { source: "proactive",          target: "registry",           type: "mention" },
    { source: "proactive",          target: "memory",             type: "mention" },
    { source: "proactive",          target: "learned_experience", type: "wiki_link" },
    { source: "sessions",           target: "context",            type: "mention" },
    { source: "sessions",           target: "memory",             type: "wiki_link" },
    { source: "calibration",        target: "proactive",          type: "mention" },
    { source: "skills",             target: "personality",        type: "mention" },
    { source: "skills",             target: "registry",           type: "wiki_link" },
    { source: "skills",             target: "learned_experience", type: "wiki_link" },
    { source: "learned_experience", target: "context",            type: "wiki_link" },
    { source: "learned_experience", target: "registry",           type: "wiki_link" },
    { source: "learned_experience", target: "calibration",        type: "wiki_link" }
  ];

  return <NeuralBrainGraph nodes={fallbackNodes} edges={fallbackEdges} />;
}
