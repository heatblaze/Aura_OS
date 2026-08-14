"use client";

import React, { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Terminal,
  TrendingUp,
  LifeBuoy,
  Palette,
  DollarSign,
  ShieldCheck,
  Calendar,
  Globe
} from "lucide-react";

interface LandingPageProps {
  onLaunchOS: (channelId?: string) => void;
  liveStats?: {
    neural_sync?: number;
    latency_ms?: number;
    system_health?: number;
    memory_stream?: string;
  };
}

export const COWORKERS = [
  {
    id: "#general-chat",
    name: "Jarvis",
    role: "Core OS Orchestrator",
    specialty: "Coordinates multi-agent workflows & directive routing across channels.",
    icon: Brain,
    color: "#00d4ff"
  },
  {
    id: "#engineering-trace",
    name: "Claire",
    role: "Systems Engineer",
    specialty: "Executes terminal scripts, debugs stack traces, automates CLI tools.",
    icon: Terminal,
    color: "#10b981"
  },
  {
    id: "#business-operations",
    name: "Bobby",
    role: "Growth Analyst",
    specialty: "Analyzes user acquisition, market trends & search intelligence.",
    icon: TrendingUp,
    color: "#ec4899"
  },
  {
    id: "#support-tickets",
    name: "Sarah",
    role: "Operations Assistant",
    specialty: "Manages Gmail communications & Google Calendar scheduling.",
    icon: LifeBuoy,
    color: "#f59e0b"
  },
  {
    id: "#creative-design",
    name: "Elena",
    role: "Creative Director",
    specialty: "Generates visual assets, UI layouts, and brand graphics.",
    icon: Palette,
    color: "#8b5cf6"
  },
  {
    id: "#financial-ops",
    name: "Marcus",
    role: "Financial Analyst",
    specialty: "Audits token consumption, API costs, and financial projections.",
    icon: DollarSign,
    color: "#eab308"
  },
  {
    id: "#security-audit",
    name: "Lex",
    role: "Security Guard",
    specialty: "Scans env encryption, permission safety, and threat boundaries.",
    icon: ShieldCheck,
    color: "#ef4444"
  },
  {
    id: "#product-roadmap",
    name: "Mia",
    role: "Product Lead",
    specialty: "Maintains feature backlogs, dependency trees & timelines.",
    icon: Calendar,
    color: "#06b6d4"
  }
];

