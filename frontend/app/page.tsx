"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Mic, MicOff, Send, Search, Bell, User, Activity, Database, Globe, Terminal, Zap, Brain, ArrowRight, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { JarvisWebSocket } from "@/lib/websocket";
import { ChatMessage, JarvisEvent, AgentLogEntry, SystemStatus, EVENT_LABELS, AGENT_COLORS, AGENT_ICONS } from "@/lib/types";
import { AuraOrb, VisualizerState } from "./components/NebulaVisualizer";

// Extend window and global scope to support experimental Web Speech API in TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
  var SpeechRecognition: any;
  var webkitSpeechRecognition: any;
  type SpeechRecognition = any;
  type SpeechRecognitionEvent = any;
}

const QUICK_ACTIONS = [
  { label: "Quick Command",  icon: Terminal, desc: "Execute action",         color: "#00d4ff" },
  { label: "Deep Research",  icon: Search,   desc: "AI-powered insights",    color: "#8b5cf6" },
  { label: "Memory Recall",  icon: Database, desc: "Access knowledge",       color: "#3b82f6" },
  { label: "System Analyze", icon: Activity, desc: "Diagnose & optimize",    color: "#10b981" },
];

const RECENT_ACTIVITY = [
  { label: "Adaptive Learning Completed", desc: "System improved understanding by 20%", time: "3m ago", color: "#00d4ff" },
  { label: "Memory Consolidation",        desc: "Optimized 1,246 memory nodes",         time: "15m ago", color: "#8b5cf6" },
  { label: "Protocol Execution",          desc: 'Executed "Data Synthesis" protocol',    time: "32m ago", color: "#10b981" },
];

