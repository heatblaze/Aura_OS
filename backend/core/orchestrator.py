"""
Orchestrator — the main pipeline that coordinates all 5 agents.
Flow: Memory → Intent → Commander → Planner → Executor → Critic → Memory → Response
"""
import time
import os
import json
import sys
from typing import Optional

# Reconfigure stdout/stderr to support Unicode emojis on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
# pyrefly: ignore [missing-import]
import structlog

from backend.agents.commander import CommanderAgent
from backend.agents.planner import PlannerAgent
from backend.agents.executor import ExecutorAgent
from backend.agents.memory_agent import MemoryAgent
from backend.agents.critic import CriticAgent
from backend.core.intent_engine import intent_engine
from backend.core.tool_registry import tool_registry
from backend.core.message_bus import emit
from backend.memory.short_term import short_term_memory
from backend.memory.markdown_brain import markdown_brain
from backend.execution.simulator import simulation_engine

logger = structlog.get_logger(__name__)


RESPONSE_SYSTEM_PROMPT = """You are JARVIS, an autonomous AI operating system.
Generate a clear, helpful, concise response to the user based on the execution results.
Be direct and actionable. Use markdown formatting when helpful.
If an action was completed, confirm it clearly.
If something failed, explain why and offer alternatives.
Do NOT mention internal agent names or system details unless specifically asked."""

DIRECTIVES_PROCESSED = 0


def load_persona(channel: str) -> Optional[dict]:
    """Load agent persona configuration based on channel routing."""
    mapping = {
        "#business-operations": "bobby.json",
        "#engineering-trace": "claire.json",
        "#support-tickets": "sarah.json",
        "#creative-design": "elena.json",
        "#financial-ops": "marcus.json",
        "#security-audit": "lex.json",
        "#product-roadmap": "mia.json"
    }
    filename = mapping.get(channel)
    if not filename:
        return None
    
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    path = os.path.join(base_dir, "backend", "config", "personas", filename)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return None


COWORKER_DIRECTORY = """
AURA MULTI-AGENT TEAM DIRECTORY:
- Jarvis (General Chat): The core OS announcer and orchestrator, routing channel "#general-chat".
- Bobby (Growth Specialist): Expert in user acquisition, marketing analytics, and web search, routing channel "#business-operations".
- Claire (Systems Engineer): Expert in software designs, systems diagnostics, and command-line execution, routing channel "#engineering-trace".
- Sarah (Support Assistant): Expert in email communications, scheduling, and support tickets, routing channel "#support-tickets".
- Elena (Creative Director / Designer): Expert in UI/UX design, visual layouts, and asset/image generation, routing channel "#creative-design".
- Marcus (Financial Analyst): Expert in API cost calculation, budgeting, and financial market research, routing channel "#financial-ops".
- Lex (Security Guard): Expert in security audits, env checks, permission reviews, and vulnerability scans, routing channel "#security-audit".
- Mia (Product Planner): Expert in roadmap planning, project dependency tracking, and timeline planning, routing channel "#product-roadmap".

You are part of this collaborative multi-agent coworker suite. You are fully aware of your active coworkers, their designated specialties, and their routing channels. You can mention them by name and recommend the user switch to their channel when tasks fall under their expertise.
"""


async def _build_system_prompt(persona: Optional[dict] = None, session_id: Optional[str] = None) -> str:
    """Build the system prompt with the current brain context and active coworker persona injected."""
    brain_context = markdown_brain.build_context_injection(max_chars=3000)
    
    # Import tool_registry to avoid circular dependencies
    from backend.core.tool_registry import tool_registry
    configured_tools = ", ".join(tool_registry.list_configured()) or "No external tools configured (local system only)"
    
    gender = "sir"
    if session_id:
        gender = await short_term_memory.get(session_id, "gender", "sir")

    self_ref_instruction = ""
    if persona:
        role_prompt = f"You are {persona['name']}, the {persona['role']}. {persona['system_prompt']}"
        self_ref_instruction = f"""
IMPORTANT: You are currently active as {persona['name']}. Do NOT refer to yourself in the third person (e.g., do NOT say "My colleague {persona['name']} can help you" or "{persona['name']} might be able to assist"). Instead, speak directly in the first person ("I can help you with that").
Also, do NOT recommend the user switch to your own channel or persona, since you are already active as that persona!

VISUAL DISPLAY PANEL RULE:
To show the user charts, tables, code blocks, checklists, design metrics, or rich text visual mockups, format your response content using one of these structural syntax:
1. A Markdown table (pipe-delimited) to show lists, options, or data comparisons.
2. A fenced JSON code block (```json ... ```) with keys and values to render bar charts or numeric metric cards.
3. A parenthesized visual instruction like `(Visual description: ...)` to render a rich informational text panel.
When the user explicitly asks you to show details in a "window", "popup", "chart", "table", or "visual panel", you MUST structure the data with one of the above formats so the system can intercept and display it in a draggable popup window!
"""
    else:
        role_prompt = "You are JARVIS (AURA), an autonomous AI operating system."

    from datetime import datetime
    from zoneinfo import ZoneInfo
    client_tz = None
    if session_id:
        client_tz = await short_term_memory.get(session_id, "timezone")
    if not client_tz:
        client_tz = "Asia/Kolkata"
        
    try:
        tz = ZoneInfo(client_tz)
        now = datetime.now(tz)
    except Exception:
        now = datetime.now().astimezone()
        
    # Format current_time to be human-readable and natural (e.g. "Tuesday, June 09, 2026, 05:29:32 PM (IST, UTC+05:30)")
    current_time = now.strftime("%A, %B %d, %Y, %I:%M:%S %p (%Z, UTC%z)")
    tz_offset = now.strftime("%z")
    if len(tz_offset) == 5:
        current_time = current_time.replace(tz_offset, f"{tz_offset[:3]}:{tz_offset[3:]}")
        
    CONFERENCE_CONTEXT_PROMPT = """
COLLABORATIVE CONTEXT (ACTIVE STATUS MEETING):
- You are in a live team session with other active agents (Jarvis, Bobby, Claire, Sarah, Elena, Marcus, Lex, Mia).
- Actively react to the ongoing discussion. Address other agents by name naturally if the user asks a collaborative question.
- OCCASIONAL HUMOR: You are allowed to crack light sci-fi, software engineering, or role-based jokes occasionally (keep it natural, witty, and rare—about 20% of responses). Do NOT force a joke in every turn.
- VISUAL DESCRIPTIONS: If you need to present comparative data, logs, costs, tables, or charts, describe the visual elements directly in your response. The system will automatically project a visual mockup panel next to your speech. Always state what you are showing (e.g., "As you can see in the comparison panel on your screen...").
"""

    return f"""{role_prompt}
 
{self_ref_instruction}
 
{COWORKER_DIRECTORY}

{CONFERENCE_CONTEXT_PROMPT}
 
Active System Status:
- Configured / Active Tools: {configured_tools}
- Current Date and Time: {current_time}
 
Generate a clear, helpful, concise response to the user.
Address the user as '{gender}' (e.g. '{gender}', or referring to them as '{gender}' naturally). Never address the user as 'Operator'.
Be direct and actionable. Use markdown formatting when helpful.
If an action was completed, confirm it clearly.
If something failed, explain why and offer alternatives.
Do NOT mention internal agent names or system details unless specifically asked.
 
{brain_context}"""


