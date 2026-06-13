"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Mic, MicOff, Send, Search, Bell, User, Activity, Database, Globe, Terminal, Zap, Brain, ArrowRight, Volume2, VolumeX, Calendar, Palette, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { JarvisWebSocket } from "@/lib/websocket";
import { ChatMessage, JarvisEvent, AgentLogEntry, SystemStatus, EVENT_LABELS, AGENT_COLORS, AGENT_ICONS, VizData } from "@/lib/types";
import { AuraOrb, VisualizerState } from "./components/NebulaVisualizer";
import ConferenceMeetingModal from "./components/ConferenceMeetingModal";
import VisualDataPanel from "./components/VisualDataPanel";
import { parseVisualContent, parseVizHint } from "@/lib/vizParser";

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

// Autocorrelation algorithm for pitch detection (F0)
function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // Not enough signal

  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = SIZE - 1; i >= SIZE / 2; i--) {
    if (Math.abs(buffer[i]) < thres) {
      r2 = i;
      break;
    }
  }

  const buf = buffer.subarray(r1, r2);
  const len = buf.length;

  const c = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < len; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;
  
  // Interpolation
  const x1 = c[T0 - 1];
  const x2 = c[T0];
  const x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

const QUICK_ACTIONS = [
  { label: "Quick Command", icon: Terminal, desc: "Execute action", color: "#00d4ff" },
  { label: "Deep Research", icon: Search, desc: "AI-powered insights", color: "#8b5cf6" },
  { label: "Memory Recall", icon: Database, desc: "Access knowledge", color: "#3b82f6" },
  { label: "System Analyze", icon: Activity, desc: "Diagnose & optimize", color: "#10b981" },
];

const RECENT_ACTIVITY = [
  { label: "Adaptive Learning Completed", desc: "System improved understanding by 20%", time: "3m ago", color: "#00d4ff" },
  { label: "Memory Consolidation", desc: "Optimized 1,246 memory nodes", time: "15m ago", color: "#8b5cf6" },
  { label: "Protocol Execution", desc: 'Executed "Data Synthesis" protocol', time: "32m ago", color: "#10b981" },
];

