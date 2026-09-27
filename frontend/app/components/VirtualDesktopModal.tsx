"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Folder, Image as ImageIcon, FileText, Code as CodeIcon, Archive, 
  X, RefreshCw, Trash2, Download, Search, HardDrive, Maximize2, Minimize2, ExternalLink
} from "lucide-react";

interface DesktopFile {
  id: string;
  name: string;
  filename: string;
  category: string;
  path: string;
  relative_url: string;
  size_bytes: number;
  created_at: string;
  source_tool: string;
  metadata?: any;
}

interface VirtualDesktopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function VirtualDesktopModal({ isOpen, onClose }: VirtualDesktopModalProps) {
  const [files, setFiles] = useState<DesktopFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<DesktopFile | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (searchQuery) params.append("search", searchQuery);

      let res = await fetch(`${API_BASE}/api/desktop/files?${params.toString()}`).catch(() => null);
      if (!res || !res.ok) {
        const fallbackBase = API_BASE.includes(":10000") ? API_BASE.replace(":10000", ":8000") : "http://localhost:8000";
        res = await fetch(`${fallbackBase}/api/desktop/files?${params.toString()}`).catch(() => null);
      }
      if (res && res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error("Failed to fetch Virtual Desktop files:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen, selectedCategory, searchQuery]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this file from Virtual Desktop?")) return;

