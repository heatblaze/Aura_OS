"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minimize2, Mic, MicOff, Users } from "lucide-react";

interface AgentCard {
  name: string;
  role: string;
  color: string;
  initials: string;
}

const AGENT_ROSTER: AgentCard[] = [
  { name: "Jarvis",  role: "Core Orchestrator",   color: "#00d4ff", initials: "JV" },
  { name: "Bobby",   role: "Growth Specialist",    color: "#8b5cf6", initials: "BB" },
  { name: "Claire",  role: "Systems Engineer",     color: "#cbd5e1", initials: "CL" },
  { name: "Sarah",   role: "Support Assistant",    color: "#10b981", initials: "SR" },
  { name: "Elena",   role: "Creative Director",    color: "#f43f5e", initials: "EL" },
  { name: "Marcus",  role: "Financial Analyst",    color: "#fbbf24", initials: "MC" },
  { name: "Lex",     role: "Security Guard",       color: "#4f46e5", initials: "LX" },
  { name: "Mia",     role: "Product Planner",      color: "#14b8a6", initials: "MI" },
];

interface ConferenceMeetingModalProps {
  isOpen: boolean;
  currentSpeaker: string | null;
  isListening: boolean;
  toggleListening: () => void;
  sendMessage: (text: string) => void;
  onClose: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

// Waveform animation — pure SVG, no deps
function MicWaveform({ color }: { color: string }) {
  const bars = [3, 6, 10, 7, 4, 9, 5, 8, 3, 7];
  return (
    <svg width="36" height="14" viewBox="0 0 36 14" style={{ display: "inline-block" }}>
      {bars.map((h, i) => (
        <motion.rect
          key={i}
          x={i * 4}
          y={(14 - h) / 2}
          width="2.5"
          height={h}
          rx="1.2"
          fill={color}
          animate={{ scaleY: [1, 1.8, 0.6, 1.4, 1] }}
          transition={{
            repeat: Infinity,
            duration: 0.6 + i * 0.05,
            delay: i * 0.06,
            ease: "easeInOut",
          }}
          style={{ transformOrigin: "center center" }}
        />
      ))}
    </svg>
  );
}

export default function ConferenceMeetingModal({
  isOpen,
  currentSpeaker,
  isListening,
  toggleListening,
  sendMessage,
  onClose,
  isMinimized,
  onToggleMinimize,
}: ConferenceMeetingModalProps) {
  const speakerLower = currentSpeaker?.toLowerCase() ?? "";

  // Draggable window state
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const isDraggingRef = React.useRef(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const elementStartRef = React.useRef({ x: 0, y: 0 });

  // Track active call participants (Jarvis always active initially, others toggleable)
  const [activeParticipants, setActiveParticipants] = React.useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("conf_participants");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return {
      Jarvis: true,
      Bobby: true,
      Claire: true,
      Sarah: true,
      Elena: true,
      Marcus: true,
      Lex: true,
      Mia: true
    };
  });