export default function JarvisPage() {
  const [sessionId, setSessionId] = useState("");
  const [detectedGender, setDetectedGender] = useState<"sir" | "ma'am">("sir");
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const pitchIntervalRef = useRef<any>(null);
  const pitchListRef = useRef<number[]>([]);

  const [showWelcome, setShowWelcome] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0); // 0 to 1
  const [welcomeEnded, setWelcomeEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("detectedGender");
      if (saved === "sir" || saved === "ma'am") {
        setDetectedGender(saved);
      }
    }
  }, []);

  // Play and control the video organically based on scroll activity (Scroll-velocity speed control)
  useEffect(() => {
    if (!showWelcome) return;

    let decayTimer: any = null;
    let targetPlaybackRate = 0;
    let currentPlaybackRate = 0;
    let animationId: number;
    const video = videoRef.current;

    // Reset video state
    if (video) {
      video.currentTime = 0;
      video.playbackRate = 0;
      video.pause();
    }

    const updatePlayback = () => {
      const vid = videoRef.current;
      if (vid && vid.duration && !isNaN(vid.duration)) {
        // Stop scrubbing/playing if we are at or past the end of the video
        if (vid.currentTime >= vid.duration - 0.05) {
          vid.playbackRate = 0;
          currentPlaybackRate = 0;
          targetPlaybackRate = 0;
          if (!vid.paused) vid.pause();
          setVideoProgress(1.0);
          setWelcomeEnded(true);
        } else {
          // Interpolate the playback speed smoothly
          currentPlaybackRate += (targetPlaybackRate - currentPlaybackRate) * 0.1;
          
          // Handle play/pause states based on rate thresholds
          if (Math.abs(currentPlaybackRate) > 0.05) {
            if (vid.paused) {
              vid.play().catch(() => {});
            }
            // Set direction and speed
            vid.playbackRate = Math.min(3.0, Math.max(0.1, currentPlaybackRate));
          } else {
            currentPlaybackRate = 0;
            if (!vid.paused) {
              vid.pause();
            }
          }

          // Keep progress bar updated
          const progress = vid.currentTime / vid.duration;
          setVideoProgress(progress);

          if (progress >= 0.99) {
            setWelcomeEnded(true);
          } else {
            setWelcomeEnded(false);
          }
        }
      }
      animationId = requestAnimationFrame(updatePlayback);
    };

    animationId = requestAnimationFrame(updatePlayback);

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const vid = videoRef.current;
      if (!vid) return;

      // Do nothing if video has already ended
      if (vid.currentTime >= vid.duration - 0.05) {
        setWelcomeEnded(true);
        return;
      }

      // Reset decay timer on active scroll
      if (decayTimer) clearTimeout(decayTimer);

      // Scroll Down -> Forward speed boost. Scroll Up -> Let it slow down/pause
      if (e.deltaY > 0) {
        // Boost playback speed forward proportionally to wheel movement
        targetPlaybackRate = Math.min(3.0, targetPlaybackRate + 0.4);
      } else {
        // Slow down or brake
        targetPlaybackRate = Math.max(0.0, targetPlaybackRate - 0.4);
      }

      // Smoothly decay/stop playback speed when user stops scrolling
      decayTimer = setTimeout(() => {
        targetPlaybackRate = 0;
      }, 150);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(animationId);
      if (decayTimer) clearTimeout(decayTimer);
    };
  }, [showWelcome]);

  const handleWelcomeClick = () => {
    if (welcomeEnded) {
      setShowWelcome(false);
      // Unlock voice processing only after exiting the welcome screen
      userInteractedRef.current = true;
      processSpeechQueue();
    }
  };
  const [isMounted, setIsMounted] = useState(false);
  const [liveStats, setLiveStats] = useState<any>(null);
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
    "#creative-design": [],
    "#financial-ops": [],
    "#security-audit": [],
    "#product-roadmap": [],
  });

  const messages = messagesByChannel[activeChannel] || [];

  const activeCoworker =
    activeChannel === "#business-operations" ? "Bobby" :
      activeChannel === "#engineering-trace" ? "Claire" :
        activeChannel === "#support-tickets" ? "Sarah" :
          activeChannel === "#creative-design" ? "Elena" :
            activeChannel === "#financial-ops" ? "Marcus" :
              activeChannel === "#security-audit" ? "Lex" :
                activeChannel === "#product-roadmap" ? "Mia" : "Jarvis";

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

  const [agentLog, setAgentLog] = useState<AgentLogEntry[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [amplitude, setAmplitude] = useState(0.5);
  const [status, setStatus] = useState<SystemStatus>({
    connected: false, ollamaAvailable: false, model: "mistral", sessionId: "", eventCount: 0,
  });

  // ── Conference Call Modal state ──────────────────────────────
  const [conferenceActive, setConferenceActive] = useState(false);
  const [conferenceSpeaker, setConferenceSpeaker] = useState<string | null>(null);
  const [conferenceMinimized, setConferenceMinimized] = useState(false);
  const conferenceSessionRef = useRef(false);

  // ── Visual Data Panel state ──────────────────────────────────
  const [vizPanelData, setVizPanelData] = useState<VizData | null>(null);
  // Track seen message IDs to avoid duplicate panel triggers
  const vizShownRef = useRef<Set<string>>(new Set());

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const isVoiceEnabledRef = useRef(isVoiceEnabled);

  // Responsive visualizer sizing: scales down at windowed heights, full size at fullscreen (>=900px)
  const [vizSize, setVizSize] = useState(460);
  const [vizWidth, setVizWidth] = useState(740);

  useEffect(() => {
    const updateVizSize = () => {
      const vh = window.innerHeight;
      if (vh >= 900) {
        setVizSize(460);
        setVizWidth(740);
      } else {
        // Stay as large as possible — only scale down enough to fit the UI chrome
        const ratio = Math.min(1.0, Math.max(0.92, vh / 700));
        setVizSize(Math.round(460 * ratio));
        setVizWidth(Math.round(740 * ratio));
      }
    };
    updateVizSize();
    window.addEventListener("resize", updateVizSize);
    return () => window.removeEventListener("resize", updateVizSize);
  }, []);

  // Derived responsive layout values
  const isWindowed = vizSize < 460;   // true whenever not at full fullscreen size
  const orbMarginTop = isWindowed ? 0 : -20;
  const orbMarginBottom = isWindowed ? -5 : -10;


  // Guard: browser blocks audio.play() before any user interaction
  const userInteractedRef = useRef(false);

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

  // Unlock audio playback after first user interaction (handled in welcome click)
  useEffect(() => {
    // Left empty: Voice player is strictly locked until handleWelcomeClick is fired
  }, []);

  const speechQueueRef = React.useRef<{ text: string; agentName: string; channel: string; alreadyDisplayed: boolean; vizData?: VizData | null }[]>([]);
  const isSpeakingRef = React.useRef<boolean>(false);
  const currentAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const stopPlayback = React.useCallback(() => {
    speechQueueRef.current = [];
    isSpeakingRef.current = false;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  function processSpeechQueue() {
    if (isSpeakingRef.current) return;
    if (speechQueueRef.current.length === 0) return;

    const nextSpeech = speechQueueRef.current[0];
    isSpeakingRef.current = true;
    playSpeechItem(nextSpeech.text, nextSpeech.agentName, nextSpeech.channel, nextSpeech.alreadyDisplayed, nextSpeech.vizData);
  }

  async function playSpeechItem(text: string, agentName: string, channel: string, alreadyDisplayed: boolean, vizData: VizData | null = null) {
    // Filter out markdown formatting markers & quotes so the voice doesn't pronounce them literal marks
    let cleanText = text
      .replace(/Simulation Warning:/gi, "")
      .replace(/I must warn you that:/gi, "")
      .replace(/Confirmation: Response Received/gi, "")
      .replace(/Confirmation:/gi, "")
      .replace(/Message Details:/gi, "")
      .replace(/To:/gi, "to")
      .replace(/Message:/gi, "message")
      .replace(/^[=\-*\s]{3,}$/gm, "") // Clean divider lines like ===, ---, ***
      .replace(/[=*#_`>~\-"']/g, "")   // Added = to the replaced character set
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, " ")
      .trim();

    const onSpeechFinished = () => {
      speechQueueRef.current.shift();
      isSpeakingRef.current = false;
      processSpeechQueue();
    };

    if (!cleanText) {
      onSpeechFinished();
      return;
    }

    const voiceMap: Record<string, string> = {
      "jarvis": "21m00Tcm4TlvDq8ikWAM",  // Rachel -> en-US-AriaNeural
      "bobby": "86ZLAUcyPNBrbdJKn3u6",   // Growth -> en-US-ChristopherNeural
      "claire": "c3QefzBhE1Cx4Yl23IV3",  // Systems -> en-US-GuyNeural (formerly Tom)
      "sarah": "zGjIP4SZlMnY9m93k97r",   // Support -> en-US-EmmaNeural
      "elena": "elena_voice_id_placeholder",
      "marcus": "marcus_voice_id_placeholder",
      "lex": "lex_voice_id_placeholder",
      "mia": "mia_voice_id_placeholder",
    };
    const voiceId = voiceMap[agentName.toLowerCase()] || voiceMap["jarvis"];

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const configRes = await fetch(`${apiBase}/api/tts/config`);
      const config = await configRes.json();

      if (config.available) {
        const ttsRes = await fetch(`${apiBase}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText, voice_id: voiceId }),
        });

        if (ttsRes.ok) {
          const blob = await ttsRes.blob();
          if (blob.type.startsWith("audio/") && blob.size > 100) {
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;
            audio.onended = () => {
              if (currentAudioRef.current === audio) {
                currentAudioRef.current = null;
              }
              onSpeechFinished();
            };
            audio.onerror = () => {
              onSpeechFinished();
            };
            // Sync active channel and display text precisely when the audio starts playing
            setActiveChannel(channel);
            if (conferenceSessionRef.current) {
              setConferenceSpeaker(agentName);
            }
            if (vizData) {
              setVizPanelData(vizData);
            }
            if (!alreadyDisplayed) {
              addMessage(channel, "assistant", text);
            }
            await audio.play();
            return;
          }
        }
      }
    } catch (err) {
      console.warn("ElevenLabs synthesis fallback to WebSpeech due to:", err);
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.15;
      const voices = window.speechSynthesis.getVoices();

      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith("en-") &&
          (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha"))
      ) || voices.find((v) => v.lang.startsWith("en-")) || voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      utterance.onstart = () => {
        setActiveChannel(channel);
        if (conferenceSessionRef.current) {
          setConferenceSpeaker(agentName);
        }
        if (vizData) {
          setVizPanelData(vizData);
        }
        if (!alreadyDisplayed) {
          addMessage(channel, "assistant", text);
        }
      };
      utterance.onend = () => {
        onSpeechFinished();
      };
      utterance.onerror = () => {
        onSpeechFinished();
      };
      window.speechSynthesis.speak(utterance);
    } else {
      setActiveChannel(channel);
      if (!alreadyDisplayed) {
        addMessage(channel, "assistant", text);
      }
      onSpeechFinished();
    }
  }

  const handleToggleVoice = useCallback(() => {
    setIsVoiceEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("isVoiceEnabled", String(next));
      }
      return next;
    });
  }, []);

  const speakText = React.useCallback((text: string, agentName: string = "Jarvis", channel: string, alreadyDisplayed: boolean = false, vizData: VizData | null = null) => {
    if (!isVoiceEnabledRef.current) {
      if (!alreadyDisplayed) {
        setActiveChannel(channel);
        addMessage(channel, "assistant", text);
      }
      if (vizData) {
        setVizPanelData(vizData);
      }
      return;
    }

    speechQueueRef.current.push({ text, agentName, channel, alreadyDisplayed, vizData });
    if (userInteractedRef.current) {
      processSpeechQueue();
    }
  }, [addMessage, setActiveChannel]);

  const wsRef = useRef<JarvisWebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechTranscriptRef = useRef<string>("");
  const inputSourceRef = useRef<"text" | "audio">("text");

  const visualizerState: VisualizerState =
    isListening ? "listening" : isProcessing ? "thinking" : "idle";

  useEffect(() => { const id = uuidv4(); setSessionId(id); setIsMounted(true); setStatus(s => ({ ...s, sessionId: id })); }, []);

  useEffect(() => {
    // Lock the main panel vertical scroll to prevent layout spill on home page
    if (typeof window !== "undefined") {
      const mainPanel = document.querySelector(".panel-main");
      if (mainPanel) {
        const originalOverflow = (mainPanel as HTMLElement).style.overflowY;
        (mainPanel as HTMLElement).style.overflowY = "hidden";
        return () => {
          (mainPanel as HTMLElement).style.overflowY = originalOverflow;
        };
      }
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const fetchStats = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiBase}/system/stats`);
        if (res.ok) {
          const data = await res.json();
          setLiveStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch live stats:", err);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [isMounted]);

  // ── Voice recognition setup ──────────────────────────────────
  const toggleListening = useCallback(async () => {
    const SpeechAPI = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechAPI) {
      alert("Voice recognition is not supported in this browser. Try Chrome.");
      return;
    }

    const stopPitchDetection = () => {
      if (pitchIntervalRef.current) {
        clearInterval(pitchIntervalRef.current);
        pitchIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
        audioContextRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }

      if (pitchListRef.current.length > 0) {
        const avgPitch = pitchListRef.current.reduce((a, b) => a + b, 0) / pitchListRef.current.length;
        console.log("Average voice pitch detected:", avgPitch, "Hz");
        let nextGender: "sir" | "ma'am" = detectedGender;
        if (avgPitch > 165) {
          nextGender = "ma'am";
        } else if (avgPitch < 155) {
          nextGender = "sir";
        } else if (avgPitch > 0) {
          nextGender = avgPitch >= 160 ? "ma'am" : "sir";
        }
        setDetectedGender(nextGender);
        if (typeof window !== "undefined") {
          localStorage.setItem("detectedGender", nextGender);
        }
      }
    };

    const startPitchDetection = async () => {
      pitchListRef.current = [];
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        const sourceNode = audioCtx.createMediaStreamSource(stream);
        const analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 2048;
        sourceNode.connect(analyserNode);

        const bufferLength = analyserNode.fftSize;
        const dataArray = new Float32Array(bufferLength);

        pitchIntervalRef.current = setInterval(() => {
          analyserNode.getFloatTimeDomainData(dataArray);
          const pitch = autoCorrelate(dataArray, audioCtx.sampleRate);
          if (pitch > 50 && pitch < 500) {
            pitchListRef.current.push(pitch);
          }
        }, 100);
      } catch (err) {
        console.warn("Failed to initialize pitch detection audio context:", err);
      }
    };

    if (isListening) {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      recognitionRef.current?.stop();
      setIsListening(false);
      stopPitchDetection();
      // Auto-submit whatever transcript was accumulated when turning the mic off
      setTimeout(() => {
        const textToSend = speechTranscriptRef.current.trim() || input.trim();
        if (textToSend) {
          inputSourceRef.current = "audio";
          sendMessage(textToSend);
          speechTranscriptRef.current = "";
        }
      }, 100);
      return;
    }

    // Silence any active speech when user triggers the microphone
    stopPlayback();

    // Set input source to audio for the incoming voice query
    inputSourceRef.current = "audio";

    // Initialize transcript ref with current typed input
    speechTranscriptRef.current = input;

    // Start pitch detection in parallel
    startPitchDetection();

    const recognition = new SpeechAPI();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => setIsListening(true);
    
    recognition.onend = () => {
      setIsListening(false);
      stopPitchDetection();
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
      stopPitchDetection();
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      if (event.error === "not-allowed") {
        alert("Microphone permission was denied! Please click the camera/mic icon in your browser search bar and allow access, or check your system settings.");
      } else if (event.error === "no-microphone") {
        alert("No microphone was detected on your system. Please connect an audio input device.");
      }
    };

    const autoCorrectSpeech = (text: string): string => {
      let corrected = text;
      const replacements: Record<string, string> = {
        "cow worker": "coworker",
        "cow workers": "coworker",
        "javed": "Jarvis",
        "javis": "Jarvis",
        "jarves": "Jarvis",
        "job is": "Jarvis",
        "ora": "Aura",
        "or a": "Aura",
        "tomb": "Claire",
        "thom": "Claire",
        "clear": "Claire",
        "clair": "Claire",
        "claire": "Claire",
        "bobi": "Bobby",
        "sara": "Sarah"
      };
      for (const [wrong, right] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${wrong}\\b`, "gi");
        corrected = corrected.replace(regex, right);
      }
      return corrected;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptSegment + " ";
        } else {
          interimTranscript += transcriptSegment;
        }
      }

      if (finalTranscript) {
        const correctedFinal = autoCorrectSpeech(finalTranscript);
        const cleanPrev = speechTranscriptRef.current.trim();
        const newVal = cleanPrev ? `${cleanPrev} ${correctedFinal.trim()}` : correctedFinal.trim();
        speechTranscriptRef.current = newVal;
      }

      // Display the combined final and interim text instantly as the user speaks!
      const currentInput = autoCorrectSpeech((speechTranscriptRef.current + " " + interimTranscript).trim());
      setInput(currentInput);

      // Schedule auto-send after 1.2 seconds of silence for lower latency response
      silenceTimeoutRef.current = setTimeout(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
        stopPitchDetection();
        const textToSend = speechTranscriptRef.current.trim();
        if (textToSend) {
          inputSourceRef.current = "audio";
          sendMessage(textToSend);
          speechTranscriptRef.current = "";
        }
      }, 1200);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, stopPlayback, input, detectedGender]);

  useEffect(() => {
    if (isListening || isProcessing) {
      const iv = setInterval(() => setAmplitude(Math.random()), 100);
      return () => clearInterval(iv);
    }
    setAmplitude(0.2);
  }, [isListening, isProcessing]);

  // Auto-scroll messages container to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
    const ws = new JarvisWebSocket(sessionId, undefined, detectedGender);

    ws.on("*", (event: JarvisEvent) => {
      addLogEntry(event);
      if (event.type === "connected" && event.message) {
        // Log welcome message under the general chat channel
        addMessage("#general-chat", "assistant", event.message);
        speakText(event.message, "Jarvis", "#general-chat", true);
      } else if (event.type === "final_response") {
        // Backend emit() sends content at top level OR inside data — check both
        const ev = event as any;
        const responseText = ev.content || ev.data?.content || ev.response || "Response received.";
        const responderAgent = (event.agent as string) || "Jarvis";

        const coworkerChannelMap: Record<string, string> = {
          "sarah": "#support-tickets",
          "bobby": "#business-operations",
          "claire": "#engineering-trace",
          "jarvis": "#general-chat",
          "elena": "#creative-design",
          "marcus": "#financial-ops",
          "lex": "#security-audit",
          "mia": "#product-roadmap"
        };
        const targetChannel = coworkerChannelMap[responderAgent.toLowerCase()] || activeChannelRef.current;

        // ── Visual data panel ─────────────────────────────────
        const ev2 = event as any;
        const vizHint = ev2.viz_hint || ev2.data?.viz_hint;
        let vizData: VizData | null = null;
        // 1. Backend-provided hint (most reliable)
        if (vizHint && vizHint.viz_type) {
          vizData = parseVizHint(vizHint, responderAgent);
        }
        // 2. Frontend parser as fallback
        if (!vizData) {
          vizData = parseVisualContent(responseText, responderAgent);
        }
        if (vizData && !vizShownRef.current.has(responseText.substring(0, 40))) {
          vizShownRef.current.add(responseText.substring(0, 40));
          // Keep panel set small
          if (vizShownRef.current.size > 50) vizShownRef.current.clear();
        }

        setIsProcessing(false);
        speakText(responseText, responderAgent, targetChannel, false, vizData);
      } else if (event.type === "pipeline_error") {
        const errorText = event.message || "An internal error occurred.";
        const targetChannel = activeChannelRef.current;
        addMessage(targetChannel, "system", `Error: ${errorText}`);
        setIsProcessing(false);
      } else if (event.type === "confirmation_required") {
        const confirmMsg = event.message || "Confirmation required to proceed.";
        const targetChannel = activeChannelRef.current;
        setIsProcessing(false);
        speakText(confirmMsg, "Jarvis", targetChannel);
      } else if (event.type === "pipeline_complete") {
        // Conference modal is now closed via the speech-queue drain in onSpeechFinished — nothing needed here
        void 0;
      } else if (event.type === "switch_channel") {
        const ev = event as any;
        const targetChannel = ev.channel || ev.data?.channel;
        if (targetChannel) {
          setActiveChannel(targetChannel);
        }
      }
    });

    ws.onStatusChange = (connected) => setStatus(s => ({ ...s, connected }));

    ws.connect().catch(err => {
      console.error("Connection failed:", err);
      setStatus(s => ({ ...s, connected: false }));
    });

    wsRef.current = ws;
    return () => ws.disconnect();
  }, [sessionId, addLogEntry, speakText, addMessage, detectedGender]);

  const renderMessageContent = (content: string) => {
    if (!content) return null;
    const lines = content.split("\n");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {lines.map((line, lineIdx) => {
          const parseBold = (text: string) => {
            const parts = text.split(/(\*\*[^*]+\*\*)/g);
            return parts.map((part, partIdx) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong key={partIdx} style={{ color: "white", fontWeight: 600 }}>
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            });
          };

          // Check if it's a bullet item (starts with optional spaces, then - or * or +, then a space)
          const listMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
          // Check if it's a numbered item (starts with optional spaces, then digits, then . or ), then a space)
          const numMatch = line.match(/^(\s*)(\d+)[.)]\s+(.*)/);

          if (listMatch) {
            return (
              <div key={lineIdx} style={{ display: "flex", gap: 6, paddingLeft: 12, lineHeight: 1.5 }}>
                <span style={{ color: "var(--accent-cyan)", flexShrink: 0 }}>•</span>
                <span style={{ flex: 1 }}>{parseBold(listMatch[2])}</span>
              </div>
            );
          } else if (numMatch) {
            return (
              <div key={lineIdx} style={{ display: "flex", gap: 6, paddingLeft: 12, lineHeight: 1.5 }}>
                <span style={{ color: "var(--accent-cyan)", fontWeight: 600, flexShrink: 0 }}>
                  {numMatch[2]}.
                </span>
                <span style={{ flex: 1 }}>{parseBold(numMatch[3])}</span>
              </div>
            );
          }

          // Empty line
          if (line.trim() === "") {
            return <div key={lineIdx} style={{ height: 8 }} />;
          }

          // Normal line
          return (
            <div key={lineIdx} style={{ lineHeight: 1.5 }}>
              {parseBold(line)}
            </div>
          );
        })}
      </div>
    );
  };

  const sendMessage = async (text?: string) => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");

    // Silence any active speech when user submits a new text message
    stopPlayback();

    // Determine the source before resetting back to text default
    const source = inputSourceRef.current;
    inputSourceRef.current = "text"; // reset to default for keyboard typing

    // Detect conference protocol to activate the meeting modal (ARISE rollcall is separate, no modal)
    const msgLower = msg.toLowerCase();
    if (msgLower.includes("conference") || msgLower.includes("meeting")) {
      conferenceSessionRef.current = true;
      setConferenceActive(true);
      setConferenceSpeaker(null);
      setConferenceMinimized(false);
    }

    const targetChannel = activeChannelRef.current;
    addMessage(targetChannel, "user", msg);
    setIsProcessing(true);

    try {
      wsRef.current?.send("message", {
        content: msg,
        user_id: "default_user",
        channel: targetChannel,
        source: source,
        sent_at: Date.now(),
        gender: detectedGender
      });
    }
    catch {
      addMessage(targetChannel, "assistant", "Communication interrupt. Verify Neural Link.");
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden", position: "relative" }}>

      {/* ── Welcome Video Screen (Scroll controlled) ── */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            onClick={handleWelcomeClick}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "#000",
              zIndex: 99999,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
              cursor: welcomeEnded ? "pointer" : "ns-resize",
            }}
          >
            {/* Interactive video tag - full screen cover */}
            <video
              ref={videoRef}
              src={process.env.NEXT_PUBLIC_VIDEO_URL || "/welcome.mp4"}
              playsInline
              muted
              preload="auto"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none"
              }}
            />

            {/* Scroll Indicator overlay (shown at start and while scrubbing) */}
            {!welcomeEnded && (
              <div style={{
                position: "absolute",
                bottom: 50,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                color: "rgba(255, 255, 255, 0.6)",
                fontSize: 12,
                fontFamily: "var(--font-mono, monospace)",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                pointerEvents: "none",
                textShadow: "0 0 10px rgba(0,0,0,0.8)"
              }}>
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  style={{ fontSize: 18 }}
                >
                  ↓
                </motion.div>
                <span>Scroll down to initialize core</span>
                {/* Visual scrub bar */}
                <div style={{ width: 120, height: 2, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 1, marginTop: 4, position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${videoProgress * 100}%`, backgroundColor: "var(--accent-cyan)", boxShadow: "0 0 8px var(--accent-cyan)", transition: "width 0.1s ease" }} />
                </div>
              </div>
            )}

            {/* End Call to Action overlay */}
            <AnimatePresence>
              {welcomeEnded && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    position: "absolute",
                    bottom: 80,
                    padding: "12px 28px",
                    borderRadius: 30,
                    background: "rgba(0, 212, 255, 0.08)",
                    border: "1px solid rgba(0, 212, 255, 0.3)",
                    boxShadow: "0 0 20px rgba(0, 212, 255, 0.15), inset 0 0 10px rgba(0, 212, 255, 0.05)",
                    backdropFilter: "blur(12px)",
                    color: "#fff",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    pointerEvents: "none",
                    textAlign: "center"
                  }}
                >
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  >
                    Click anywhere to enter Aura OS
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Conference Meeting Modal ── */}
      <ConferenceMeetingModal
        isOpen={conferenceActive}
        currentSpeaker={conferenceSpeaker}
        isListening={isListening}
        toggleListening={toggleListening}
        sendMessage={sendMessage}
        onClose={() => {
          setConferenceActive(false);
          conferenceSessionRef.current = false;
          setConferenceSpeaker(null);
        }}
        isMinimized={conferenceMinimized}
        onToggleMinimize={() => setConferenceMinimized(prev => !prev)}
      />

      {/* ── Visual Data Panel ── */}
      <VisualDataPanel
        data={vizPanelData}
        onClose={() => setVizPanelData(null)}
      />

      {/* ── Main Chat Panel ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

        {/* ── Split Panel Content (Visualizer on Left, Chat on Right) ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Left Column: Core Controls & Visualizer */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "16px 20px 10px",
            overflowY: "hidden",
            position: "relative"
          }} className="scrollbar-hide">

            {/* Greeting (Navbar Dissolved Inline) */}
            <div style={{ alignSelf: "flex-start", width: "100%", paddingLeft: 20, marginBottom: 8 }}>
              <h1 style={{ fontSize: 16, fontWeight: 600, color: "white", letterSpacing: "-0.01em" }}>
                Welcome back, {detectedGender === "sir" ? "Sir" : "Ma'am"}.
              </h1>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                AURA is online and adaptive. Active: <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>{activeChannel}</span>
              </p>
            </div>

            {/* Visualizer & Controls Wrapper */}
            <div style={{
              flex: 1,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingLeft: "clamp(60px, 19vw, 260px)",
              position: "relative"
            }}>

              {/* Centered Content Wrapper for Visualizer & Badges */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", position: "relative" }}>
                {/* ── AURA CORE Title ── */}
                {/* At windowed: absolute overlay floating above the orb (zero layout height) */}
                {/* At fullscreen: relative positioning in normal flow */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                  style={{
                    textAlign: "center",
                    position: isWindowed ? "absolute" : "relative",
                    top: isWindowed ? 6 : -24,
                    left: isWindowed ? 0 : undefined,
                    right: isWindowed ? 0 : undefined,
                    zIndex: isWindowed ? 10 : undefined,
                    marginBottom: isWindowed ? 0 : 16,
                    pointerEvents: "none",
                  }}>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: "white", letterSpacing: "0.04em" }}>AURA CORE</h2>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>Online · Adaptive · Learning</p>
                </motion.div>

                {/* ── Orb Section with Floating Badges ── */}
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}
                  className="orb-canvas-section"
                  style={{ position: "relative", top: isWindowed ? 55 : 0, display: "flex", justifyContent: "center", alignItems: "center", minHeight: vizSize, margin: "0 auto", marginTop: orbMarginTop, marginBottom: orbMarginBottom, width: "100%", maxWidth: vizWidth + 20 }}>

                  {/* Floating badges around orb */}
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                    className="orb-badge" style={{ position: "absolute", left: -70, top: 70, zIndex: 20 }}>
                    <div className="badge-label">System Health</div>
                    <div className="badge-value">{liveStats?.system_health ?? 92}<span style={{ fontSize: 11, color: "var(--text-secondary)" }}>%</span></div>
                    <div className={liveStats ? (liveStats.system_health >= 90 ? "badge-sub text-green" : liveStats.system_health >= 80 ? "badge-sub text-cyan" : "badge-sub text-amber") : "badge-sub text-green"}>
                      {liveStats ? (liveStats.system_health >= 90 ? "Excellent" : liveStats.system_health >= 80 ? "Optimal" : "Degraded") : "Excellent"}
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}
                    className="orb-badge" style={{ position: "absolute", right: -10, top: 70, zIndex: 20 }}>
                    <div className="badge-label">Neural Sync</div>
                    <div className="badge-value">{liveStats?.neural_sync ?? 98.7}<span style={{ fontSize: 11, color: "var(--text-secondary)" }}>%</span></div>
                    <div className={liveStats ? (liveStats.neural_sync >= 90 ? "badge-sub text-cyan" : "badge-sub text-amber") : "badge-sub text-cyan"}>
                      {liveStats ? (liveStats.neural_sync >= 90 ? "Stable" : "Offline") : "Stable"}
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}
                    className="orb-badge" style={{ position: "absolute", left: -50, bottom: 70, zIndex: 20 }}>
                    <div className="badge-label">Memory Stream</div>
                    <div className="badge-value">{liveStats?.memory_stream_tb ?? 2.34} <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>TB</span></div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}
                    className="orb-badge" style={{ position: "absolute", right: 0, bottom: 70, zIndex: 20 }}>
                    <div className="badge-label">Active State</div>
                    <div className="badge-value" style={{ fontSize: 13 }}>
                      {visualizerState === "idle" ? "Standing By" : visualizerState === "listening" ? "Listening" : "Processing"}
                    </div>
                  </motion.div>

                  {/* The Orb */}
                  <AuraOrb state={visualizerState} amplitude={amplitude} size={vizSize} width={vizWidth} coworker={activeCoworker} />
                </motion.div>
              </div>

              {/* ── Coworker Selector below the Orb (Glassmorphic Horizontal Bar) ── */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  margin: isWindowed ? "2px auto 6px" : "6px auto 10px",
                  background: "rgba(255, 255, 255, 0.02)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: 20,
                  padding: "6px 12px",
                  width: "fit-content",
                  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                }}
              >
                {[
                  { id: "#general-chat", label: "Jarvis", role: "AI Assistant", icon: Brain, color: "var(--accent-cyan)", glow: "rgba(0, 212, 255, 0.3)" },
                  { id: "#business-operations", label: "Bobby", role: "Growth", icon: Zap, color: "var(--accent-purple)", glow: "rgba(139, 92, 246, 0.3)" },
                  { id: "#engineering-trace", label: "Claire", role: "Systems", icon: Terminal, color: "#ffffff", glow: "rgba(255, 255, 255, 0.2)" },
                  { id: "#support-tickets", label: "Sarah", role: "Support", icon: User, color: "var(--accent-green)", glow: "rgba(16, 185, 129, 0.3)" },
                  { id: "#creative-design", label: "Elena", role: "Design", icon: Palette, color: "#f43f5e", glow: "rgba(244, 63, 94, 0.3)" },
                  { id: "#financial-ops", label: "Marcus", role: "Finance", icon: Database, color: "#fbbf24", glow: "rgba(251, 191, 36, 0.3)" },
                  { id: "#security-audit", label: "Lex", role: "Security", icon: Shield, color: "#4f46e5", glow: "rgba(79, 70, 229, 0.3)" },
                  { id: "#product-roadmap", label: "Mia", role: "Roadmap", icon: Calendar, color: "#14b8a6", glow: "rgba(20, 184, 166, 0.3)" }
                ].map(cw => {
                  const isActive = activeChannel === cw.id;
                  return (
                    <motion.button
                      key={cw.id}
                      type="button"
                      suppressHydrationWarning={true}
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setActiveChannel(cw.id)}
                      style={{
                        background: isActive ? "rgba(255, 255, 255, 0.05)" : "transparent",
                        borderRadius: 14,
                        padding: "4px 10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        position: "relative",
                        boxShadow: isActive ? `0 0 16px ${cw.glow}` : "none",
                        border: isActive ? `1px solid ${cw.color}35` : "1px solid transparent",
                      }}
                    >
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        background: isActive ? `${cw.color}15` : "rgba(255, 255, 255, 0.02)",
                        border: `1px solid ${isActive ? cw.color : "rgba(255, 255, 255, 0.06)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isActive ? cw.color : "var(--text-muted)",
                        transition: "all 0.2s ease",
                      }}>
                        <cw.icon style={{ width: 11, height: 11 }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                        <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500, color: isActive ? "white" : "var(--text-secondary)" }}>
                          {cw.label}
                        </span>
                        <span style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.02em" }}>
                          {cw.role}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>

              {/* ── Command Input Bar ── */}
              <div style={{ width: "100%", maxWidth: 480, margin: "2px auto 0" }}>
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="input-bar" style={{ padding: isWindowed ? "4px 4px 4px 14px" : undefined }}>
                  <input value={input} onChange={e => {
                    setInput(e.target.value);
                    speechTranscriptRef.current = e.target.value;
                  }} placeholder="Give command to Aura..."
                    style={{ fontSize: isWindowed ? 12 : undefined }}
                    disabled={isProcessing} suppressHydrationWarning={true} />
                  <motion.button type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={handleToggleVoice}
                    suppressHydrationWarning={true}
                    title={isVoiceEnabled ? "Mute voice response" : "Unmute voice response"}
                    style={{
                      width: isWindowed ? 30 : 38, height: isWindowed ? 30 : 38, borderRadius: "50%", border: "none", cursor: "pointer",
                      background: isVoiceEnabled ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.05)",
                      color: isVoiceEnabled ? "var(--accent-purple)" : "var(--text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}>
                    {isVoiceEnabled ? <Volume2 style={{ width: isWindowed ? 13 : 16, height: isWindowed ? 13 : 16 }} /> : <VolumeX style={{ width: isWindowed ? 13 : 16, height: isWindowed ? 13 : 16 }} />}
                  </motion.button>
                  <motion.button type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={toggleListening}
                    suppressHydrationWarning={true}
                    title={isListening ? "Stop listening" : "Start voice input"}
                    style={{
                      width: isWindowed ? 30 : 38, height: isWindowed ? 30 : 38, borderRadius: "50%", border: "none", cursor: "pointer",
                      background: isListening ? "var(--accent-cyan)" : "rgba(0,212,255,0.15)",
                      color: isListening ? "#000" : "var(--accent-cyan)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: isListening ? "0 0 16px rgba(0,212,255,0.5)" : "none",
                      transition: "all 0.2s ease",
                    }}>
                    {isListening ? <MicOff style={{ width: isWindowed ? 13 : 16, height: isWindowed ? 13 : 16 }} /> : <Mic style={{ width: isWindowed ? 13 : 16, height: isWindowed ? 13 : 16 }} />}
                  </motion.button>
                </form>
              </div>
            </div>

          </div>

          {/* Right Column: Floating Chat Card (Detached & Top-Right Aligned) */}
          <div style={{
            width: 350,
            height: 280,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignSelf: "flex-start",
            marginTop: 16,
            marginRight: 32,
            borderRadius: 20,
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 12px 40px 0 rgba(0, 0, 0, 0.25)",
            overflow: "hidden"
          }}>

            {/* Chat Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(255, 255, 255, 0.01)"
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: activeChannel === "#business-operations" ? "rgba(139, 92, 246, 0.1)" :
                  activeChannel === "#engineering-trace" ? "rgba(255, 255, 255, 0.05)" :
                    activeChannel === "#support-tickets" ? "rgba(16, 185, 129, 0.1)" : "rgba(0, 212, 255, 0.1)",
                border: `1px solid ${activeChannel === "#business-operations" ? "var(--accent-purple)" :
                  activeChannel === "#engineering-trace" ? "rgba(255, 255, 255, 0.2)" :
                    activeChannel === "#support-tickets" ? "var(--accent-green)" : "var(--accent-cyan)"
                  }30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: activeChannel === "#business-operations" ? "var(--accent-purple)" :
                  activeChannel === "#engineering-trace" ? "white" :
                    activeChannel === "#support-tickets" ? "var(--accent-green)" : "var(--accent-cyan)"
              }}>
                {activeChannel === "#business-operations" ? <Zap style={{ width: 14, height: 14 }} /> :
                  activeChannel === "#engineering-trace" ? <Terminal style={{ width: 14, height: 14 }} /> :
                    activeChannel === "#support-tickets" ? <User style={{ width: 14, height: 14 }} /> : <Brain style={{ width: 14, height: 14 }} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "white" }}>
                  {activeCoworker} Channel
                </span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {activeChannel}
                </span>
              </div>
            </div>

            {/* Chat Logs List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }} className="scrollbar-hide">
              {messages.length === 0 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.25, padding: 20, textAlign: "center" }}>
                  <Brain style={{ width: 32, height: 32, marginBottom: 12, color: "var(--accent-cyan)" }} />
                  <span style={{ fontSize: 12 }}>No logs on this frequency.</span>
                </div>
              ) : (
                <div>
                  {messages.map((msg) => (
                    <div key={msg.id} style={{
                      padding: "12px 16px",
                      marginBottom: 12,
                      borderRadius: 14,
                      background: msg.role === "user" ? "rgba(0, 212, 255, 0.05)" : "var(--bg-card)",
                      border: "1px solid var(--border)",
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "var(--text-secondary)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          color: msg.role === "user" ? "var(--accent-cyan)" :
                            msg.role === "system" ? "var(--accent-red)" : "var(--accent-purple)"
                        }}>
                          {msg.role === "user" ? "OPERATOR" : msg.role === "system" ? "SYSTEM" : activeCoworker.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 8, color: "var(--text-muted)" }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      {renderMessageContent(msg.content)}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
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