    try {
      let res = await fetch(`${API_BASE}/api/desktop/file/${id}`, { method: "DELETE" }).catch(() => null);
      if (!res || !res.ok) {
        const fallbackBase = API_BASE.includes(":10000") ? API_BASE.replace(":10000", ":8000") : "http://localhost:8000";
        res = await fetch(`${fallbackBase}/api/desktop/file/${id}`, { method: "DELETE" }).catch(() => null);
      }
      if (res && res.ok) {
        setFiles(prev => prev.filter(f => f.id !== id));
        if (selectedFile?.id === id) setSelectedFile(null);
      }
    } catch (err) {
      console.error("Failed to delete file:", err);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getIcon = (category: string) => {
    switch (category) {
      case "images": return <ImageIcon style={{ width: 32, height: 32, color: "#38bdf8" }} />;
      case "code": return <CodeIcon style={{ width: 32, height: 32, color: "#a855f7" }} />;
      case "documents": return <FileText style={{ width: 32, height: 32, color: "#34d399" }} />;
      default: return <Archive style={{ width: 32, height: 32, color: "#f59e0b" }} />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none"
      }}>
        <motion.div
          drag={!isMaximized}
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          style={{
            pointerEvents: "auto",
            width: isMaximized ? "95vw" : "850px",
            height: isMaximized ? "90vh" : "560px",
            backgroundColor: "#16171a",
            border: "1px solid #2b2e38",
            borderRadius: "10px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.05)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            color: "#e2e8f0",
            fontFamily: "Inter, system-ui, sans-serif"
          }}
        >
          {/* OS Window Titlebar */}
          <div style={{
            height: "42px",
            backgroundColor: "#1f2126",
            borderBottom: "1px solid #2b2e38",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            cursor: isMaximized ? "default" : "grab",
            userSelect: "none"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <HardDrive style={{ width: 18, height: 18, color: "#38bdf8" }} />
              <span style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.5px", color: "#f1f5f9" }}>
                AURA Virtual Desktop — Storage Explorer
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                style={{
                  background: "none", border: "none", color: "#94a3b8", cursor: "pointer",
                  padding: "4px", borderRadius: "4px", display: "flex"
                }}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: "#ef444422", border: "1px solid #ef444444", color: "#f87171", cursor: "pointer",
                  padding: "4px 8px", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* OS Explorer Bar */}
          <div style={{
            height: "48px",
            backgroundColor: "#1a1c21",
            borderBottom: "1px solid #2b2e38",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px"
          }}>
            {/* Folder Filters */}
            <div style={{ display: "flex", gap: "8px" }}>
              {[
                { id: "all", label: "All Files", icon: Folder },
                { id: "images", label: "Images", icon: ImageIcon },
                { id: "documents", label: "Documents", icon: FileText },
                { id: "code", label: "Code", icon: CodeIcon },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    backgroundColor: selectedCategory === cat.id ? "#2563eb" : "#242730",
                    color: selectedCategory === cat.id ? "#ffffff" : "#94a3b8",
                    border: "1px solid " + (selectedCategory === cat.id ? "#3b82f6" : "#2d313c"),
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer"
                  }}
                >
                  <cat.icon size={14} />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search & Refresh */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "9px", color: "#64748b" }} />
                <input
                  type="text"
                  placeholder="Search Desktop..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    backgroundColor: "#111215",
                    border: "1px solid #2d313c",
                    borderRadius: "6px",
                    padding: "6px 10px 6px 30px",
                    fontSize: "12px",
                    color: "#e2e8f0",
                    width: "180px",
                    outline: "none"
                  }}
                />
              </div>
              <button
                onClick={fetchFiles}
                style={{
                  backgroundColor: "#242730", border: "1px solid #2d313c", color: "#94a3b8",
                  padding: "6px 10px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center"
                }}
              >
                <RefreshCw size={14} className={loading ? "spin" : ""} />
              </button>
            </div>
          </div>

          {/* Desktop Content Grid */}
          <div style={{
            flex: 1,
            backgroundColor: "#141518",
            padding: "20px",
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: "16px",
            alignContent: "start"
          }}>
            {files.length === 0 ? (
              <div style={{
                gridColumn: "1 / -1",
                height: "220px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b"
              }}>
                <Folder size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                <span style={{ fontSize: "14px", fontWeight: 500 }}>No files in Virtual Desktop yet</span>
                <span style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                  Generated images and documents automatically save here
                </span>
              </div>
            ) : (
              files.map(file => (
                <div
                  key={file.id}
                  onClick={() => setSelectedFile(file)}
                  style={{
                    backgroundColor: selectedFile?.id === file.id ? "#1e293b" : "#1c1e24",
                    border: "1px solid " + (selectedFile?.id === file.id ? "#3b82f6" : "#282b35"),
                    borderRadius: "8px",
                    padding: "12px 10px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ marginBottom: "8px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {file.category === "images" ? (
                      <img
                        src={`${API_BASE}/api/desktop/file/${file.id}`}
                        alt={file.name}
                        style={{ width: "42px", height: "42px", objectFit: "cover", borderRadius: "4px", border: "1px solid #334155" }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      getIcon(file.category)
                    )}
                  </div>

                  <span style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#cbd5e1",
                    textAlign: "center",
                    wordBreak: "break-word",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    lineHeight: 1.3
                  }}>
                    {file.name}
                  </span>

                  <span style={{ fontSize: "9px", color: "#64748b", marginTop: "4px" }}>
                    {formatSize(file.size_bytes)}
                  </span>

                  <button
                    onClick={(e) => handleDelete(file.id, e)}
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      opacity: 0.6,
                      padding: "2px"
                    }}
                    title="Delete File"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Bottom Desktop Status Bar */}
          <div style={{
            height: "32px",
            backgroundColor: "#1a1c21",
            borderTop: "1px solid #2b2e38",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            fontSize: "11px",
            color: "#64748b"
          }}>
            <span>{files.length} Item{files.length !== 1 ? "s" : ""} on Virtual Desktop</span>
            {selectedFile && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span>Selected: <strong style={{ color: "#94a3b8" }}>{selectedFile.name}</strong></span>
                <a
                  href={`${API_BASE}/api/desktop/file/${selectedFile.id}`}
                  target="_blank"
                  download={selectedFile.name}
                  style={{ color: "#38bdf8", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Download size={12} /> Download
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