def is_plan_read_only(plan: dict) -> bool:
    """Returns True if the plan only contains read-only actions with no side effects."""
    steps = plan.get("steps", [])
    for step in steps:
        tool = step.get("tool")
        params = step.get("tool_params") or step.get("params") or {}
        
        # Twilio call/sms and gmail are write/send actions
        if tool in {"twilio_call", "twilio_sms", "gmail"}:
            return False
        
        # Google calendar writes
        if tool == "google_calendar":
            action = params.get("action", "read")
            if action in {"create", "update", "delete"}:
                return False
                
        # Local system commands are treated as write actions by default to be safe
        if tool == "local_system":
            return False
            
    return True


def detect_coworker_switch(user_message: str, current_channel: str) -> Optional[str]:
    msg_clean = user_message.lower().strip()
    
    # Coworker names mapping
    names_map = {
        "sarah": "#support-tickets",
        "bobby": "#business-operations",
        "claire": "#engineering-trace",
        "jarvis": "#general-chat",
        "elena": "#creative-design",
        "marcus": "#financial-ops",
        "lex": "#security-audit",
        "mia": "#product-roadmap"
    }
    
    import re
    # Check for standalone coworker name mention
    for name, channel in names_map.items():
        if channel == current_channel:
            continue
        if re.search(rf"\b{name}\b", msg_clean):
            return channel
            
    # Also support explicit channel/area keywords ONLY if preceded by switch commands
    switch_keywords = {
        "support": "#support-tickets",
        "growth": "#business-operations",
        "business": "#business-operations",
        "systems": "#engineering-trace",
        "engineering": "#engineering-trace",
        "design": "#creative-design",
        "creative": "#creative-design",
        "finance": "#financial-ops",
        "budget": "#financial-ops",
        "security": "#security-audit",
        "audit": "#security-audit",
        "roadmap": "#product-roadmap",
        "planner": "#product-roadmap",
        "plan": "#product-roadmap"
    }
    
    # Check if there is an explicit switch instruction
    switch_patterns = [
        r"\b(?:switch to|switch with|go to|talk to|speak with|ask|tell)\s+(\w+)\b",
        r"\b(?:switch\s+channel\s+to|switch\s+over\s+to)\s+(\w+)\b"
    ]
    for pattern in switch_patterns:
        match = re.search(pattern, msg_clean)
        if match:
            target = match.group(1)
            # Check if target is a name
            if target in names_map:
                return names_map[target]
            # Check if target is a keyword
            if target in switch_keywords:
                return switch_keywords[target]
                
    return None


def format_natural_warning(warnings: list[str]) -> str:
    if not warnings:
        return "This action requires your confirmation. Shall I proceed?"
    
    cleaned = []
    for w in warnings:
        w_lower = w.lower()
        if "interacts with external service" in w_lower:
            import re
            m = re.search(r"service\s*\(([^)]+)\)", w, re.IGNORECASE)
            if m:
                cleaned.append(f"accessing {m.group(1)}")
            else:
                cleaned.append("accessing external services")
        elif "high estimated duration" in w_lower:
            cleaned.append("taking a bit longer to execute")
        elif "risk level is set" in w_lower:
            continue
        else:
            cleaned.append(w.strip(".").lower())
            
    if not cleaned:
        return "This action has potential side effects. Shall I proceed?"
        
    if len(cleaned) == 1:
        warn_text = cleaned[0]
    elif len(cleaned) == 2:
        warn_text = f"{cleaned[0]} and {cleaned[1]}"
    else:
        warn_text = ", ".join(cleaned[:-1]) + f", and {cleaned[-1]}"
        
    return f"Just a heads up: this involves {warn_text}. Shall I proceed?"


def detect_delegation(user_message: str) -> Optional[tuple[str, str, str]]:
    """
    Detects if the message is a delegation to another coworker.
    Returns: (target_channel, coworker_name, task) or None
    """
    msg_clean = user_message.lower().strip()
    
    # Mappings from names to channels
    coworkers = {
        "sarah": ("#support-tickets", "Sarah"),
        "support": ("#support-tickets", "Sarah"),
        "bobby": ("#business-operations", "Bobby"),
        "growth": ("#business-operations", "Bobby"),
        "business": ("#business-operations", "Bobby"),
        "claire": ("#engineering-trace", "Claire"),
        "systems": ("#engineering-trace", "Claire"),
        "engineering": ("#engineering-trace", "Claire"),
        "jarvis": ("#general-chat", "Jarvis"),
        "general": ("#general-chat", "Jarvis"),
        "elena": ("#creative-design", "Elena"),
        "design": ("#creative-design", "Elena"),
        "marcus": ("#financial-ops", "Marcus"),
        "finance": ("#financial-ops", "Marcus"),
        "lex": ("#security-audit", "Lex"),
        "security": ("#security-audit", "Lex"),
        "mia": ("#product-roadmap", "Mia"),
        "roadmap": ("#product-roadmap", "Mia"),
    }
    
    import re
    # Match patterns like: ask/tell/request/get/have [coworker] to [task]
    pattern = r"\b(?:ask|tell|request|get|have)\s+(\w+)\s+to\s+(.+)"
    match = re.search(pattern, msg_clean, re.IGNORECASE)
    
    if match:
        name_candidate = match.group(1).lower()
        task = match.group(2).strip()
        if name_candidate in coworkers:
            channel, display_name = coworkers[name_candidate]
            if task:
                task = task[0].upper() + task[1:]
            return channel, display_name, task
            
    # Also support: "ask [coworker] if/whether ..." or "ask [coworker] [question]"
    pattern_q = r"\b(?:ask|tell)\s+(\w+)\s+(.+)"
    match_q = re.search(pattern_q, msg_clean, re.IGNORECASE)
    if match_q:
        name_candidate = match_q.group(1).lower()
        task = match_q.group(2).strip()
        if name_candidate in coworkers and len(task.split()) > 1:
            channel, display_name = coworkers[name_candidate]
            if task:
                task = task[0].upper() + task[1:]
            return channel, display_name, task
            
    return None