export function LandingPage({ onLaunchOS, liveStats }: LandingPageProps) {
  const [selectedAgent, setSelectedAgent] = useState("#general-chat");

  return (
    <div className="bg-black text-white min-h-screen w-full overflow-x-hidden font-sans selection:bg-white selection:text-black flex flex-col items-center">

      {/* ══════════════════════════════════════════════
         SECTION 1 -- HERO SECTION (SPACIOUS & PERFECTLY CENTERED)
      ══════════════════════════════════════════════ */}
      <section className="min-h-screen relative overflow-hidden flex flex-col justify-between items-center w-full">

        {/* Background Video */}
        <video
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover object-bottom pointer-events-none z-0"
        />

        {/* Spacer Top */}
        <div className="pt-16" />

        {/* Hero Center Content (Spacious & Center Aligned) */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center max-w-3xl w-full px-6 my-auto" style={{ transform: "translateY(-100px)" }}>

          {/* Main Title */}
          <h1 className="text-7xl sm:text-8xl md:text-9xl text-white tracking-tight font-serif-instrument mb-8 leading-none text-center w-full">
            AURA <em className="italic font-serif">OS</em>
          </h1>

          {/* Subtitle with Ample Bottom Margin */}
          <p className="text-white/85 text-base sm:text-lg md:text-xl leading-relaxed max-w-xl mx-auto mb-16 text-center font-normal" style={{ marginTop: "20px" }}>
            The proactive neural operating system linking 8 autonomous AI coworkers across engineering, marketing, financial modeling, and security.
          </p>

          {/* Uiverse Glow Letter Button for LAUNCH OS */}
          <div className="btn-wrapper mt-4 mb-8" style={{ marginTop: "40px" }}>
            <button className="btn" onClick={() => onLaunchOS(selectedAgent)}>
              <svg className="btn-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                ></path>
              </svg>

              <div className="txt-wrapper">
                <div className="txt-1">
                  <span className="btn-letter">L</span>
                  <span className="btn-letter">a</span>
                  <span className="btn-letter">u</span>
                  <span className="btn-letter">n</span>
                  <span className="btn-letter">c</span>
                  <span className="btn-letter">h</span>
                  <span className="btn-letter">&nbsp;</span>
                  <span className="btn-letter">O</span>
                  <span className="btn-letter">S</span>
                </div>
                <div className="txt-2">
                  <span className="btn-letter">L</span>
                  <span className="btn-letter">a</span>
                  <span className="btn-letter">u</span>
                  <span className="btn-letter">n</span>
                  <span className="btn-letter">c</span>
                  <span className="btn-letter">h</span>
                  <span className="btn-letter">i</span>
                  <span className="btn-letter">n</span>
                  <span className="btn-letter">g</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Social Icons Footer */}
        <div className="relative z-10 flex justify-center gap-4 pb-14">
          <a href="#" onClick={(e) => { e.preventDefault(); onLaunchOS(selectedAgent); }} className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/10 transition-all">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); onLaunchOS(selectedAgent); }} className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/10 transition-all">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.936 9.936 0 0024 4.59z" />
            </svg>
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); onLaunchOS(selectedAgent); }} className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/10 transition-all">
            <Globe className="w-5 h-5" />
          </a>
        </div>
      </section>


      {/* ══════════════════════════════════════════════
         SECTION 2 -- ABOUT SECTION (CENTERED)
      ══════════════════════════════════════════════ */}
      <AboutSection />


      {/* ══════════════════════════════════════════════
         SECTION 3 -- FEATURED VIDEO SECTION (CENTERED)
      ══════════════════════════════════════════════ */}
      <FeaturedVideoSection />


      {/* ══════════════════════════════════════════════
         SECTION 4 -- PHILOSOPHY (CENTERED)
      ══════════════════════════════════════════════ */}
      <PhilosophySection />


      {/* ══════════════════════════════════════════════
         SECTION 5 -- SERVICES (CENTERED)
      ══════════════════════════════════════════════ */}
      <ServicesSection />


      {/* ══════════════════════════════════════════════
         SECTION 6 -- COWORKERS TEAM ROSTER (FULL-WIDTH CENTERED GRID)
      ══════════════════════════════════════════════ */}
      <section id="team" style={{ paddingTop: "100px", paddingBottom: "80px" }} className="bg-black px-6 md:px-12 w-full flex flex-col items-center text-center">
        <div className="max-w-6xl w-full flex flex-col items-center text-center">
          <div className="text-center w-full" style={{ marginBottom: "60px" }}>
            <h2 className="text-4xl md:text-5xl lg:text-6xl text-white font-serif-instrument text-center">
              Meet the <em className="italic font-serif">Aura OS Team</em>
            </h2>
          </div>

          {/* 4x2 Grid of 3D Flipping Coworker Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
            {COWORKERS.map((cw) => {
              const isSelected = selectedAgent === cw.id;
              const Icon = cw.icon;

              return (
                <div
                  key={cw.id}
                  onClick={() => setSelectedAgent(cw.id)}
                  className="team-card-container relative min-h-[250px] h-[250px] w-full cursor-pointer"
                >
                  {/* 3D Inner Container */}
                  <div
                    className={`team-card-inner rounded-3xl ${isSelected ? "ring-2 ring-white/50 shadow-[0_0_30px_rgba(255,255,255,0.15)]" : ""
                      }`}
                  >
                    {/* ── FRONT FACE (Centered Logo, Name & Role) ── */}
                    <div
                      className={`team-card-front liquid-glass rounded-3xl p-7 flex flex-col items-center justify-center text-center transition-all ${isSelected ? "bg-white/12 border-white/40" : "bg-black/40 hover:bg-white/5"
                        }`}
                    >
                      {/* Icon Logo Container (Spacious Bottom Margin) */}
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-lg"
                        style={{ backgroundColor: `${cw.color}20`, border: `1.5px solid ${cw.color}` }}
                      >
                        <Icon className="w-8 h-8" style={{ color: cw.color }} />
                      </div>

                      {/* Name */}
                      <h3 className="text-white font-bold text-2xl tracking-tight mb-1">{cw.name}</h3>

                      {/* Role */}
                      <span className="text-xs font-semibold tracking-wide" style={{ color: cw.color }}>
                        {cw.role}
                      </span>

                      {/* Hover hint */}
                      <span className="absolute bottom-4 text-[10px] uppercase font-mono tracking-widest text-white/40">
                        Hover for info
                      </span>
                    </div>

                    {/* ── BACK FACE (Flipped 180deg on Hover - Perfectly Fitted Content) ── */}
                    <div
                      className="team-card-back liquid-glass rounded-3xl p-6 flex flex-col items-center justify-between text-center bg-black/95 backdrop-blur-2xl border border-white/30 shadow-2xl transition-all relative overflow-hidden"
                    >
                      {/* Top Header (Always 100% Centered) */}
                      <div className="w-full flex flex-col items-center justify-center pt-2 px-4">
                        <span className="text-sm font-bold text-white leading-tight truncate max-w-full">{cw.name}</span>
                        <span className="text-[10px] font-semibold tracking-wider uppercase leading-tight truncate max-w-full mt-0.5" style={{ color: cw.color }}>
                          {cw.role}
                        </span>
                      </div>

                      {/* Specialty Description (Spacious Padding from Borders) */}
                      <p className="text-white/85 text-xs leading-relaxed font-normal my-auto px-4 max-w-[85%] mx-auto text-center">
                        {cw.specialty}
                      </p>

                      {/* Action Prompt */}
                      <div className="w-full pt-2.5 border-t border-white/10 flex items-center justify-center gap-1 text-cyan-400">
                        <span className="text-[10px] font-bold uppercase tracking-widest">Select Agent</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-black py-12 px-6 border-t border-white/10 text-center text-white/40 text-xs w-full">
        <p>© 2026 Aura OS. All rights reserved.</p>
      </footer>
    </div>
  );
}


