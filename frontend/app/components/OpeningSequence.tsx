"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OpeningSequenceProps {
  children: React.ReactNode;
}

const BOOT_TEXT = "INITIALIZING AURA CORE...";
const SESSION_KEY = "aura_os_booted";

/* ── Typing text with blinking cursor ──────── */
function TypewriterText({ text, onComplete }: { text: string; onComplete: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
        setTimeout(onComplete, 280);
      }
    }, 38);
    return () => clearInterval(interval);
  }, [text, onComplete]);

  return (
    <span
      style={{
        fontFamily: "'Space Grotesk', monospace",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.38em",
        textTransform: "uppercase",
        color: "rgba(0, 229, 255, 0.75)",
      }}
    >
      {displayed}
      <motion.span
        animate={{ opacity: done ? 0 : [1, 0] }}
        transition={{ duration: 0.55, repeat: done ? 0 : Infinity, ease: "linear" }}
        style={{ display: "inline-block", marginLeft: 1, color: "#00E5FF" }}
      >
        |
      </motion.span>
    </span>
  );
}

/* ══════════════════════════════════════════════
   OPENING SEQUENCE
══════════════════════════════════════════════ */
export function OpeningSequence({ children }: OpeningSequenceProps) {
  const [phase, setPhase] = useState<
    "black" | "glow" | "typing" | "orb" | "ui" | "done"
  >("black");
  const [showChildren, setShowChildren] = useState(false);
  const hasBooted = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (typeof window !== "undefined") {
      if (sessionStorage.getItem(SESSION_KEY)) {
        setPhase("done");
        setShowChildren(true);
        return;
      }
    }

    // Orchestrated boot sequence
    const t1 = setTimeout(() => setPhase("glow"),   120);   // tiny center glow
    const t2 = setTimeout(() => setPhase("typing"),  480);   // text appears
    const t3 = setTimeout(() => setPhase("orb"),     1150);  // orb activates
    const t4 = setTimeout(() => setPhase("ui"),      1600);  // ui fades in
    const t5 = setTimeout(() => {
      setPhase("done");
      setShowChildren(true);
      sessionStorage.setItem(SESSION_KEY, "1");
    }, 2050);

    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, []);

  if (phase === "done" && showChildren) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Boot overlay */}
      <AnimatePresence>
        {phase !== "done" && (
          <motion.div
            key="boot-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "#010306",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 32,
            }}
          >
            {/* Center glow seed */}
            <AnimatePresence>
              {(phase === "glow" || phase === "typing" || phase === "orb" || phase === "ui") && (
                <motion.div
                  key="center-glow"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                  style={{
                    position: "absolute",
                    width: 300,
                    height: 300,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(0,229,255,0.14) 0%, transparent 70%)",
                    filter: "blur(40px)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </AnimatePresence>

            {/* Condensed mini orb rings */}
            <AnimatePresence>
              {(phase === "orb" || phase === "ui") && (
                <motion.div
                  key="mini-orb"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: "absolute",
                    width: 120,
                    height: 120,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Outer ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 18, ease: "linear", repeat: Infinity }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: "1px solid rgba(0,229,255,0.2)",
                    }}
                  />
                  {/* Inner conic */}
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 8, ease: "linear", repeat: Infinity }}
                    style={{
                      position: "absolute",
                      inset: 18,
                      borderRadius: "50%",
                      background: "conic-gradient(from 0deg, transparent, rgba(0,229,255,0.6), transparent)",
                      opacity: 0.5,
                    }}
                  />
                  {/* Nucleus */}
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "white",
                      boxShadow: "0 0 20px 6px white, 0 0 40px 14px rgba(0,229,255,0.7)",
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Typing text */}
            <AnimatePresence>
              {(phase === "typing" || phase === "orb") && (
                <motion.div
                  key="boot-text"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    bottom: "calc(50% - 110px)",
                    textAlign: "center",
                  }}
                >
                  {phase === "typing" && (
                    <TypewriterText
                      text={BOOT_TEXT}
                      onComplete={() => {}} // handled by timeout
                    />
                  )}
                  {phase === "orb" && (
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', monospace",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.38em",
                        textTransform: "uppercase",
                        color: "rgba(0, 229, 255, 0.55)",
                      }}
                    >
                      {BOOT_TEXT}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Version tag */}
            <AnimatePresence>
              {(phase === "orb" || phase === "ui") && (
                <motion.div
                  key="version"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.35 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    position: "absolute",
                    bottom: 40,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "0.4em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  AURA OS &nbsp;·&nbsp; v5.0
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UI fades in underneath */}
      <AnimatePresence>
        {showChildren && (
          <motion.div
            key="ui-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