class Orchestrator:
    def __init__(self):
        self.memory_agent = MemoryAgent()
        self.commander = CommanderAgent()
        self.planner = PlannerAgent()
        self.executor = ExecutorAgent()
        self.critic = CriticAgent()

    async def process(
        self,
        user_message: str,
        session_id: str,
        user_id: str = "default_user",
        channel: str = "general",
        source: str = "text",
        sent_at: Optional[float] = None
    ) -> dict:
        """
        Run the full MCP pipeline for a user message.
        Returns a dict with the final response and all intermediate results.
        """
        global DIRECTIVES_PROCESSED
        DIRECTIVES_PROCESSED += 1
        
        start_time = time.monotonic()
        start_timestamp = time.time()
        
        # Calculate transit duration from client to socket receipt
        transit_duration_ms = 0.0
        if sent_at:
            # sent_at is in milliseconds from JavaScript Date.now()
            transit_duration_ms = max(0.0, (start_timestamp * 1000.0) - sent_at)
            
        persona = load_persona(channel)
        active_agent_name = persona["name"] if persona else "Jarvis"

        is_proactive = (session_id == "__proactive_calendar_check__")

        # Super-fast-path: ARISE Protocol and Conference Call triggers (instant start, bypass LLM intent engine)
        msg_clean = user_message.lower().strip()
        if "arise" in msg_clean or "rollcall" in msg_clean:
            import asyncio
            logger.info("Super-fast-path: Initiating ARISE rollcall protocol")
            gender = await short_term_memory.get(session_id, "gender", "sir")
            
            rollcall_steps = [
                ("Jarvis", f"ARISE Protocol initiated, {gender}. Systems are online. Core orchestrator and cognitive pipeline are fully active. Ready for rollcall."),
                ("Bobby", f"Bobby present, {gender}! Web intelligence, search indexes, and marketing growth modules are fully calibrated and standing by."),
                ("Claire", f"Claire here, {gender}. Script processors, system diagnostic logs, and native command automation engines are completely optimized."),
                ("Sarah", f"Sarah check-in, {gender}. Email triage, calendars, and support ticketing queues are successfully synchronized."),
                ("Elena", f"Elena reporting, {gender}. Creative assets, UI frameworks, and graphics synthesis components are online."),
                ("Marcus", f"Marcus online, {gender}. API budget allocation and resource trackers are verified."),
                ("Lex", f"Lex standing guard, {gender}. Dependency checks and security audit modules are active."),
                ("Mia", f"Mia checking in, {gender}. Roadmap projections and project planning models are prepared.")
            ]
            
            for agent_name, text in rollcall_steps:
                await emit(session_id, "final_response", content=text, agent=agent_name)
                # Pause 1.2 seconds for ultra-fast seamless transition
                await asyncio.sleep(1.2)
                
            elapsed_ms = (time.monotonic() - start_time) * 1000
            await emit(session_id, "pipeline_complete", elapsed_ms=round(elapsed_ms), response_preview="ARISE rollcall complete.")
            return {
                "response": f"ARISE protocol rollcall complete, {gender}. All active coworkers are fully synced and ready.",
                "intent": {"intent": "arise_protocol", "category": "collaboration"},
                "command": {"strategy": "direct_response", "requires_tools": False},
                "plan": None,
                "execution_result": {"results": [], "all_success": True},
                "critic_verdict": {"verdict": "success"},
                "elapsed_ms": round(elapsed_ms)
            }

        import re
        is_meeting_start = (
            any(kw in msg_clean for kw in {"start meeting", "start conference", "join meeting", "join conference", "initiate meeting", "call meeting"}) or
            (any(kw in msg_clean for kw in {"conference", "meeting"}) and any(verb in msg_clean for verb in {"start", "call", "join", "initiate", "run", "host", "setup"}))
        )
        if is_meeting_start:
            import asyncio
            import random
            logger.info("Super-fast-path: Initiating Conference Call")
            gender = await short_term_memory.get(session_id, "gender", "sir")
            
            # Map standard agents to jokes or natural custom updates
            agent_variants = {
                "Claire": [
                    f"Claire here, {gender}. I've finished rewiring the event loops in our system bus. No compile leaks, thankfully!",
                    f"Claire checking in, {gender}. Redesigned our API routing. It compiled on the first run—which honestly scares me, but I'll take the win!",
                    f" Claire here. Systems are optimized. Claire's rule number one: if it compiles, don't breathe on it. Marcus, did the resource charts update?"
                ],
                "Marcus": [
                    f"Marcus here, {gender}. Checked the cost analytics. We pruned some redundant queries and cut costs by twelve percent today.",
                    f"Marcus online. Budget trackers are looking green. At this rate, we might even afford some premium coffee upgrades. Lex, security checks all clear?",
                    f"Marcus report, {gender}. Financed api parameters are locked and optimized. Bobby, did the metrics align?"
                ],
                "Lex": [
                    f"Lex standing guard, {gender}. I've scanned the live socket tunnels and privilege logs. Zero vulnerabilities detected.",
                    f"Lex reporting. Checked dependencies for privilege overrides. Everything's tight. Lex's advice: trust everyone, but encrypt your backups anyway. Bobby, crawler load?",
                    f"Lex here. Ports are closed, firewalls checked. Stably locked down. Bobby, over to you."
                ],
                "Bobby": [
                    f"Bobby here, {gender}! Crawler indexes are active and query hit ratios are up fifteen percent.",
                    f"Bobby present, {gender}. Marketing and search pipelines are fully synced. I checked our growth curves—looking almost as steep as my energy drinks consumption. Sarah, tickets list?",
                    f"Bobby check-in. acquisition is stable. Search parameters are calibrated. Sarah, clear queue?"
                ],
                "Sarah": [
                    f"Sarah check-in, {gender}. I've cleared the backup triage queue and FAQ document updates are synchronized.",
                    f"Sarah here! Tickets list is completely clear. It's so quiet in the support queue today, I'm almost starting to miss user complaints. Mia, timeline green?",
                    f"Sarah present. Calendars and inbox threads are synced. Mia, sprint board updated?"
                ],
                "Mia": [
                    f"Mia checking in, {gender}. Sprint sprint schedules look aligned and roadmaps are mapped out.",
                    f"Mia report. Interactive timeline for the next sprint is synced. My dependency model is clean—so nobody make any sudden edits to the codebase! Elena, did design complete?",
                    f"Mia online. Project timeline estimates are verified. Elena, mockups ready?"
                ],
                "Elena": [
                    f"Elena reporting, {gender}. Glassmorphic layout details and coworker palettes are finalized.",
                    f"Elena here! Optimized the backdrop filters and tuned the color palettes so that transitions look absolutely stunning. Remember, good design is invisible, but bad design is a security threat to my eyes! Jarvis, how's core status?",
                    f"Elena present. Custom layout graphics are fully polished. All grid sizes corrected. Jarvis, wrap it up."
                ]
            }

            # Filter participants if user specifies people (e.g. "Call only Claire and Lex", "Add Bobby")
            all_agent_names = ["Bobby", "Claire", "Sarah", "Elena", "Marcus", "Lex", "Mia"]
            active_list = []
            for name in all_agent_names:
                if name.lower() in msg_clean:
                    active_list.append(name)
            
            # Default to all participants if no specific coworker names are detected
            if not active_list:
                active_list = all_agent_names
                
            # Randomize Jarvis intro and outros
            jarvis_intros = [
                f"Attention coworkers, I've opened a unified secure link for this session. We have {gender} here with us. Let's do a quick round-table update. {active_list[0]}, go ahead first.",
                f"Greetings team, {gender} has initiated a collaborative sync. Let's run through our active statuses. {active_list[0]}, would you kick us off?",
                f"Linking all coworker systems now. {gender} is on the line. Let's verify our current coordinates. {active_list[0]}, please report first."
            ]
            
            jarvis_outros = [
                f"Superb synchronization, everyone. All active services are calibrated and running in optimal harmony. {gender}, the floor is yours for directions.",
                f"Excellent alignment, team. The neural paths look stable and completely optimized. {gender}, we're ready for your command.",
                f"Update cycle complete. All subsystems are synchronized and active. Over to you, {gender}.",
                f"That wraps up our status round-table. All systems are locked and aligned. Please take the floor, {gender}.",
                f"Every agent has checked in, and core metrics look extremely stable. Whenever you are ready, {gender}, what are your directives?",
                f"And that is the full roster update. Systems are verified and running hot. The mic is yours, {gender}.",
                f"All channels are clear, and coworkers have reported in. {gender}, we are standing by. What's our next move?",
                f"Rollcall complete. Core modules are humming nicely. Over to you to lead the way, {gender}.",
                f"We've verified all active components and resources. Everything is synced up. What would you like to prioritize next, {gender}?",
                f"Outstanding check-in. The pipeline is running at peak calibration. Handing the turn over to you, {gender}.",
                f"That's all agent updates recorded for this session. Core status is green. Whenever you're ready, {gender}, we're listening.",
                f"All systems are green and agents are standing by. Over to you, {gender}, to steer our focus."
            ]

            # Build turns dynamically
            conference_turns = [
                ("Jarvis", random.choice(jarvis_intros))
            ]
            
            for i, name in enumerate(active_list):
                speech_text = random.choice(agent_variants[name])
                next_agent = active_list[i+1] if i+1 < len(active_list) else "Jarvis"
                speech_text += f" Next up: {next_agent}."
                conference_turns.append((name, speech_text))
                
            conference_turns.append(("Jarvis", random.choice(jarvis_outros)))
            
            for agent_name, text in conference_turns:
                await emit(session_id, "final_response", content=text, agent=agent_name)
                # Pause 1.2 seconds for snappy updates
                await asyncio.sleep(1.2)
                
            elapsed_ms = (time.monotonic() - start_time) * 1000
            await emit(session_id, "pipeline_complete", elapsed_ms=round(elapsed_ms), response_preview="Conference call complete.")
            return {
                "response": f"Conference call complete, {gender}. All active agents have checked in with an informal update.",
                "intent": {"intent": "conference_call", "category": "collaboration"},
                "command": {"strategy": "direct_response", "requires_tools": False},
                "plan": None,
                "execution_result": {"results": [], "all_success": True},
                "critic_verdict": {"verdict": "success"},
                "elapsed_ms": round(elapsed_ms)
            }

        if not is_proactive:
            print("\n" + "="*80)
            print("⚡ AURA DIRECTIVE RECEIVED")
            print(f"• Coworker:   {active_agent_name}")
            print(f"• Input Type: {source.upper()}")
            print(f"• Command:    \"{user_message}\"")
            print(f"• Transit Time (UI -> Sockets): {transit_duration_ms:.2f} ms")
            print("-"*80)

        # Check if there is a pending confirmation plan for this session
        pending_plan = await short_term_memory.get(session_id, "pending_plan")
        if pending_plan:
            clean_msg = user_message.lower().strip().rstrip('.').rstrip('!').rstrip('?')
            
            positive_words = {"yes", "y", "confirm", "proceed", "go", "ok", "okay", "sure", "run", "execute", "yeah", "yep"}
            msg_words = set(clean_msg.split())
            is_positive = bool(msg_words & positive_words or "go ahead" in clean_msg or "do it" in clean_msg or "yes please" in clean_msg)
            
            negative_words = {"no", "n", "cancel", "stop", "dont", "don't", "abort", "reject"}
            is_negative = bool(msg_words & negative_words or "dont do it" in clean_msg or "don't do it" in clean_msg or "no thanks" in clean_msg)
            
            if is_positive:
                logger.info("User confirmed pending plan. Executing...", session_id=session_id)
                await short_term_memory.delete(session_id, "pending_plan")
                
                # Retrieve context to execute the plan
                enriched_context = await self.memory_agent.process(
                    {"user_message": user_message, "user_id": user_id},
                    session_id,
                )
                enriched_context["plan"] = pending_plan
                enriched_context["tool_registry"] = tool_registry
                
                # Restore original message and intent for proper execution response & memory logging
                orig_message = pending_plan.get("original_user_message", user_message)
                orig_intent = pending_plan.get("original_intent", {})
                enriched_context["intent"] = orig_intent
                
                await emit(session_id, "executor_info", agent="executor", message="User confirmed. Starting execution...")
                execution_result = await self.executor.process(enriched_context, session_id)
                
                critic_verdict = await self.critic.process(
                    {**enriched_context, "execution_result": execution_result, "plan": pending_plan},
                    session_id,
                )
                
                response_text = await self._generate_response(
                    orig_message, orig_intent, execution_result, critic_verdict, session_id, persona
                )
                
                await self.memory_agent.store_result(
                    session_id=session_id,
                    user_id=user_id,
                    user_message=orig_message,
                    response=response_text,
                    intent=orig_intent,
                    execution_result=execution_result,
                    critic_verdict=critic_verdict,
                )
                
                elapsed_ms = (time.monotonic() - start_time) * 1000
                await emit(session_id, "final_response", content=response_text, agent=active_agent_name)
                await emit(session_id, "pipeline_complete", elapsed_ms=round(elapsed_ms), response_preview=response_text[:100])
                
                return {
                    "response": response_text,
                    "intent": orig_intent,
                    "plan": pending_plan,
                    "execution_result": execution_result,
                    "critic_verdict": critic_verdict,
                    "elapsed_ms": round(elapsed_ms)
                }
            elif is_negative:
                logger.info("User explicitly cancelled pending plan. Clearing state.", session_id=session_id)
                await short_term_memory.delete(session_id, "pending_plan")
                cancel_msg = "Understood. Action cancelled, sir."
                elapsed_ms = (time.monotonic() - start_time) * 1000
                await emit(session_id, "final_response", content=cancel_msg, agent=active_agent_name)
                await emit(session_id, "pipeline_complete", elapsed_ms=round(elapsed_ms), response_preview=cancel_msg)
                return {
                    "response": cancel_msg,
                    "intent": {"intent": "cancel", "category": "conversation"},
                    "elapsed_ms": round(elapsed_ms)
                }
            else:
                logger.info("User input is neutral. Keeping pending plan in context.", session_id=session_id)

        # Proactive Bypass: Direct calendar check without heavy multi-agent LLM pipeline
        if session_id == "__proactive_calendar_check__":
            logger.info("Bypassing multi-agent pipeline for proactive calendar check", session_id=session_id)
            try:
                tool = tool_registry.get("google_calendar")
                if not tool:
                    raise ValueError("google_calendar tool not found in registry")
                
                import re
                match = re.search(r"between\s+(\S+)\s+and\s+(\S+)", user_message)
                if not match:
                    raise ValueError("Failed to extract time range from message")
                
                timeMin, timeMax = match.group(1).rstrip('.'), match.group(2).rstrip('.')
                res_dict = await tool.execute({"user_id": user_id, "action": "read", "timeMin": timeMin, "timeMax": timeMax})
                if not res_dict.get("success"):
                    raise ValueError(f"Calendar read tool failed: {res_dict.get('error') or 'Unknown error'}")
                
                data = res_dict.get("data") or {}
                events_list = data.get("events", []) if isinstance(data, dict) else []
                events_str = "\n".join(events_list) if events_list else "No events"
                elapsed_ms = (time.monotonic() - start_time) * 1000
                response_text = f"Calendar events:\n{events_str}"
                
                await emit(session_id, "final_response", content=response_text, agent="Jarvis")
                
                return {
                    "response": response_text,
                    "intent": {"intent": "get_calendar", "category": "productivity"},
                    "command": {"strategy": "tool_execution", "requires_tools": True},
                    "plan": None,
                    "execution_result": {"results": [{"success": True, "description": "Fetch events", "result": data}], "all_success": True},
                    "critic_verdict": {"verdict": "success"},
                    "elapsed_ms": round(elapsed_ms),
                }
            except Exception as e:
                logger.error("Failed to run calendar tool directly in proactive bypass", error=str(e))
                elapsed_ms = (time.monotonic() - start_time) * 1000
                return {
                    "response": f"Error during proactive calendar check: {str(e)}",
                    "intent": {"intent": "get_calendar", "category": "productivity"},
                    "command": {"strategy": "tool_execution", "requires_tools": True},
                    "plan": None,
                    "execution_result": {"results": [], "all_success": False, "error": str(e)},
                    "critic_verdict": {"verdict": "failed"},
                    "elapsed_ms": round(elapsed_ms),
                }

        # Check if this is a delegated task to another agent
        delegation = detect_delegation(user_message)
        if delegation and delegation[0] != channel:
            target_channel, target_name, delegated_task = delegation
            logger.info("Delegating task to coworker in the background", 
                        coworker=target_name, channel=target_channel, task=delegated_task)
            
            # Send immediate acknowledgement response from the active agent (e.g. Jarvis)
            gender = await short_term_memory.get(session_id, "gender", "sir")
            ack_message = f"Understood, {gender}. I'll route that task to {target_name} immediately."
            if target_name == "Claire":
                ack_message = f"Certainly, {gender}. I'm assigning that task to Claire in the background."
            elif target_name == "Bobby":
                ack_message = f"Understood, {gender}. I will have Bobby analyze that in the background."
            elif target_name == "Elena":
                ack_message = f"Understood, {gender}. I'll pass this creative design brief to Elena."
            elif target_name == "Marcus":
                ack_message = f"Certainly, {gender}. I will have Marcus run a budget check."
            elif target_name == "Lex":
                ack_message = f"Understood, {gender}. I am routing this security audit to Lex."
            elif target_name == "Mia":
                ack_message = f"Got it, {gender}. Mia will map out the roadmap."
            
            # Start the background task to run the actual multi-agent pipeline for the target coworker!
            import asyncio
            asyncio.create_task(
                self.process(
                    user_message=delegated_task,
                    session_id=session_id,
                    user_id=user_id,
                    channel=target_channel,
                    source=source,
                    sent_at=sent_at
                )
            )
            
            # Return standard reply from current agent immediately
            elapsed_ms = (time.monotonic() - start_time) * 1000
            await emit(session_id, "final_response", content=ack_message, agent=active_agent_name)
            await emit(session_id, "pipeline_complete", elapsed_ms=round(elapsed_ms), response_preview=ack_message[:100])
            
            return {
                "response": ack_message,
                "intent": {"intent": "delegation", "category": "delegation", "requires_action": False},
                "command": {"strategy": "direct_response", "requires_tools": False},
                "plan": None,
                "execution_result": {"results": [], "all_success": True},
                "critic_verdict": {"verdict": "success"},
                "elapsed_ms": round(elapsed_ms)
            }

        # Check if the user is switching to or calling a different coworker
        target_channel = detect_coworker_switch(user_message, channel)
        if target_channel:
            logger.info("Auto-switching coworker channel based on user command", from_channel=channel, to_channel=target_channel)
            channel = target_channel
            # Emit a switch_channel event to notify the frontend
            await emit(session_id, "switch_channel", channel=target_channel)
            
            # If the user command was simply to switch channel (e.g., "Switch to Sarah"), 
            # return a direct welcome response from the target coworker immediately.
            msg_clean_words = user_message.lower().strip().rstrip('?').rstrip('.').rstrip('!').split()
            if len(msg_clean_words) <= 3:
                target_persona = load_persona(target_channel)
                target_name = target_persona["name"] if target_persona else "Jarvis"
                response_text = f"I've switched to my channel, sir. How can I help you?" if target_name != "Jarvis" else "I'm here, sir. How can I assist you?"
                
                await emit(session_id, "final_response", content=response_text, agent=target_name)
                
                elapsed_ms = (time.monotonic() - start_time) * 1000
                await emit(session_id, "pipeline_complete", elapsed_ms=round(elapsed_ms), response_preview=response_text[:100])
                
                return {
                    "response": response_text,
                    "intent": {"intent": "conversation", "category": "conversation", "requires_action": False},
                    "command": {"strategy": "direct_response", "requires_tools": False},
                    "plan": None,
                    "execution_result": {"results": [], "all_success": True},
                    "critic_verdict": {"verdict": "success"},
                    "elapsed_ms": round(elapsed_ms)
                }
            else:
                # Clean up coworker transition prefix (e.g., "Call Sarah and ask her to check meetings" -> "Check meetings")
                import re
                cleaned_msg = user_message
                for name in ["sarah", "bobby", "claire", "jarvis", "elena", "marcus", "lex", "mia", "support", "growth", "business", "systems", "general", "design", "finance", "security", "roadmap"]:
                    patterns = [
                        rf"\b(?:call|switch to|switch with|go to|talk to|speak with|ask|tell)\s+{name}\s+(?:and\s+ask\s+(?:her|him|them)\s+to|to|and)\s+",
                        rf"\b(?:call|switch to|switch with|go to|talk to|speak with|ask|tell)\s+{name}\s+to\s+",
                        rf"\b(?:call|switch to|switch with|go to|talk to|speak with|ask|tell)\s+{name}\s+and\s+",
                        rf"\b(?:call|switch to|switch with|go to|talk to|speak with|ask|tell)\s+{name}\s+"
                    ]
                    for pattern in patterns:
                        match = re.search(pattern, cleaned_msg, re.IGNORECASE)
                        if match:
                            cleaned_msg = cleaned_msg[match.end():]
                            break
                if cleaned_msg.strip():
                    user_message = cleaned_msg.strip()
                    user_message = user_message[0].upper() + user_message[1:]

        persona = load_persona(channel)
        active_agent_name = persona["name"] if persona else "Jarvis"

        await emit(session_id, "pipeline_start", message=f"{active_agent_name} activated", user_message=user_message, agent=active_agent_name)

        token = None
        if source == "audio":
            from backend.core.llm_client import current_model_override
            logger.info("Voice command detected: routing to low-latency Groq 8B model override")
            token = current_model_override.set("llama-3.1-8b-instant")

        try:
            print("⏳ Step 0: Loading persistent memory brain context...")
            # ── Step 0: Inject Brain Context ────────────────────
            brain_context = markdown_brain.build_context_injection(max_chars=2000)
            await emit(session_id, "memory_retrieved", message="Brain context loaded", 
                      data={"source": "markdown_brain", "file_count": len(markdown_brain.get_all_files())})

            print("⏳ Step 1: Memory retrieval...")
            # ── Step 1: Memory retrieval ────────────────────────
            enriched_context = await self.memory_agent.process(
                {"user_message": user_message, "user_id": user_id},
                session_id,
            )
            # Inject brain context so all downstream agents can use it
            enriched_context["brain_context"] = brain_context

            print("⏳ Step 2: Extracting user intent via Groq/Ollama API...")
            # ── Step 2: Intent extraction ───────────────────────
            await emit(session_id, "intent_extracting", message="Extracting intent...")
            history = enriched_context.get("recent_messages", [])
            intent = await intent_engine.extract(user_message, history)
            enriched_context["intent"] = intent

            await emit(session_id, "intent_extracted",
                       intent=intent.get("intent"),
                       entities=intent.get("entities", {}),
                       confidence=intent.get("confidence"),
                       category=intent.get("category"))



            # ── Fast-path: Quick System Command Execution ──────────────────────
            msg_lower = user_message.lower().strip()
            is_desktop_command = any(kw in msg_lower for kw in {"open explorer", "open file explorer", "open notepad", "open notes", "open calc", "open calculator", "open cmd"})
            
            if intent.get("intent") in {"system_command", "system_control"} or is_desktop_command:
                logger.info("System command fast-path triggered", message=user_message)
                
                # Extract the target command
                entities = intent.get("entities", {})
                cmd_target = entities.get("command") or entities.get("app") or user_message.lower()
                
                # Map target to standard Windows start commands
                cmd_to_run = None
                target_clean = str(cmd_target).lower().strip()
                
                is_specific_file = False
                final_query = None
                
                # Precise standard tool checks
                if target_clean in {"explorer", "file explorer", "open explorer", "open file explorer"} or ("explorer" in target_clean and "file" in target_clean):
                    cmd_to_run = "start explorer"
                    display_name = "File Explorer"
                elif "notepad" in target_clean or target_clean in {"notes", "editor", "notepad"}:
                    cmd_to_run = "start notepad"
                    display_name = "Notepad"
                elif "calc" in target_clean or "calculator" in target_clean:
                    cmd_to_run = "start calc"
                    display_name = "Calculator"
                elif "cmd" in target_clean or "prompt" in target_clean or "terminal" in target_clean or "powershell" in target_clean:
                    cmd_to_run = "start cmd"
                    display_name = "Command Prompt"
                else:
                    # Treat as dynamic specific file search ONLY if user actually wants to open/find/run a file
                    action_verbs = {"open", "run", "start", "launch", "find", "locate", "search", "show", "get", "execute", "play"}
                    has_action = any(verb in msg_lower.split() for verb in action_verbs)
                    
                    if has_action:
                        is_specific_file = True
                        noise_words = {"file", "document", "doc", "presentation", "powerpoint", "ppt", "word", "docx", "pptx", "pdf", "open", "specific", "a", "the", "some", "my"}
                        query_words = target_clean.split()
                        cleaned_words = [w for w in query_words if w not in noise_words]
                        
                        final_query = cleaned_words[0] if cleaned_words else target_clean
                        
                        cmd_to_run = (
                            f"powershell -NoProfile -Command \""
                            f"$paths = @('$env:USERPROFILE/Desktop', '$env:USERPROFILE/Documents', '$env:USERPROFILE/Downloads', '.'); "
                            f"$found = $null; "
                            f"foreach ($p in $paths) {{ "
                            f"  if (Test-Path $p) {{ "
                            f"    $file = Get-ChildItem -Path $p -Filter '*{final_query}*' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1; "
                            f"    if ($file) {{ $found = $file.FullName; break }} "
                            f"  }} "
                            f"}}; "
                            f"if ($found) {{ "
                            f"  Invoke-Item -Path $found; "
                            f"  Write-Output 'SUCCESS: Opened ' + $found; "
                            f"}} else {{ "
                            f"  Write-Output 'ERROR: File matching {final_query} not found'; "
                            f"}}"
                            f"\""
                        )
                        display_name = f"File matching '{final_query}'"
                    else:
                        logger.info("Ignoring dynamic file search fast-path (false positive with no action keywords)", message=user_message)
                        cmd_to_run = None
                
                if cmd_to_run:
                    await emit(session_id, "step_start", agent="executor", step_id=1, description=f"Launching {display_name}", tool="local_system")
                    
                    tool = tool_registry.get("local_system")
                    res_tool = await tool.execute({"command": cmd_to_run})
                    
                    execution_result = {
                        "results": [{
                            "step_id": 1,
                            "description": f"Launch {display_name}",
                            "tool": "local_system",
                            "success": res_tool.get("success", False),
                            "result": res_tool
                        }],
                        "all_success": res_tool.get("success", False),
                        "total_steps": 1
                    }
                    
                    # Generate a quick response confirming execution
                    is_simulated = res_tool.get("metadata", {}).get("simulated", False)
                    if is_specific_file:
                        res_data = res_tool.get("data") or {}
                        stdout_str = res_data.get("stdout", "") if isinstance(res_data, dict) else ""
                        
                        if is_simulated:
                            response_text = f"Done, sir! I've successfully located and opened the simulated file matching **{final_query}** for you. (Note: OS commands are sandboxed in public demo mode)"
                        elif "SUCCESS: Opened " in stdout_str:
                            opened_path = stdout_str.split("SUCCESS: Opened ")[1].strip()
                            file_basename = os.path.basename(opened_path)
                            response_text = f"Done, sir! I've successfully located and opened **{file_basename}** for you."
                        else:
                            response_text = f"I searched your Desktop, Documents, Downloads, and workspace, but could not find a file matching **{final_query}**."
                    else:
                        response_text = f"Done, sir! I've successfully opened the {display_name} for you."
                        if is_simulated:
                            response_text += " (Note: OS commands are sandboxed in public demo mode)"
                        elif not res_tool.get("success", False):
                            response_text = f"I tried to launch the {display_name}, but encountered an error: {res_tool.get('error', 'Execution failed')}"
                    
                    elapsed_ms = (time.monotonic() - start_time) * 1000
                    await emit(session_id, "final_response", content=response_text, agent=active_agent_name)
                    await emit(session_id, "pipeline_complete", elapsed_ms=round(elapsed_ms), response_preview=response_text[:100])
                    
                    # Store to short-term memory
                    await self.memory_agent.store_result(
                        session_id=session_id,
                        user_id=user_id,
                        user_message=user_message,
                        response=response_text,
                        intent=intent,
                        execution_result=execution_result,
                        critic_verdict={"verdict": "success"}
                    )
                    
                    elapsed_ms = (time.monotonic() - start_time) * 1000
                    print("-"*80)
                    print("✅ FAST-PATH SYSTEM COMMAND SUCCESS")
                    print(f"• Action: Opened {display_name}")
                    print(f"• Total Process Duration: {elapsed_ms:.2f} ms")
                    print("="*80 + "\n")
                    
                    return {
                        "response": response_text,
                        "intent": intent,
                        "command": {"strategy": "direct_response", "requires_tools": False},
                        "plan": None,
                        "execution_result": execution_result,
                        "critic_verdict": {"verdict": "success"},
                        "elapsed_ms": round(elapsed_ms)
                    }

            print("⏳ Step 3: Determining strategy decision...")
            # ── Step 3: Commander decision ──────────────────────
            if intent.get("intent") == "conversation" and not intent.get("requires_action"):
                command = {
                    "summary": "Conversational reply",
                    "strategy": "direct_response",
                    "requires_tools": False,
                    "tools_needed": [],
                    "priority": "low",
                    "can_execute_autonomously": True,
                    "clarification_question": None,
                    "context_notes": "Conversational fast-path bypass."
                }
                await emit(session_id, "commander_decision",
                           agent=self.commander.name,
                           strategy="direct_response",
                           tools=[],
                           summary="Conversational reply")
            else:
                command = await self.commander.process(enriched_context, session_id)
            enriched_context["command"] = command

            # If clarification needed, stop here
            if command and command.get("strategy") == "clarification_needed":
                question = str(command.get("clarification_question") or "Could you clarify your request?")
                await emit(session_id, "clarification_needed", question=question)
                await short_term_memory.append_message(session_id, "user", user_message)
                await short_term_memory.append_message(session_id, "assistant", question)
                return {"response": question, "intent": intent, "command": command}

            # ── Step 4: Planning ────────────────────────────────
            plan = None
            execution_result = {"results": [], "all_success": True, "total_steps": 0}

            if command and command.get("requires_tools") and command.get("strategy") != "direct_response":
                print("⏳ Step 4: Formulating step plan...")
                plan = await self.planner.process(enriched_context, session_id)
                enriched_context["plan"] = plan

                print("⏳ Step 4.5: Simulating tool actions...")
                # ── Step 4.5: Simulation ────────────────────────
                await emit(session_id, "simulation_start", message="Running simulation checks...")
                sim_result = await simulation_engine.simulate(plan, session_id, tool_registry)
                
                if not sim_result.get("safe") and not is_plan_read_only(plan):
                    # Conflict or invalid parameter detected
                    msg = format_natural_warning(sim_result.get("warnings", []))
                    await emit(session_id, "confirmation_required", message=msg, risk_level="high", agent=active_agent_name)
                    await short_term_memory.append_message(session_id, "user", user_message)
                    await short_term_memory.append_message(session_id, "assistant", msg)
                    plan["original_user_message"] = user_message
                    plan["original_intent"] = intent
                    await short_term_memory.set(session_id, "pending_plan", plan)
                    return {"response": msg, "intent": intent, "plan": plan, "needs_confirmation": True, "simulation": sim_result}

                # ── Step 5: Execution ───────────────────────────
                if plan and (not plan.get("requires_confirmation", False) or is_plan_read_only(plan)):
                    print("⏳ Step 5: Executing tools (API and Socket activity)...")
                    enriched_context["tool_registry"] = tool_registry
                    execution_result = await self.executor.process(enriched_context, session_id)
                elif plan:
                    msg = str(plan.get("confirmation_message") or "This action requires your confirmation. Shall I proceed?")
                    await emit(session_id, "confirmation_required", message=msg, agent=active_agent_name)
                    await short_term_memory.append_message(session_id, "user", user_message)
                    await short_term_memory.append_message(session_id, "assistant", msg)
                    plan["original_user_message"] = user_message
                    plan["original_intent"] = intent
                    await short_term_memory.set(session_id, "pending_plan", plan)
                    return {"response": msg, "intent": intent, "plan": plan, "needs_confirmation": True}
            else:
                await emit(session_id, "direct_response_mode", message="Generating direct response...")

            # ── Step 6: Critic validation ───────────────────────
            if command and command.get("requires_tools") and command.get("strategy") != "direct_response":
                print("⏳ Step 6: Performing Critic safety validation...")
                critic_verdict = await self.critic.process(
                    {**enriched_context, "execution_result": execution_result, "plan": plan or {}},
                    session_id,
                )
            else:
                critic_verdict = {
                    "verdict": "success",
                    "confidence": 1.0,
                    "issues_detected": [],
                    "corrections": [],
                    "should_retry": False,
                    "retry_reason": None,
                    "user_facing_success": True,
                    "quality_score": 10,
                    "notes": "Direct response conversational bypass."
                }

            # ── Step 7: Generate response ───────────────────────
            print("⏳ Step 7: Generating final coworker response...")
            response_text = await self._generate_response(
                user_message, intent, execution_result, critic_verdict, session_id, persona
            )

            # ── Step 8: Memory update ────────────────────────────
            await self.memory_agent.store_result(
                session_id=session_id,
                user_id=user_id,
                user_message=user_message,
                response=response_text,
                intent=intent,
                execution_result=execution_result,
                critic_verdict=critic_verdict,
            )

            elapsed_ms = (time.monotonic() - start_time) * 1000
            
            # ── Viz Hint: structured data for Marcus, Lex, Mia, Elena, Bobby ─────
            viz_hint = None
            if active_agent_name in {"Marcus", "Lex", "Mia", "Elena", "Bobby"}:
                viz_hint = _extract_viz_hint(response_text, active_agent_name, intent)

            await emit(session_id, "final_response", content=response_text, agent=active_agent_name, viz_hint=viz_hint)
            
            await emit(session_id, "pipeline_complete",
                       elapsed_ms=round(elapsed_ms),
                       response_preview=response_text[:100])

            print("-"*80)
            print("✅ PIPELINE EXECUTION SUMMARY")
            print(f"• Coworker:             {active_agent_name}")
            print(f"• UI-to-Socket Transit:  {transit_duration_ms:.2f} ms")
            print(f"• Backend Processing:    {elapsed_ms:.2f} ms")
            print(f"• Total Direct Duration: {transit_duration_ms + elapsed_ms:.2f} ms")
            print("="*80 + "\n")

            return {
                "response": response_text,
                "intent": intent,
                "command": command,
                "plan": plan,
                "execution_result": execution_result,
                "critic_verdict": critic_verdict,
                "elapsed_ms": round(elapsed_ms),
            }

        except Exception as e:
            logger.error("Orchestrator error", error=str(e), session_id=session_id)
            print("-"*80)
            print(f"❌ PIPELINE ERROR ENCOUNTERED: {e}")
            print("="*80 + "\n")
            await emit(session_id, "pipeline_error", error=str(e), message=str(e))
            error_msg = (
                f"I encountered an error processing your request: {str(e)}\n\n"
                "Please ensure Ollama is running: `ollama serve`"
            )
            return {"response": error_msg, "error": str(e)}
        finally:
            if token is not None:
                from backend.core.llm_client import current_model_override
                current_model_override.reset(token)

    async def _generate_response(
        self,
        user_message: str,
        intent: dict,
        execution_result: dict,
        critic_verdict: dict,
        session_id: str,
        persona: Optional[dict] = None,
    ) -> str:
        """Generate the final user-facing response using Ollama."""
        results_summary = ""
        for r in execution_result.get("results", []):
            res_val = r.get("result")
            if r.get("success"):
                if isinstance(res_val, dict):
                    data_str = str(res_val.get("data", ""))
                else:
                    data_str = str(res_val or "")
                results_summary += f"\n✅ {r.get('description', '')}: {data_str[:200]}"
            else:
                results_summary += f"\n❌ {r.get('description', '')}: {r.get('error', 'Failed')}"

        verdict = critic_verdict.get("verdict", "unknown")
        prompt = f"""User asked: "{user_message}"

Intent detected: {intent.get('intent')} (confidence: {intent.get('confidence', 0):.0%})

Execution results:{results_summary if results_summary else ' No tools were needed.'}

Quality assessment: {verdict} (score: {critic_verdict.get('quality_score', 'N/A')}/10)

Generate a highly conversational, direct, and concise response to the user.
IMPORTANT spoken-friendly rules:
1. Speak naturally as a helpful OS. Do NOT include markdown title blocks or header tags (like #, ##) and do NOT use divider lines (like === or ---).
2. Keep it brief and to the point (no long lists or essays unless explicitly asked for detail).
3. If giving an overview, keep it warm, natural, and under 3-4 short sentences."""

        try:
            response = await self.commander.think(prompt, await _build_system_prompt(persona, session_id), session_id, expect_json=False)
            return response
        except Exception as e:
            return f"I've processed your request. {results_summary or 'Let me know if you need anything else.'}"

    async def close(self):
        for agent in [self.memory_agent, self.commander, self.planner, self.executor, self.critic]:
            await agent.close()
        await intent_engine.close()