/* ══════════════════════════════════════════════
   SECTION 2 -- ABOUT SECTION COMPONENT (CENTERED)
══════════════════════════════════════════════ */
function AboutSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" ref={ref} style={{ paddingTop: "120px", paddingBottom: "40px" }} className="bg-black px-6 md:px-12 overflow-hidden relative w-full flex justify-center">
      <div className="max-w-5xl w-full flex flex-col items-center text-center">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-white/40 text-xs tracking-widest uppercase block mb-6 text-center font-mono"
        >
          About Aura OS
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white leading-[1.15] tracking-tight font-serif-instrument text-center w-full"
        >
          About <em className="italic font-serif text-white/60">Aura OS</em> <br className="hidden md:inline" />
        </motion.h2>
      </div>
    </section>
  );
}


/* ══════════════════════════════════════════════
   SECTION 3 -- FEATURED VIDEO SECTION COMPONENT (CENTERED)
══════════════════════════════════════════════ */
function FeaturedVideoSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section style={{ paddingTop: "20px", paddingBottom: "60px" }} className="bg-black px-6 md:px-12 overflow-hidden w-full flex justify-center">
      <div ref={ref} className="max-w-5xl w-full flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9 }}
          className="rounded-3xl overflow-hidden aspect-video relative group w-full shadow-2xl border border-white/10"
        >
          {/* Video */}
          <video
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260402_054547_9875cfc5-155a-4229-8ec8-b7ba7125cbf8.mp4"
            muted
            autoPlay
            loop
            playsInline
            preload="auto"
            className="w-full h-full object-cover"
          />

          {/* Subtle Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

          {/* Bottom Left "Our Approach" Liquid Glass Card */}
          <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 z-10 max-w-lg">
            <div
              className="liquid-glass rounded-2xl text-left bg-black/70 backdrop-blur-xl border border-white/20 shadow-2xl"
              style={{ padding: "12px 28px" }}
            >
              <span className="text-white/90 text-m tracking-widest uppercase block mb-3 font-mono">
                Our Approach
              </span>
              <p className="text-white/70 text-sm md:text-base leading-relaxed m-0">
                An integrated multi-agent workspace uniting 8 specialized AI agents across engineering, finance, marketing, and security.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}