  const toggleParticipant = (name: string) => {
    // Jarvis is core and cannot be disconnected
    if (name === "Jarvis") return;
    setActiveParticipants(prev => {
      const next = { ...prev, [name]: !prev[name] };
      if (typeof window !== "undefined") {
        localStorage.setItem("conf_participants", JSON.stringify(next));
      }
      // Notify the orchestrator about who is present on call
      const activeList = Object.keys(next).filter(k => next[k]);
      sendMessage(`System Update: Conference call participants modified: ${activeList.join(", ")}`);
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent drag on buttons/input elements
    if ((e.target as HTMLElement).closest("button")) return;
    
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    elementStartRef.current = { x: position.x, y: position.y };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: elementStartRef.current.x + dx,
        y: elementStartRef.current.y + dy,
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    if (isOpen) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isOpen]);

  // Synchronize dynamic participant calls via textual commands ("Get Bobby on call", "Add Marcus")
  useEffect(() => {
    if (!isOpen || !currentSpeaker) return;
    const speaker = currentSpeaker;
    // Auto-activate speaker if they respond or get pulled in by the backend
    if (speaker && !activeParticipants[speaker]) {
      setActiveParticipants(prev => {
        const next = { ...prev, [speaker]: true };
        if (typeof window !== "undefined") {
          localStorage.setItem("conf_participants", JSON.stringify(next));
        }
        return next;
      });
    }
  }, [currentSpeaker, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="conference-modal"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed",
            bottom: "96px",
            right: "24px",
            zIndex: 9999,
            width: isMinimized ? "240px" : "520px",
            transform: `translate(${position.x}px, ${position.y}px)`,
            transition: isDraggingRef.current ? "none" : "width 0.3s ease, transform 0.1s ease",
          }}
        >
          {/* Glass Panel */}
          <div
            style={{
              background: "rgba(8, 10, 20, 0.82)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderRadius: "20px",
              border: "1px solid rgba(0, 212, 255, 0.2)",
              boxShadow: "0 8px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 40px rgba(0,212,255,0.06)",
              overflow: "hidden",
            }}
          >
            {/* Header bar */}
            <div
              onMouseDown={handleMouseDown}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(0,212,255,0.04)",
                cursor: "move",
                userSelect: "none"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={14} color="#00d4ff" />
                <span style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#00d4ff",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  AURA CONFERENCE
                </span>
                {/* Live dot */}
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 6px #22c55e",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={onToggleMinimize}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "none",
                    borderRadius: "8px",
                    padding: "4px 6px",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.5)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Minimize2 size={12} />
                </button>
                <button
                  onClick={onClose}
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    border: "none",
                    borderRadius: "8px",
                    padding: "4px 6px",
                    cursor: "pointer",
                    color: "#ef4444",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Body — hidden when minimized */}
            {!isMinimized && (
              <div style={{ padding: "16px" }}>
                {/* Agent grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "8px",
                    marginBottom: "14px",
                    boxSizing: "border-box",
                  }}
                >
                  {AGENT_ROSTER.map((agent) => {
                    const isActive = agent.name.toLowerCase() === speakerLower;
                    const isJoined = activeParticipants[agent.name];
                    return (
                      <motion.div
                        key={agent.name}
                        onClick={() => toggleParticipant(agent.name)}
                        animate={isActive ? { scale: 1.04 } : { scale: 1 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        style={{
                          borderRadius: "14px",
                          padding: "10px 4px 8px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "5px",
                          boxSizing: "border-box",
                          minWidth: 0, // Prevent flex items from expanding beyond parent grid column width
                          cursor: agent.name === "Jarvis" ? "default" : "pointer",
                          opacity: isJoined ? 1.0 : 0.3,
                          background: isActive
                            ? `rgba(${hexToRgb(agent.color)}, 0.14)`
                            : isJoined ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
                          border: isActive
                            ? `1.5px solid ${agent.color}`
                            : isJoined ? "1px solid rgba(255,255,255,0.06)" : "1px dashed rgba(255,255,255,0.08)",
                          boxShadow: isActive
                            ? `0 0 18px rgba(${hexToRgb(agent.color)}, 0.35), 0 0 4px rgba(${hexToRgb(agent.color)},0.2) inset`
                            : "none",
                          transition: "background 0.3s ease, border 0.3s ease, box-shadow 0.3s ease",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        {/* Shimmer when active */}
                        {isActive && (
                          <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: "200%" }}
                            transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "40%",
                              height: "100%",
                              background: `linear-gradient(90deg, transparent, rgba(${hexToRgb(agent.color)}, 0.12), transparent)`,
                              pointerEvents: "none",
                            }}
                          />
                        )}

                        {/* Avatar ring */}
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            border: `2px solid ${isActive ? agent.color : "rgba(255,255,255,0.1)"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: isActive
                              ? `rgba(${hexToRgb(agent.color)}, 0.2)`
                              : "rgba(255,255,255,0.05)",
                            boxShadow: isActive ? `0 0 10px rgba(${hexToRgb(agent.color)}, 0.4)` : "none",
                            transition: "all 0.3s ease",
                            position: "relative",
                          }}
                        >
                          <span style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: isActive ? agent.color : "rgba(255,255,255,0.4)",
                            fontFamily: "var(--font-mono, monospace)",
                            letterSpacing: "0.05em",
                            transition: "color 0.3s ease",
                          }}>
                            {agent.initials}
                          </span>

                          {/* Mic indicator */}
                          {isActive && (
                            <motion.div
                              animate={{ scale: [1, 1.25, 1] }}
                              transition={{ repeat: Infinity, duration: 0.9 }}
                              style={{
                                position: "absolute",
                                bottom: -2,
                                right: -2,
                                width: "13px",
                                height: "13px",
                                borderRadius: "50%",
                                background: "#22c55e",
                                border: "1.5px solid rgba(8,10,20,0.9)",
                                boxShadow: "0 0 6px #22c55e",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Mic size={7} color="white" />
                            </motion.div>
                          )}
                        </div>

                        {/* Name */}
                        <span style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color: isActive ? agent.color : "rgba(255,255,255,0.55)",
                          letterSpacing: "0.04em",
                          transition: "color 0.3s ease",
                        }}>
                          {agent.name}
                        </span>

                        {/* Waveform or muted icon */}
                        <div style={{ height: "16px", display: "flex", alignItems: "center" }}>
                          {isActive ? (
                            <MicWaveform color={agent.color} />
                          ) : (
                            <MicOff size={10} color="rgba(255,255,255,0.15)" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Status bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <motion.div
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: isListening ? "#ef4444" : "#22c55e",
                        boxShadow: isListening ? "0 0 5px #ef4444" : "0 0 5px #22c55e",
                      }}
                    />
                    <span style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.4)",
                      fontFamily: "var(--font-mono, monospace)",
                    }}>
                      {isListening ? "Listening to Operator…" : currentSpeaker ? `${currentSpeaker} is speaking…` : "Online Status Session"}
                    </span>
                  </div>
                  
                  {/* Operator Microphone Control */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleListening}
                      style={{
                        background: isListening ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.15)",
                        border: `1px solid ${isListening ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.3)"}`,
                        borderRadius: "8px",
                        padding: "4px 8px",
                        cursor: "pointer",
                        color: isListening ? "#ef4444" : "#22c55e",
                        fontSize: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 600,
                        fontFamily: "var(--font-mono, monospace)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        transition: "all 0.2s ease",
                        boxShadow: isListening ? "0 0 10px rgba(239, 68, 68, 0.25)" : "none",
                      }}
                    >
                      {isListening ? <MicOff size={10} /> : <Mic size={10} />}
                      {isListening ? "Mute" : "Speak"}
                    </motion.button>
                    <span style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.25)",
                      fontFamily: "var(--font-mono, monospace)",
                    }}>
                      8 AGENTS
                    </span>
                  </div>
                </div>

                {/* Conference text input bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const target = (e.currentTarget.elements.namedItem("confInput") as HTMLInputElement);
                    if (target && target.value.trim()) {
                      sendMessage(target.value.trim());
                      target.value = "";
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    padding: "4px 6px",
                  }}
                >
                  <input
                    name="confInput"
                    type="text"
                    placeholder="Type a message to the conference room..."
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "white",
                      fontSize: "11px",
                      fontFamily: "inherit",
                      padding: "4px 6px",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: "rgba(0, 212, 255, 0.15)",
                      border: "1px solid rgba(0, 212, 255, 0.3)",
                      color: "#00d4ff",
                      borderRadius: "6px",
                      padding: "3px 8px",
                      fontSize: "10px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontFamily: "var(--font-mono, monospace)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper: hex to "r,g,b" string for rgba()
function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r},${g},${b}`;
}