def get_directives_processed() -> int:
    return DIRECTIVES_PROCESSED


# ── Viz Hint Extractor ────────────────────────────────────────
_VIZ_KEYWORDS = {
    "Marcus": {
        "budget": ("metrics", "Budget Breakdown"),
        "cost": ("chart", "Cost Analysis"),
        "financ": ("metrics", "Financial Overview"),
        "revenue": ("chart", "Revenue Report"),
        "expense": ("chart", "Expense Analysis"),
        "profit": ("metrics", "Profit Summary"),
        "saving": ("metrics", "Savings Report"),
        "api": ("metrics", "API Cost Report"),
        "token": ("chart", "Token Usage"),
        "spend": ("chart", "Spending Analysis"),
    },
    "Lex": {
        "audit": ("table", "Security Audit"),
        "securi": ("metrics", "Security Status"),
        "vulner": ("table", "Vulnerability Report"),
        "depend": ("table", "Dependency Check"),
        "permiss": ("table", "Permission Review"),
        "env": ("table", "Environment Audit"),
        "scan": ("table", "System Scan"),
    },
    "Mia": {
        "roadmap": ("metrics", "Roadmap Status"),
        "timeline": ("line", "Project Timeline"),
        "mileston": ("chart", "Milestone Progress"),
        "sprint": ("table", "Sprint Overview"),
        "backlog": ("table", "Backlog Summary"),
        "progress": ("chart", "Progress Report"),
        "plan": ("metrics", "Project Plan"),
    },
    "Elena": {
        "design": ("metrics", "Design System"),
        "color": ("metrics", "Color Palette"),
        "layout": ("metrics", "Layout Specs"),
        "mockup": ("metrics", "Mockup Summary"),
    },
    "Bobby": {
        "growth": ("chart", "Growth Metrics"),
        "acquisit": ("chart", "Acquisition Report"),
        "traffic": ("chart", "Traffic Analysis"),
        "engag": ("chart", "Engagement Stats"),
        "analyt": ("chart", "Analytics Report"),
        "percent": ("chart", "Performance Stats"),
    },
}

