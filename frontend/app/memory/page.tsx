"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Brain, Link2, Layers, HardDrive, RefreshCw, FileText, Clock, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NeuralBrainGraph, BrainGraphFallback, BrainNode, BrainEdge } from "../components/NeuralBrainGraph";

const API_BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") : "http://localhost:8000";

interface BrainFile {
  name: string;
  filename: string;
  content: string;
  size_bytes: number;
  modified_at: string;
  line_count: number;
}

interface GraphData {
  nodes: BrainNode[];
  edges: BrainEdge[];
  file_count: number;
}

const FILE_COLORS: Record<string, string> = {
  memory:      "#00d4ff",
  tasks:       "#10b981",
  personality: "#8b5cf6",
  context:     "#f59e0b",
  registry:    "#00d4ff",
  proactive:   "#10b981",
  sessions:    "#3b82f6",
  calibration: "#8b5cf6",
  skills:      "#f59e0b",
};

export default function MemoryPage() {
  const [mounted,       setMounted]      = useState(false);
  const [graphData,     setGraphData]    = useState<GraphData | null>(null);
  const [brainFiles,    setBrainFiles]   = useState<BrainFile[]>([]);
  const [selectedNode,  setSelectedNode] = useState<BrainNode | null>(null);
  const [selectedFile,  setSelectedFile] = useState<BrainFile | null>(null);
  const [loading,       setLoading]      = useState(true);
  const [error,         setError]        = useState<string | null>(null);
  const [searchQuery,   setSearchQuery]  = useState("");
  const [lastRefresh,   setLastRefresh]  = useState<Date>(new Date());

  const fetchBrainData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [graphRes, filesRes] = await Promise.all([
        fetch(`${API_BASE}/brain/graph`),
        fetch(`${API_BASE}/brain`),
      ]);
      if (!graphRes.ok || !filesRes.ok) throw new Error("Backend unreachable");
      const graph: GraphData = await graphRes.json();
      const files: { files: BrainFile[] } = await filesRes.json();
      setGraphData(graph);
      setBrainFiles(files.files);
      setLastRefresh(new Date());
    } catch (e) {
      setError("Backend offline — showing sample brain structure");
      setGraphData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchBrainData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBrainData, 30000);
    return () => clearInterval(interval);
  }, [fetchBrainData]);

  const handleNodeClick = useCallback((node: BrainNode) => {
    setSelectedNode(node);
    const file = brainFiles.find(f => f.name === node.id);
    setSelectedFile(file || null);
  }, [brainFiles]);

  // Stats derived from real data
  const stats = [
    { label: "Brain Files",  value: graphData?.file_count ?? brainFiles.length ?? 4, sub: "Active",  icon: Brain,     color: "#00d4ff" },
    { label: "Connections",  value: graphData?.edges.length ?? 0,                     sub: "Links",   icon: Link2,     color: "#8b5cf6" },
    { label: "Memory Lines", value: brainFiles.reduce((acc, f) => acc + f.line_count, 0) || "—",     sub: "Indexed", icon: Layers,    color: "#3b82f6" },
    { label: "Last Refresh", value: lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), sub: "Updated", icon: Clock, color: "#10b981" },
  ];

  // Filtered files for the list panel
  const filteredFiles = brainFiles.filter(f =>
    searchQuery ? f.name.includes(searchQuery.toLowerCase()) || f.content.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }} className="scrollbar-hide">
        {/* Title & Controls (Navbar Dissolved Inline) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "white", letterSpacing: "-0.02em", marginBottom: 2 }}>Neuralink Brain</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Live visualization of AURA&apos;s persistent memory network.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
            }}>
              <Search style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
              <input
                placeholder="Search brain..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ background: "none", border: "none", outline: "none", color: "white", fontSize: 12, width: 140, fontFamily: "'Inter', sans-serif" }}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={fetchBrainData}
              disabled={loading}
              title="Refresh brain data"
              style={{
                width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text-muted)",
              }}
            >
              <motion.div animate={{ rotate: loading ? 360 : 0 }} transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: "linear" }}>
                <RefreshCw style={{ width: 14, height: 14 }} />
              </motion.div>
            </motion.button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
          {stats.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="stat-card" style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: "14px 16px" }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: `${s.color}12`, border: `1px solid ${s.color}22`,
                display: "flex", alignItems: "center", justifyContent: "center", color: s.color,
              }}>
                <s.icon style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 14, padding: "10px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, fontSize: 12, color: "rgba(239,68,68,0.8)" }}>
              ⚠ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Neural Graph + File List */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, marginBottom: 16 }}>

          {/* Neural Brain Graph */}
          <div className="glass-card" style={{ minHeight: 520, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
              <div className="section-header" style={{ marginBottom: 0 }}>Neural Brain Graph</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {graphData ? `${graphData.nodes.length} nodes · ${graphData.edges.length} edges` : "Sample Data"}
                </span>
                <ArrowUpRight style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
              </div>
            </div>
            {mounted && (
              <div style={{ flex: 1, width: "100%", minHeight: 400, position: "relative" }}>
                {graphData && graphData.nodes.length > 0 ? (
                  <NeuralBrainGraph
                    nodes={graphData.nodes}
                    edges={graphData.edges}
                    activeNodeId={selectedNode?.id}
                    onNodeClick={handleNodeClick}
                  />
                ) : (
                  <BrainGraphFallback />
                )}
              </div>
            )}
            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", marginTop: 12, flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
              {Object.entries(FILE_COLORS).map(([name, color]) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
                  <span style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "capitalize" }}>{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Brain Files List + Selected File Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* File List */}
            <div className="glass-card" style={{ flex: 1 }}>
              <div className="section-header">Brain Files</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(filteredFiles.length > 0 ? filteredFiles : brainFiles.slice(0, 4)).map((file, i) => {
                  const color = FILE_COLORS[file.name] || "#3b82f6";
                  const isSelected = selectedFile?.name === file.name;
                  return (
                    <motion.button key={i}
                      whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedFile(file);
                        setSelectedNode(null);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                        borderRadius: 8, border: `1px solid ${isSelected ? color + "40" : "transparent"}`,
                        background: isSelected ? `${color}08` : "transparent",
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "white" }}>{file.name}.md</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{file.line_count} lines</div>
                      </div>
                      <FileText style={{ width: 12, height: 12, color: "var(--text-muted)" }} />
                    </motion.button>
                  );
                })}
                {brainFiles.length === 0 && !loading && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                    Start the backend to load brain files
                  </div>
                )}
              </div>
            </div>

            {/* Selected File Preview */}
            <AnimatePresence mode="wait">
              {(selectedFile || selectedNode) && (
                <motion.div key={selectedFile?.name || selectedNode?.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="glass-card" style={{ maxHeight: 180, overflow: "hidden" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: FILE_COLORS[selectedFile?.name || selectedNode?.id || ""] || "#3b82f6", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    {selectedFile?.filename || selectedNode?.filename}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6, overflow: "hidden", maxHeight: 120, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {selectedFile?.content.slice(0, 300) || selectedNode?.excerpt}...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Raw Brain Content Viewer */}
        {selectedFile && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="section-header" style={{ marginBottom: 0 }}>
                {selectedFile.filename}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Modified: {new Date(selectedFile.modified_at).toLocaleString()}
                </span>
                <button onClick={() => setSelectedFile(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
            </div>
            <pre style={{
              fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.7,
              fontFamily: "'Fira Code', 'Cascadia Code', monospace",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: 300, overflowY: "auto", padding: "12px 14px",
              background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)",
            }} className="scrollbar-hide">
              {selectedFile.content}
            </pre>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="system-footer" style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="footer-label">Brain Status</span>
            <span className="footer-value" style={{ color: graphData ? "var(--accent-green)" : "var(--accent-red)" }}>
              {graphData ? "Live" : "Offline"}
            </span>
          </div>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {graphData?.file_count ?? 0} files · {graphData?.edges.length ?? 0} connections
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="footer-label">Operator</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "white" }}>AURA</span>
        </div>
      </div>
    </div>
  );
}
