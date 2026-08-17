"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BarChart2, Table, TrendingUp, Code2, Layers, Info } from "lucide-react";
import { VizData } from "@/lib/types";

interface VisualDataPanelProps {
  data: VizData | null;
  onClose: () => void;
}

// ── Agent color palette (matching COWORKER_THEMES) ─────────────
const AGENT_COLORS: Record<string, string> = {
  jarvis:  "#00d4ff",
  bobby:   "#8b5cf6",
  claire:  "#cbd5e1",
  sarah:   "#10b981",
  elena:   "#f43f5e",
  marcus:  "#fbbf24",
  lex:     "#4f46e5",
  mia:     "#14b8a6",
};

function agentColor(agent: string): string {
  return AGENT_COLORS[agent.toLowerCase()] || "#00d4ff";
}

// ── Hex to rgb helper ─────────────────────────────────────────
function hexToRgb(hex: string): string {
  const c = hex.replace("#", "");
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

// ────────────────────────────────────────────────────────────────
// Sub-renderers
// ────────────────────────────────────────────────────────────────

function BarChartRenderer({ rows, color }: { rows: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {rows.map((row, i) => {
        const pct = (row.value / max) * 100;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
                {row.label}
              </span>
              <span style={{ fontSize: "12px", color, fontWeight: 700, fontFamily: "monospace" }}>
                {row.value.toLocaleString()}
              </span>
            </div>
            <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: [0.34, 1.56, 0.64, 1] }}
                style={{
                  height: "100%",
                  borderRadius: "4px",
                  background: `linear-gradient(90deg, ${color}, rgba(${hexToRgb(color)},0.5))`,
                  boxShadow: `0 0 8px rgba(${hexToRgb(color)},0.4)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricCardsRenderer({ metrics, color }: { metrics: { label: string; value: string | number; unit?: string }[]; color: string }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: metrics.length > 4 ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
      gap: "10px",
    }}>
      {metrics.map((m, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.06 }}
          style={{
            padding: "14px 12px",
            borderRadius: "12px",
            background: `rgba(${hexToRgb(color)}, 0.06)`,
            border: `1px solid rgba(${hexToRgb(color)}, 0.15)`,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {m.label}
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
            <span style={{ fontSize: "22px", fontWeight: 700, color, fontFamily: "monospace" }}>
              {typeof m.value === "number" ? m.value.toLocaleString() : m.value}
            </span>
            {m.unit && (
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{m.unit}</span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TableRenderer({ headers, rows, color }: { headers: string[]; rows: string[][]; color: string }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr style={{ background: `rgba(${hexToRgb(color)}, 0.1)` }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: "8px 12px",
                textAlign: "left",
                color,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontSize: "10px",
                borderBottom: `1px solid rgba(${hexToRgb(color)}, 0.2)`,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <motion.tr
              key={ri}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: ri * 0.04 }}
              style={{
                background: ri % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: "8px 12px",
                  color: ci === 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.55)",
                  fontFamily: ci > 0 ? "monospace" : "inherit",
                }}>
                  {cell}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeRenderer({ code, color }: { code: string; color: string }) {
  return (
    <pre style={{
      padding: "16px",
      borderRadius: "10px",
      background: "rgba(0,0,0,0.35)",
      border: `1px solid rgba(${hexToRgb(color)}, 0.15)`,
      fontSize: "11px",
      color: "rgba(255,255,255,0.7)",
      fontFamily: "monospace",
      overflowX: "auto",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      lineHeight: 1.6,
      maxHeight: "280px",
      overflowY: "auto",
    }}>
      {code}
    </pre>
  );
}

function InfoRenderer({ text, color }: { text: string; color: string }) {
  return (
    <div style={{
      fontSize: "13px",
      color: "rgba(255,255,255,0.85)",
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      padding: "16px",
      borderRadius: "10px",
      background: "rgba(255,255,255,0.02)",
      border: `1px solid rgba(${hexToRgb(color)}, 0.15)`,
    }}>
      {text}
    </div>
  );
}

function ImageRenderer({ imageUrl, prompt, color }: { imageUrl: string; prompt?: string; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
      {prompt && (
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", margin: 0, textAlign: "center", fontStyle: "italic" }}>
          "{prompt}"
        </p>
      )}
      <div style={{
        borderRadius: "14px", overflow: "hidden", border: `1px solid rgba(${hexToRgb(color)}, 0.3)`,
        boxShadow: `0 0 24px rgba(${hexToRgb(color)}, 0.25)`, background: "#000", width: "100%", maxHeight: "380px", display: "flex", justifyContent: "center"
      }}>
        <img src={imageUrl} alt={prompt || "Visual Design"} style={{ maxWidth: "100%", maxHeight: "380px", objectFit: "contain" }} />
      </div>
    </div>
  );
}

function LineChartRenderer({ points, color }: { points: { label: string; value: number }[]; color: string }) {
  if (points.length < 2) return <BarChartRenderer rows={points} color={color} />;
  const max = Math.max(...points.map(p => p.value));
  const min = Math.min(...points.map(p => p.value));
  const range = max - min || 1;
  const W = 460;
  const H = 120;
  const padX = 30;
  const padY = 15;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;
  const coords = points.map((p, i) => ({
    x: padX + (i / (points.length - 1)) * plotW,
    y: padY + (1 - (p.value - min) / range) * plotH,
  }));
  const pathD = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const fillD = `${pathD} L${coords[coords.length-1].x.toFixed(1)},${(padY + plotH).toFixed(1)} L${padX},${(padY + plotH).toFixed(1)} Z`;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            y1={padY + t * plotH}
            x2={W - padX}
            y2={padY + t * plotH}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="4,4"
          />
        ))}
        {/* Fill */}
        <path d={fillD} fill="url(#lineFill)" />
        {/* Line */}
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
          style={{ filter: `drop-shadow(0 0 5px ${color})` }}
        />
        {/* Dots + labels */}
        {coords.map((c, i) => (
          <g key={i}>
            <motion.circle
              cx={c.x}
              cy={c.y}
              r="4"
              fill={color}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + i * 0.06 }}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
            <text
              x={c.x}
              y={H - 2}
              textAnchor="middle"
              fontSize="8"
              fill="rgba(255,255,255,0.4)"
             >
               {points[i].label.substring(0, 6)}
             </text>
           </g>
        ))}
      </svg>
    </div>
  );
}

// ── Type icon mapping ─────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  chart:   BarChart2,
  table:   Table,
  metrics: Layers,
  code:    Code2,
  line:    TrendingUp,
  info:    Info,
};

// ── Main Component ────────────────────────────────────────────
export default function VisualDataPanel({ data, onClose }: VisualDataPanelProps) {
  if (!data) return null;

  const color = agentColor(data.agent);
  const IconComp = TYPE_ICONS[data.type] || BarChart2;

  return (
    <AnimatePresence>
      {data && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9991,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {/* Panel */}
          <motion.div
            key="viz-panel"
            drag
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: "min(580px, 90vw)",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                background: "rgba(8, 10, 20, 0.90)",
                backdropFilter: "blur(28px)",
                WebkitBackdropFilter: "blur(28px)",
                borderRadius: "22px",
                border: `1px solid rgba(${hexToRgb(color)}, 0.25)`,
                boxShadow: `0 12px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 60px rgba(${hexToRgb(color)},0.08)`,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                maxHeight: "80vh",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: `1px solid rgba(${hexToRgb(color)}, 0.12)`,
                  background: `rgba(${hexToRgb(color)}, 0.05)`,
                  flexShrink: 0,
                  cursor: "grab",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "10px",
                      background: `rgba(${hexToRgb(color)}, 0.15)`,
                      border: `1px solid rgba(${hexToRgb(color)}, 0.3)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconComp size={16} color={color} />
                  </div>
                  <div>
                    <div style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "white",
                      lineHeight: 1.2,
                    }}>
                      {data.title}
                    </div>
                    <div style={{
                      fontSize: "11px",
                      color,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontFamily: "monospace",
                      opacity: 0.8,
                    }}>
                      {data.agent} · Visual Report
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    padding: "6px 8px",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.5)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Content area */}
              <div style={{
                padding: "20px",
                overflowY: "auto",
                flex: 1,
              }}>
                {/* Subtitle / description */}
                {data.description && (
                  <p style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: "16px",
                    lineHeight: 1.6,
                    borderLeft: `2px solid rgba(${hexToRgb(color)},0.4)`,
                    paddingLeft: "10px",
                  }}>
                    {data.description}
                  </p>
                )}

                {/* Render by type */}
                {data.type === "chart" && data.rows && (
                  <BarChartRenderer rows={data.rows} color={color} />
                )}
                {data.type === "line" && data.rows && (
                  <LineChartRenderer points={data.rows} color={color} />
                )}
                {data.type === "metrics" && data.metrics && (
                  <MetricCardsRenderer metrics={data.metrics} color={color} />
                )}
                {data.type === "table" && data.headers && data.tableRows && (
                  <TableRenderer headers={data.headers} rows={data.tableRows} color={color} />
                )}
                {data.type === "code" && data.code && (
                  <CodeRenderer code={data.code} color={color} />
                )}
                {data.type === "info" && data.code && (
                  <InfoRenderer text={data.code} color={color} />
                )}
                {(data.type === "image" || (data as any).imageUrl) && (
                  <ImageRenderer imageUrl={(data as any).imageUrl || (data as any).code || ""} prompt={data.title} color={color} />
                )}

                {/* Mixed: metrics + chart */}
                {data.type === "mixed" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {data.metrics && <MetricCardsRenderer metrics={data.metrics} color={color} />}
                    {data.rows && <BarChartRenderer rows={data.rows} color={color} />}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "10px 20px",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                  background: "rgba(0,0,0,0.15)",
                }}
              >
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
                  AURA VISUAL INTELLIGENCE ENGINE
                </span>
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 5px ${color}`,
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
