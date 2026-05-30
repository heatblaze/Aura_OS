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
    // Initialize nodes with random positions if not set
    nodesRef.current = nodes.map((n, i) => ({
      ...n,
      x: n.x ?? width / 2 + (Math.random() - 0.5) * width * 0.6,
      y: n.y ?? height / 2 + (Math.random() - 0.5) * height * 0.6,
      vx: n.vx ?? 0,
      vy: n.vy ?? 0,
      fx: null,
      fy: null,
    }));
    edgesRef.current = edges;
  }, [nodes, edges, width, height]);

  const simulate = useCallback(() => {
    const ns = nodesRef.current;
    if (ns.length === 0) return;

    const alpha = 0.3;
    const repulsion = 2200;
    const linkStrength = 0.15;
    const linkDistance = 120;
    const centerStrength = 0.02;
    const damping = 0.85;

    // Repulsion (each node repels all others)
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j].x! - ns[i].x!;
        const dy = ns[j].y! - ns[i].y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
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
      if (n.fx != null) { n.x = n.fx; n.vx = 0; continue; }
      n.vx! *= damping;
      n.vy! *= damping;
      n.x = Math.max(30, Math.min(width - 30, n.x! + n.vx!));
      n.y = Math.max(30, Math.min(height - 30, n.y! + n.vy!));
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
  width = 600,
  height = 400,
  onNodeClick,
}: NeuralBrainGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<BrainNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const nodesRef = useForceSimulation(nodes, edges, width, height);
  const animTimeRef = useRef(0);

  // ── Canvas Render ──────────────────────────────────────────────
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

    animTimeRef.current += 0.02;
    const t = animTimeRef.current;
    const ns = nodesRef.current;
    const nodeMap = new Map(ns.map(n => [n.id, n]));

    // Draw edges
    for (const edge of edges) {
      const s = nodeMap.get(edge.source);
      const tg = nodeMap.get(edge.target);
      if (!s || !tg || s.x == null || s.y == null || tg.x == null || tg.y == null) continue;

      const isActiveEdge =
        hoveredNode === edge.source || hoveredNode === edge.target ||
        activeNodeId === edge.source || activeNodeId === edge.target;

      const alpha = isActiveEdge ? 0.5 : 0.12;
      const lineWidth = isActiveEdge ? 1.5 : 0.5;

      // Gradient line
      const grad = ctx.createLinearGradient(s.x, s.y, tg.x, tg.y);
      grad.addColorStop(0, `${s.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
      grad.addColorStop(1, `${tg.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tg.x, tg.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Animated pulse along active edges
      if (isActiveEdge) {
        const pulseProgress = (t * 0.8) % 1;
        const px = s.x + (tg.x - s.x) * pulseProgress;
        const py = s.y + (tg.y - s.y) * pulseProgress;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = 0.8 * (1 - pulseProgress);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Draw nodes
    for (const node of ns) {
      if (node.x == null || node.y == null) continue;

      const isHovered = hoveredNode === node.id;
      const isActive = activeNodeId === node.id;
      const isSelected = selectedNode?.id === node.id;
      const radius = (node.size || 10) + (isHovered || isActive ? 4 : 0);

      // Outer glow
      const glowRadius = radius * 2.5;
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
      const glowAlpha = isHovered || isActive ? 0.35 : 0.12;
      glow.addColorStop(0, `${node.color}${Math.round(glowAlpha * 255).toString(16).padStart(2, "0")}`);
      glow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Pulsing ring for active state
      if (isActive || isSelected) {
        const pulseRadius = radius + 4 + Math.sin(t * 3) * 3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${node.color}60`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Node fill
      const fill = ctx.createRadialGradient(
        node.x - radius * 0.3, node.y - radius * 0.3, 0,
        node.x, node.y, radius
      );
      fill.addColorStop(0, isHovered || isActive ? node.color : `${node.color}CC`);
      fill.addColorStop(1, `${node.color}66`);

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();

      // Node border
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isHovered || isActive ? node.color : `${node.color}80`;
      ctx.lineWidth = isHovered || isActive ? 2 : 1;
      ctx.stroke();

      // Label
      const labelAlpha = isHovered || isActive ? 1 : 0.65;
      ctx.globalAlpha = labelAlpha;
      ctx.font = `${isHovered || isActive ? 600 : 500} ${isHovered ? 11 : 10}px Inter, sans-serif`;
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, node.x, node.y + radius + 12);
      ctx.globalAlpha = 1;
    }
  });

  // ── Hit Detection ──────────────────────────────────────────────
  const getNodeAtPoint = useCallback((x: number, y: number): BrainNode | null => {
    const ns = nodesRef.current;
    for (const node of [...ns].reverse()) {
      if (node.x == null || node.y == null) continue;
      const radius = (node.size || 10) + 4;
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) return node;
    }
    return null;
  }, [nodesRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
    const node = getNodeAtPoint(x, y);
    setHoveredNode(node?.id || null);
    e.currentTarget.style.cursor = node ? "pointer" : "default";
  }, [getNodeAtPoint]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = getNodeAtPoint(x, y);
    if (node) {
      setSelectedNode(prev => prev?.id === node.id ? null : node);
      onNodeClick?.(node);
    } else {
      setSelectedNode(null);
    }
  }, [getNodeAtPoint, onNodeClick]);

  return (
    <div style={{ position: "relative", width, height }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, display: "block", borderRadius: 12 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
        onClick={handleClick}
      />

      {/* Node tooltip on hover */}
      <AnimatePresence>
        {hoveredNode && !selectedNode && (() => {
          const node = nodesRef.current.find(n => n.id === hoveredNode);
          if (!node || node.x == null || node.y == null) return null;
          const tipX = Math.min(node.x + 20, width - 180);
          const tipY = Math.min(node.y - 10, height - 100);
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
                backdropFilter: "blur(12px)", maxWidth: 180, zIndex: 10,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: node.color, marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {node.label}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                {node.line_count} lines · {node.filename}
              </div>
              {node.excerpt && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>
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
export function BrainGraphFallback({ width = 600, height = 280 }: { width?: number; height?: number }) {
  const fallbackNodes: BrainNode[] = [
    { id: "memory",      label: "Memory",      filename: "memory.md",      size: 16, color: "#00d4ff", modified_at: "", line_count: 12, excerpt: "Ongoing facts and learnings..." },
    { id: "tasks",       label: "Tasks",       filename: "tasks.md",       size: 14, color: "#10b981", modified_at: "", line_count: 8,  excerpt: "Active and completed tasks..." },
    { id: "personality", label: "Personality", filename: "personality.md", size: 12, color: "#8b5cf6", modified_at: "", line_count: 10, excerpt: "User preferences and style..." },
    { id: "context",     label: "Context",     filename: "context.md",     size: 18, color: "#f59e0b", modified_at: "", line_count: 20, excerpt: "Current project context..." },
  ];
  const fallbackEdges: BrainEdge[] = [
    { source: "context", target: "tasks",       type: "mention" },
    { source: "context", target: "memory",      type: "mention" },
    { source: "memory",  target: "personality", type: "mention" },
    { source: "tasks",   target: "memory",      type: "wiki_link" },
  ];

  return <NeuralBrainGraph nodes={fallbackNodes} edges={fallbackEdges} width={width} height={height} />;
}