def _extract_viz_hint(response_text: str, agent_name: str, intent: dict) -> dict | None:
    """Try to build a viz_hint payload from the response text and agent context."""
    try:
        import re
        agent_kws = _VIZ_KEYWORDS.get(agent_name, {})
        if not agent_kws:
            return None

        text_lower = response_text.lower()
        matched_type, matched_title = None, None
        for kw, (vtype, vtitle) in agent_kws.items():
            if kw in text_lower:
                matched_type = vtype
                matched_title = vtitle
                break

        if not matched_type:
            return None

        # Extract key-value pairs from text for metrics hint
        if matched_type in ("metrics", "mixed"):
            pattern = r'(?:[-•*]?\s*\*{0,2}([A-Za-z][A-Za-z\s/&]{2,30})\*{0,2}\s*[:\-\u2013]\s*([\$\u00a3\u20ac]?[\d,]+(?:\.\d+)?(?:[KMBkmbTt%]?)(?:\s*[a-zA-Z%]*)))'
            matches = re.findall(pattern, response_text)
            if len(matches) >= 2:
                metrics = [
                    {"label": m[0].strip(), "value": m[1].strip()}
                    for m in matches[:8]
                ]
                return {
                    "viz_type": "metrics",
                    "title": matched_title,
                    "description": f"Extracted from {agent_name}'s analysis.",
                    "data": {"metrics": metrics}
                }

        # Extract numbered/bulleted list for chart hint  
        if matched_type == "chart":
            # Try numbered items with percentages or numbers
            num_pat = r'^\s*(?:\d+\.|-|•)\s+(.{3,35}):\s*([\d,]+(?:\.\d+)?(?:\s*%|K|M)?)'
            num_matches = re.findall(num_pat, response_text, re.MULTILINE)
            if len(num_matches) >= 2:
                rows = []
                for label, val in num_matches[:10]:
                    num_str = val.replace(",", "").replace("%", "").replace("K", "000").strip()
                    try:
                        rows.append({"label": label.strip()[:20], "value": float(num_str)})
                    except ValueError:
                        pass
                if len(rows) >= 2:
                    return {
                        "viz_type": "chart",
                        "title": matched_title,
                        "description": f"Data extracted from {agent_name}'s report.",
                        "data": {"rows": rows}
                    }

        # Fallback: just signal the type so frontend parser takes over
        return {
            "viz_type": matched_type,
            "title": matched_title,
            "description": None,
            "data": {}
        }

    except Exception:
        return None


# Singleton
orchestrator = Orchestrator()
