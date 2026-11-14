# AURA OS (JARVIS AI OS) — Master Project State & Knowledge Base

> **Purpose for New Chat Threads:**  
> This file contains the complete, authoritative summary of the entire project history, architecture, decisions, debugging sessions, tool integrations, and recent fixes.  
> When starting a new conversation thread, prompt the assistant:  
> **"Read `PROJECT_STATE.md` to get the complete context of the project and where we left off."**

---

## 1. Project Overview & Vision
- **Project Name:** AURA OS
- **Core AI Identity:** **SERAMA** (Replacing legacy "JARVIS")
  - **Full Form:** **"System Evolving Rapidly And Managing All"** *(Tony Stark / EDITH style punchy backronym)*
- **Repository:** `https://github.com/heatblaze/Aura_OS.git`
- **Current Version:** 2.0.0+ (Phase 3 active)
- **Workspace Path:** `d:\daw n\P.A`
- **Core Concept:** An autonomous, proactive, multi-agent AI operating system. Moves beyond simple conversational wrappers into real digital agency with task planning, real-time operating system execution, scheduled living tasks, and proactive background scans.
- **Frontend Stack:** Next.js 14, React, TypeScript, Tailwind/Vanilla CSS (dark glassmorphic "Mission Control" UI), WebSockets, Framer Motion.
- **Backend Stack:** FastAPI (Python 3.11+ in `backend/venv`), Uvicorn, PostgreSQL (asyncpg/SQLAlchemy), Redis, ChromaDB, APScheduler (SQLAlchemyJobStore on SQLite).
- **Hosting / Deployments:**
  - Frontend: Vercel (`https://aura-os-cyan-ten.vercel.app`)
  - Backend: Render Web Service (`https://...onrender.com`)

---

## 2. Core Multi-Agent Architecture

### A. The 5-Agent Core Execution Pipeline
Every user directive goes through a strict sequential multi-agent loop managed by `backend/core/orchestrator.py`:
1. **Memory Pre-Hydration & Injection (Step 0 & 1):** Loads context from `markdown_brain.py` (`learned_experience.md`, past tasks) and retrieves short-term session memory.
2. **Intent Engine (Step 2):** Extracts user intent, action category, and entities using `intent_engine.extract()`.
3. **Commander Agent (Step 3):** Determines the macro strategy (`direct_response`, `tool_execution`, `multi_step`, or `clarification_needed`) and lists required tools.
4. **Planner Agent (Step 4):** Breaks down the goal into atomic executable steps, calculates exact ISO 8601 timestamps based on the user's localized timezone (`Asia/Kolkata` / UTC+05:30), and sets parameters.
5. **Simulation Engine (Step 4.5):** Validates steps before execution. If high risk, triggers a confirmation request.
6. **Executor Agent (Step 5):** Calls native Python tools from `backend/core/tool_registry.py` and emits step-by-step progress via WebSockets (`backend/core/message_bus.py`).
7. **Critic Agent (Step 6):** Verifies tool outputs, detects missing data or errors, and suggests corrections.
8. **Response Synthesizer & Experience Compiler:** Generates grounded natural responses and updates `learned_experience.md` / KRONOS persistent memory.

### B. The 8 Coworker Personas & Channel System
The OS features 8 distinct coworker channels (`backend/config/personas/*.json`):
1. **Jarvis** (`#general-chat`): Core OS coordinator, system command dispatcher, announcer.
2. **Bobby** (`#business-operations`): Growth specialist, user acquisition, web search research.
3. **Claire** (`#engineering-trace`): Systems engineer, terminal diagnostics, CLI execution.
4. **Sarah** (`#support-tickets`): Support assistant, email communications, calendar meetings.
5. **Elena** (`#creative-design`): Creative director, UI/UX asset generation (`generate_image`).
6. **Marcus** (`#financial-ops`): Financial analyst, cost calculations, market research.
7. **Lex** (`#security-audit`): Security guard, environment audits, permission checking.
8. **Mia** (`#product-roadmap`): Product planner, timeline and dependency tracking.

*(Note: Coworker channel switches and task delegation are detected via regex patterns like "ask Claire..." or "switch to Bobby" in `orchestrator.py`).*

---

## 3. Tool Ecosystem (`backend/core/tool_registry.py` & `backend/tools/`)
The tool registry manages 10 registered tools:
1. `local_system`: Windows system commands, detached desktop application launching (`start explorer`, `start notepad`, `start calc`, `start cmd`).
2. `google_calendar`: Google Calendar OAuth2 integration (read events within `timeMin`/`timeMax` ISO strings, create events).
3. `gmail`: Google Mail API (drafting and sending emails).
4. `web_search`: DuckDuckGo / SerpAPI web searching.
5. `browser_automation`: Playwright headless browser for web extraction.
6. `twilio`: Base Twilio communication service.
7. `twilio_sms`: Outbound SMS via Twilio.
8. `twilio_call`: Outbound voice calls (immediate or scheduled).
9. `system_clock`: World time, local time, and timezone offset calculations.
10. `generate_image`: Visual generation / mockup synthesis for Elena.

---

## 4. Telephony & Living System Daemon (`living_daemon.py`)
- **APScheduler & Persistent Storage:** Runs an `AsyncIOScheduler` backed by `SQLAlchemyJobStore` storing scheduled jobs in `backend/storage/scheduled_tasks.db`.
- **Scheduled Call Feature:**
  - Tasks can be scheduled for future execution (e.g. *"Call +918418071066 at 12:37 AM IST"*).
  - Fixed pickling bug: Converted the inner execution wrapper to a top-level function `execute_scheduled_living_task(...)` so SQLAlchemy can serialize it into SQLite without failing.
  - When the scheduled time arrives, it executes `trigger_phone_call_reminder` to initiate the Twilio call.