export default function JarvisPage() {
  const [sessionId,      setSessionId]      = useState("");
  const [isMounted,      setIsMounted]      = useState(false);
  const [activeChannel, setActiveChannel] = useState("#general-chat");
  const activeChannelRef = useRef(activeChannel);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, ChatMessage[]>>({
    "#general-chat": [],
    "#business-operations": [],
    "#engineering-trace": [],
    "#support-tickets": [],
  });

  const messages = messagesByChannel[activeChannel] || [];

  const activeCoworker = 
    activeChannel === "#business-operations" ? "Bobby" :
    activeChannel === "#engineering-trace" ? "Tom" :
    activeChannel === "#support-tickets" ? "Sarah" : "Jarvis";

  const addMessage = useCallback((channel: string, role: "user" | "assistant" | "system", content: string) => {
    setMessagesByChannel(prev => ({
      ...prev,
      [channel]: [...(prev[channel] || []), {
        id: uuidv4(),
        role,
        content,
        timestamp: new Date().toISOString()
      }]
    }));
  }, []);

  const [agentLog,       setAgentLog]       = useState<AgentLogEntry[]>([]);
  const [input,          setInput]          = useState("");
  const [isProcessing,   setIsProcessing]   = useState(false);
  const [isListening,    setIsListening]    = useState(false);
  const [amplitude,      setAmplitude]      = useState(0.5);
  const [status,         setStatus]         = useState<SystemStatus>({
    connected: false, ollamaAvailable: false, model: "mistral", sessionId: "", eventCount: 0,
  });

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const isVoiceEnabledRef = useRef(isVoiceEnabled);

  // Sync ref with state
  useEffect(() => {
    isVoiceEnabledRef.current = isVoiceEnabled;
  }, [isVoiceEnabled]);

  // Load voice toggle preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("isVoiceEnabled");
      if (saved !== null) {
        setIsVoiceEnabled(saved === "true");
      }
    }
  }, []);

  const handleToggleVoice = useCallback(() => {
    setIsVoiceEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("isVoiceEnabled", String(next));
      }
      return next;
    });
  }, []);

  // Stable Text-to-Speech synthesis with backend ElevenLabs and local WebSpeech failover
  const speakText = useCallback(async (text: string, agentName: string = "Jarvis") => {
    if (!isVoiceEnabledRef.current) return;

    // Filter out markdown formatting markers so the voice doesn't pronounce them
    const cleanText = text
      .replace(/[*#_`>~\-]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, " ")
      .trim();

    if (!cleanText) return;

    // Map agents to distinct premium voices
    const voiceMap: Record<string, string> = {
      "Jarvis": "21m00Tcm4TlvDq8ikWAM",  // Rachel/default
      "Bobby": "EXAVITQu4vr4xnSDxMaL",   // American energetic male
      "Tom": "GBv7mqtYiPICl9s51i0t",     // Systems engineer
      "Sarah": "AZnzlk1XvdvUeBnXmlld",   // Organized operations female
    };
    const voiceId = voiceMap[agentName] || voiceMap["Jarvis"];

    try {
      const configRes = await fetch("http://localhost:8000/api/tts/config");
      const config = await configRes.json();

      if (config.available) {
        const ttsRes = await fetch("http://localhost:8000/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText, voice_id: voiceId }),
        });

        if (ttsRes.ok) {
          const blob = await ttsRes.blob();
          if (blob.type.startsWith("audio/") && blob.size > 100) {
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            await audio.play();
            return;
          } else {
            console.warn("TTS API response was not a valid audio blob:", blob.type, "size:", blob.size);
          }
        }
      }
    } catch (err) {
      console.warn("ElevenLabs synthesis fallback to WebSpeech due to:", err);
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      
      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith("en-") &&
          (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha"))
      ) || voices.find((v) => v.lang.startsWith("en-")) || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const wsRef       = useRef<JarvisWebSocket | null>(null);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const visualizerState: VisualizerState =
    isListening ? "listening" : isProcessing ? "thinking" : "idle";

  useEffect(() => { const id = uuidv4(); setSessionId(id); setIsMounted(true); setStatus(s => ({ ...s, sessionId: id })); }, []);

  // ── Voice recognition setup ──────────────────────────────────
  const toggleListening = useCallback(() => {
    const SpeechAPI = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechAPI) {
      alert("Voice recognition is not supported in this browser. Try Chrome.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechAPI();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) sendMessage(transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening]);

  useEffect(() => {
    if (isListening || isProcessing) {
      const iv = setInterval(() => setAmplitude(Math.random()), 100);
      return () => clearInterval(iv);
    }
    setAmplitude(0.2);
  }, [isListening, isProcessing]);

  const addLogEntry = useCallback((event: JarvisEvent) => {
    const entry: AgentLogEntry = {
      id: uuidv4(), type: event.type, agent: event.agent,
      title: EVENT_LABELS[event.type] || event.type,
      content: event.data?.content || event.data?.decision || event.data?.result || (event.data ? JSON.stringify(event.data).slice(0, 120) : ""),
      timestamp: new Date().toISOString(),
    };
    setAgentLog(prev => [...prev, entry].slice(-50));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const ws = new JarvisWebSocket(sessionId);
    
    ws.on("*", (event: JarvisEvent) => {
      addLogEntry(event);
      if (event.type === "connected" && event.message) {
        // Log welcome message under the general chat channel
        addMessage("#general-chat", "assistant", event.message);
        speakText(event.message, "Jarvis");
      } else if (event.type === "final_response" && event.data) {
        const responseText = event.data.content || "Response received.";
        const responderAgent = (event.agent as string) || "Jarvis";
        
        const targetChannel = activeChannelRef.current;
        addMessage(targetChannel, "assistant", responseText);
        setIsProcessing(false);
        speakText(responseText, responderAgent);
      } else if (event.type === "pipeline_error") {
        const errorText = event.message || "An internal error occurred.";
        const targetChannel = activeChannelRef.current;
        addMessage(targetChannel, "system", `Error: ${errorText}`);
        setIsProcessing(false);
      }
    });

    ws.onStatusChange = (connected) => setStatus(s => ({ ...s, connected }));
    
    ws.connect().catch(err => {
      console.error("Connection failed:", err);
      setStatus(s => ({ ...s, connected: false }));
    });

    wsRef.current = ws;
    return () => ws.disconnect();
  }, [sessionId, addLogEntry, speakText, addMessage]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    
    const targetChannel = activeChannelRef.current;
    addMessage(targetChannel, "user", msg);
    setIsProcessing(true);
    
    try { 
      wsRef.current?.send("message", { 
        content: msg, 
        user_id: "default_user", 
        channel: targetChannel 
      }); 
    }
    catch { 
      addMessage(targetChannel, "assistant", "Communication interrupt. Verify Neural Link.");
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", overflow: "hidden" }}>
      
      {/* ── Channel Navigation Drawer (inspired by Slack/Luke's coworker team) ── */}
      <div style={{
        width: 220,
        height: "100%",
        borderRight: "1px solid var(--border)",
        background: "rgba(10, 16, 32, 0.4)",
        backdropFilter: "blur(12px)",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 16, paddingLeft: 8 }}>
          Coworker Channels
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { id: "#general-chat", label: "# general-chat", desc: "Jarvis (Default)", color: "var(--accent-cyan)" },
            { id: "#business-operations", label: "# business-ops", desc: "Bobby (Growth)", color: "var(--accent-purple)" },
            { id: "#engineering-trace", label: "# engineer-trace", desc: "Tom (Systems)", color: "#ffffff" },
            { id: "#support-tickets", label: "# support-tickets", desc: "Sarah (Operations)", color: "var(--accent-green)" }
          ].map(ch => {
            const isActive = activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                suppressHydrationWarning={true}
                onClick={() => setActiveChannel(ch.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? "white" : "var(--text-secondary)" }}>
                  {ch.label}
                </div>
                <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
                  {ch.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Chat Panel ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

        {/* ── Header ── */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px 14px", flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: "white", letterSpacing: "-0.01em", marginBottom: 2 }}>
              Welcome back, Operator.
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              AURA is online and adaptive. Active: <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>{activeChannel}</span>
            </p>
          </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button suppressHydrationWarning={true} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}>
            <Search style={{ width: 15, height: 15 }} />
          </button>
          <button suppressHydrationWarning={true} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}>
            <Bell style={{ width: 15, height: 15 }} />
          </button>
          <button suppressHydrationWarning={true} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}>
            <User style={{ width: 15, height: 15 }} />
          </button>
        </div>
      </header>

      {/* ── Scrollable Content ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 28px 20px" }} className="scrollbar-hide">

        {/* ── AURA CORE Title ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: 8, marginTop: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "white", letterSpacing: "0.04em" }}>AURA CORE</h2>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Online · Adaptive · Learning</p>
        </motion.div>

        {/* ── Orb Section with Floating Badges ── */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}
          style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 340, margin: "0 auto", maxWidth: 600 }}>

          {/* Floating badges around orb */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
            className="orb-badge" style={{ position: "absolute", left: 0, top: 20, zIndex: 20 }}>
            <div className="badge-label">System Health</div>
            <div className="badge-value">92<span style={{ fontSize: 14, color: "var(--text-secondary)" }}>%</span></div>
            <div className="badge-sub text-green">Excellent</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}
            className="orb-badge" style={{ position: "absolute", right: 0, top: 20, zIndex: 20 }}>
            <div className="badge-label">Neural Sync</div>
            <div className="badge-value">98.7<span style={{ fontSize: 14, color: "var(--text-secondary)" }}>%</span></div>
            <div className="badge-sub text-cyan">Stable</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}
            className="orb-badge" style={{ position: "absolute", left: 10, bottom: 10, zIndex: 20 }}>
            <div className="badge-label">Memory Stream</div>
            <div className="badge-value">2.34 <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>TB</span></div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}
            className="orb-badge" style={{ position: "absolute", right: 10, bottom: 10, zIndex: 20 }}>
            <div className="badge-label">Active State</div>
            <div className="badge-value" style={{ fontSize: 16 }}>
              {visualizerState === "idle" ? "Standing By" : visualizerState === "listening" ? "Listening" : "Processing"}
            </div>
          </motion.div>

          {/* The Orb */}
          <AuraOrb state={visualizerState} amplitude={amplitude} size={260} coworker={activeCoworker} />
        </motion.div>

        {/* ── Command Input Bar ── */}
        <div style={{ maxWidth: 500, margin: "16px auto 20px" }}>
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="input-bar">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Give command to Aura..."
              disabled={isProcessing} suppressHydrationWarning={true} />
            <motion.button type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={handleToggleVoice}
              suppressHydrationWarning={true}
              title={isVoiceEnabled ? "Mute voice response" : "Unmute voice response"}
              style={{
                width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer",
                background: isVoiceEnabled ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.05)",
                color: isVoiceEnabled ? "var(--accent-purple)" : "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s ease",
              }}>
              {isVoiceEnabled ? <Volume2 style={{ width: 16, height: 16 }} /> : <VolumeX style={{ width: 16, height: 16 }} />}
            </motion.button>
            <motion.button type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={toggleListening}
              suppressHydrationWarning={true}
              title={isListening ? "Stop listening" : "Start voice input"}
              style={{
                width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer",
                background: isListening ? "var(--accent-cyan)" : "rgba(0,212,255,0.15)",
                color: isListening ? "#000" : "var(--accent-cyan)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isListening ? "0 0 16px rgba(0,212,255,0.5)" : "none",
                transition: "all 0.2s ease",
              }}>
              {isListening ? <MicOff style={{ width: 16, height: 16 }} /> : <Mic style={{ width: 16, height: 16 }} />}
            </motion.button>
          </form>
        </div>

        {/* ── Chat Messages (when active) ── */}
        <AnimatePresence>
          {messages.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ maxWidth: 600, margin: "0 auto 20px", maxHeight: 200, overflowY: "auto" }} className="scrollbar-hide">
              {messages.slice(-6).map((msg, i) => (
                <div key={msg.id} style={{
                  padding: "10px 14px", marginBottom: 8, borderRadius: 12,
                  background: msg.role === "user" ? "rgba(0,212,255,0.08)" : "var(--bg-card)",
                  border: "1px solid var(--border)", fontSize: 13, lineHeight: 1.5,
                  color: "var(--text-secondary)",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: msg.role === "user" ? "var(--accent-cyan)" : "var(--accent-purple)", marginRight: 8 }}>
                    {msg.role === "user" ? "YOU" : "AURA"}
                  </span>
                  {msg.content}
                </div>
              ))}
              <div ref={chatEndRef} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Quick Actions ── */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-header">Quick Actions</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {QUICK_ACTIONS.map((item, i) => (
              <motion.button key={i} onClick={() => sendMessage(item.label)}
                suppressHydrationWarning={true}
                whileHover={{ y: -3, transition: { duration: 0.2 } }} whileTap={{ scale: 0.97 }}
                className="glass-card" style={{ cursor: "pointer", textAlign: "center", padding: "18px 12px" }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12, margin: "0 auto 10px",
                  background: `${item.color}12`, border: `1px solid ${item.color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: item.color,
                }}>
                  <item.icon style={{ width: 18, height: 18 }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "white", marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.desc}</div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Bottom Two-Column: Recent Activity + Voice Activity ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* Recent Activity */}
          <div className="glass-card">
            <div className="section-header" style={{ marginBottom: 10 }}>Recent Activity</div>
            {RECENT_ACTIVITY.map((item, i) => (
              <div key={i} className="activity-item">
                <div className="activity-dot" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "white", marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.desc}</div>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{item.time}</span>
              </div>
            ))}
          </div>

          {/* Voice Activity Visualization */}
          <div className="glass-card">
            <div className="section-header" style={{ marginBottom: 10 }}>Voice Activity</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80, gap: 3 }}>
              {Array.from({ length: 30 }).map((_, i) => {
                const h = 10 + Math.sin(i * 0.4 + Date.now() * 0.001) * 25 + Math.random() * 10;
                return (
                  <motion.div key={i}
                    animate={{ height: [h * 0.4, h, h * 0.6, h * 0.9, h * 0.4] }}
                    transition={{ duration: 1.5 + Math.random() * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }}
                    style={{
                      width: 3, borderRadius: 2, flexShrink: 0,
                      background: `linear-gradient(180deg, var(--accent-cyan), var(--accent-purple))`,
                      opacity: 0.6,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "var(--accent-cyan)", fontWeight: 600 }}>
                {isListening ? "Listening..." : "Standing By"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── System Footer ── */}
      <div className="system-footer" style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="footer-label">System Status</span>
            <span className="footer-value" style={{ color: status.connected ? "var(--accent-green)" : "var(--accent-red)" }}>
              {status.connected ? "Optimal" : "Offline"}
            </span>
          </div>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>CPU 18% · RAM 32%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="footer-label">Operator</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg, rgba(0,212,255,0.3), rgba(139,92,246,0.2))", border: "1px solid rgba(0,212,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent-cyan)" }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "white" }}>AURA</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