/* ══════════════════════════════════════════════
   SECTION 4 -- PHILOSOPHY COMPONENT (CENTERED)
══════════════════════════════════════════════ */
function PhilosophySection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section style={{ paddingTop: "80px", paddingBottom: "60px" }} className="bg-black px-6 md:px-12 overflow-hidden w-full flex justify-center">
      <div ref={ref} className="max-w-5xl w-full flex flex-col items-center">
        {/* Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl lg:text-8xl text-white tracking-tight mb-16 md:mb-24 font-serif-instrument text-center w-full"
        >
          Innovation <em className="italic font-serif text-white/40">x</em> Vision
        </motion.h2>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center w-full">
          {/* Left Video */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="rounded-3xl overflow-hidden aspect-[4/3] w-full shadow-2xl border border-white/10"
          >
            <video
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4"
              muted
              autoPlay
              loop
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
            />
          </motion.div>

          {/* Right Text Blocks */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col gap-8 text-left"
          >
            <div>
              <span className="text-white/40 text-xs tracking-widest uppercase block mb-4 font-mono">Autonomous Agency</span>
              <p className="text-white/80 text-base md:text-lg leading-relaxed">
                Every task is dynamically evaluated and delegated to specialized AI agent personas built with dedicated domain knowledge and tool executions.
              </p>
            </div>

            <div className="w-full h-px bg-white/10" />

            <div>
              <span className="text-white/40 text-xs tracking-widest uppercase block mb-4 font-mono">Neural Collaboration</span>
              <p className="text-white/80 text-base md:text-lg leading-relaxed">
                Agents communicate in real time across specialized channel rooms, sharing context and executing multi-step problem solving.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}


/* ══════════════════════════════════════════════
   SECTION 5 -- SERVICES COMPONENT (CENTERED)
══════════════════════════════════════════════ */
function ServicesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" style={{ paddingTop: "80px", paddingBottom: "60px" }} className="bg-black px-6 md:px-12 overflow-hidden relative w-full flex justify-center">
      <div ref={ref} className="max-w-5xl w-full flex flex-col items-center">
        {/* Header Row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="w-full text-left"
          style={{ marginBottom: "60px" }}
        >
          <h2 className="text-3xl md:text-5xl text-white tracking-tight font-serif-instrument">What we do</h2>
        </motion.div>

        {/* 2-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full">
          {/* Card 1 */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="liquid-glass rounded-3xl overflow-hidden group text-left border border-white/10"
          >
            <div className="aspect-video overflow-hidden relative">
              <video
                src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
                muted
                autoPlay
                loop
                playsInline
                preload="auto"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </div>

            <div style={{ padding: "32px 36px" }}>
              <div className="flex items-center justify-between mb-4">
                <span className="uppercase tracking-widest text-white/40 text-xs font-mono">Orchestration</span>
                <div className="liquid-glass rounded-full p-2">
                  <ArrowUpRight className="w-4 h-4 text-white" />
                </div>
              </div>
              <h3 className="text-white text-xl md:text-2xl mb-3 tracking-tight font-serif-instrument">Multi-Agent Routing</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Jarvis dynamically orchestrates requests across specialized agent personas, ensuring precise domain execution.
              </p>
            </div>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="liquid-glass rounded-3xl overflow-hidden group text-left border border-white/10"
          >
            <div className="aspect-video overflow-hidden relative">
              <video
                src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260402_054547_9875cfc5-155a-4229-8ec8-b7ba7125cbf8.mp4"
                muted
                autoPlay
                loop
                playsInline
                preload="auto"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </div>

            <div style={{ padding: "32px 36px" }}>
              <div className="flex items-center justify-between mb-4">
                <span className="uppercase tracking-widest text-white/40 text-xs font-mono">Performance</span>
                <div className="liquid-glass rounded-full p-2">
                  <ArrowUpRight className="w-4 h-4 text-white" />
                </div>
              </div>
              <h3 className="text-white text-xl md:text-2xl mb-3 tracking-tight font-serif-instrument">Sub-100ms Inference</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Powered by Groq 20B engines with duplex voice streaming and real-time visual panel generation.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