- **Twilio Trial Account Characteristics:**
  - Twilio Free Trial accounts inject a mandatory pre-roll: *"Thanks for testing Twilio! Press any key to execute your code."*
  - **Crucial operational behavior:** The recipient MUST press a key (e.g. `1`) on their dial pad to trigger Twilio to proceed to speaking the actual custom reminder message (`<Say>...</Say>`).
  - Destination numbers on trial accounts must be verified in the Twilio Console under **Verified Caller IDs**.
- **Voice Engine Difference (Twilio vs Web UI):**
  - Web UI uses Deepgram Aura (`aura-2-draco-en`) / Edge-TTS via `/api/tts`.
  - Twilio calls execute server-side TwiML `<Say voice='Polly.Amy'>` (Amazon Polly). Twilio cannot directly run Deepgram inside `<Say>` without hosting pre-rendered MP3 audio files on a public HTTPS endpoint and using `<Play>`.

---

## 5. Critical Problem Diagnosed & Fixed (`968d473`)

### The Incident
When the user gave the directive:
`"Can you give a call to +918418071066 at 12:37 AM IST?"`
The system logged:
- Step 2: Intent agent routed to Groq Cloud.
- Step 3: Commander agent routed to Groq Cloud.
- **3.5 minutes of complete silence.** The call was never scheduled, and the pipeline died until the experience compiler ran.

### Root Cause Analysis
1. **Groq HTTP 429 Rate Limiting:** Groq was temporarily rate-limiting requests. The code treated 429 as a hard failure, immediately giving up without retrying or respecting `Retry-After`.
2. **Dumb Sequential Fallback Chain:**
   `Groq fail` -> `NVIDIA fail` -> `Ollama hang (120 seconds)` -> `Emergency string fallback`.
3. **120-Second Ollama Timeout on Cloud:** On Render, Ollama does not exist. The client spent 120 seconds waiting on each offline agent step.
4. **Emergency String Fallback Collapsed the Pipeline:**
   When all providers failed, `llm_client.py` returned:
   `'{"summary": "Direct conversational response", "strategy": "direct_response", "requires_tools": false, "tools_needed": []}'`
   Because `requires_tools` was set to `False`, the Orchestrator assumed the user just wanted to chat and completely skipped the Planner and Executor! The Twilio call was never reached.

### The Solution Implemented
1. **Intelligent Fallback & `ProviderHealth` Circuit Breaker (`backend/core/llm_client.py`):**
   - Created `ProviderHealth` to track consecutive failures and cooldown timers.
   - Detects `429` status code, inspects `Retry-After` header. If the delay is $\le 3$s, it sleeps and automatically retries.
   - Multi-key rotation: Tries `GROQ_API_KEY` -> `GROQ_API_KEY_SECONDARY` -> `NVIDIA_API_KEY` -> Local Ollama.
   - If a provider fails or times out, it is placed on cooldown (15s–60s) so downstream agents in the same request don't repeatedly wait on a broken provider.
   - Context-aware emergency fallback: If all providers fail, it inspects keywords (`call`, `phone`, `twilio`) and returns `requires_tools: true` with `twilio_call` instead of silently dying.
2. **Lowered Ollama Timeout (`backend/config/settings.py`):**
   - Reduced `OLLAMA_TIMEOUT` from `120s` to `5s` so cloud environments never hang.
3. **Wired Twilio Scheduled Calls (`backend/tools/tools.py`):**
   - `TwilioCallTool` now parses `run_at` ISO strings. If in the future, it registers with `living_daemon.schedule_task(...)` and persists to SQLite.
4. **Agent Prompts Aligned:**
   - Updated `CommanderAgent` to select `twilio_call` whenever a phone directive is given.
   - Updated `PlannerAgent` to extract phone numbers in E.164 (`+91...`) and calculate absolute ISO 8601 timestamps for `run_at`.

---

## 6. Key Realities & Clarifications Established
1. **Agent Communication:** The multi-agent system is currently a structured data pipeline (`dict` passing), not an unconstrained free-form conversation between agents. Prompts are dynamic, but execution flow is sequential.
2. **Token Mechanics:** It is impossible to "masquerade" an entire prompt into a single token. Tokenization is handled strictly on LLM provider servers using fixed BPE tokenizers. To reduce token usage, pipeline steps should be merged (e.g. combining Intent + Commander) and system prompts kept compact.
3. **Git & Deployment:**
   - Recent fixes committed in commit `968d473`.
   - `.env` files are properly git-ignored and safe.
   - `scheduled_tasks.db` is intentionally kept local to avoid shipping test tasks to Render.
   - Any API keys updated locally (like `HUGGINGFACE_API_KEY` or Twilio keys) must also be mirrored in Render's environment dashboard for production deployment.

---

## 7. Immediate Running & Testing Commands
- **Backend Virtual Environment:** `backend\venv\Scripts\python.exe`
- **Start Local Backend:**
  ```powershell
  backend\venv\Scripts\python -m uvicorn backend.main:app --port 8000 --reload
  ```
- **Start Frontend:**
  ```powershell
  cd frontend
  npm run dev
  ```

