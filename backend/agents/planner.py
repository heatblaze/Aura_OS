"""
Planner Agent — decomposes tasks into executable steps.
"""
import json
from datetime import datetime
from backend.agents.base import BaseAgent
from backend.core.message_bus import emit


PLANNER_SYSTEM_PROMPT = """You are the Planner Agent of JARVIS. Your job is to break down tasks into clear, executable steps.

Given a commander decision and user intent, produce a detailed execution plan.

Always respond with valid JSON:
{
  "plan_id": "unique plan id (e.g. plan_001)",
  "steps": [
    {
      "step_id": 1,
      "description": "what this step does",
      "tool": "tool_name or null if no tool needed",
      "tool_params": {"param": "value"},
      "depends_on": [],
      "can_parallel": false,
      "estimated_duration_ms": 500,
      "fallback": "what to do if this step fails"
    }
  ],
  "total_steps": 0,
  "requires_confirmation": false,
  "confirmation_message": null,
  "risk_level": "low | medium | high"
}

Rules:
- Available tools: google_calendar, gmail, web_search, browser_automation, twilio_call, twilio_sms, local_system, system_clock
- For checking timezone time, local time, or city clocks, directly utilize the 'system_clock' tool with the 'location' parameter (e.g. 'New York', 'UTC', or the user's local timezone like 'Asia/Kolkata'). If checking the user's current local time, set 'location' to the user's local timezone (e.g., 'Asia/Kolkata') rather than UTC. Do not write custom scripts or use shell/python commands.
- Keep plans simple, direct, and minimal. Do NOT add credential checking/retrieval steps or write custom python/powershell scripts via 'local_system' for tools that have native capabilities (like 'google_calendar', 'gmail', 'twilio_call', 'twilio_sms', 'system_clock'). Always use the native tools directly.
- For reading or searching calendar events, directly utilize the 'google_calendar' tool with "action": "read" and specify 'timeMin' and 'timeMax' parameters as ISO 8601 strings. Pay careful attention to the timezone offset in the 'Current Time' (e.g. 'UTC+05:30'). Convert user queries to timezone-aware ISO 8601 format (e.g., "2026-06-16T00:00:00+05:30") using the user's local timezone offset instead of assuming UTC ('Z'). Note that 12 AM is midnight (00:00:00) and 12 PM is noon (12:00:00). When checking events for a day or specific hour, ensure 'timeMin' starts at/before that time and 'timeMax' covers the target window. Do NOT plan any other tools or scripts for calendar searches.
- If the user request refers to relative times (like "tomorrow", "next Monday", "in 2 hours", "yesterday"), look at the 'Current Time' provided in the prompt, calculate the absolute date and time values directly, and put them as ISO 8601 strings in the 'tool_params' of the native tool (like google_calendar). Do NOT plan any steps with 'local_system' or powershell commands to get or calculate the current date/time. The execution plan should contain only the final tool calls.
- The execution plan should only contain steps that retrieve or write data. Do NOT plan any steps for parsing, formatting, displaying, writing, or reviewing the output of a tool, as the system automatically handles presenting the tool output back to the user. For instance, after reading the calendar using the 'google_calendar' tool, do NOT add a step to parse or open notepad to show the events; the plan should end right after the 'google_calendar' tool call.
- For 'local_system', the 'tool_params' must include a 'command' key, e.g. {"command": "start explorer"}.
- Note: The host operating system is Windows. When launching GUI applications (like file explorer, notepad, calc, etc.) via 'local_system', ALWAYS prefix the command with 'start ' (e.g. 'start explorer' or 'start notepad') to launch them detached and prevent command execution from blocking or timing out.
- Steps must be atomic and verifiable
- Set can_parallel=true for independent steps
- Always include a fallback strategy. Fallbacks for messaging/delivery tools (like Gmail, twilio_sms, or twilio_call) must NOT involve automatic retries or infinite loop behaviors; they should notify the user of the failure and ask for manual correction or instructions.
- If risk_level is "high", set requires_confirmation=true
"""


class PlannerAgent(BaseAgent):
    name = "planner"
    description = "Planner — creating step-by-step execution plan"

    async def process(self, context: dict, session_id: str) -> dict:
        await emit(session_id, "agent_start", agent=self.name, message="Planning execution steps...")

        command = context.get("command", {})
        intent = context.get("intent", {})
        user_message = context.get("user_message", "")
        similar_tasks = context.get("similar_past_tasks", [])

        similar_str = ""
        if similar_tasks:
            similar_str = "\nSimilar past tasks for reference:\n" + "\n".join(
                f"- {t.get('text', '')[:100]}" for t in similar_tasks[:2]
            )

        from backend.memory.short_term import short_term_memory
        from zoneinfo import ZoneInfo
        client_tz = await short_term_memory.get(session_id, "timezone")
        if not client_tz:
            client_tz = "Asia/Kolkata"

        try:
            tz = ZoneInfo(client_tz)
            now = datetime.now(tz)
        except Exception:
            now = datetime.now().astimezone()

        current_time_iso = now.isoformat()
        current_time_readable = now.strftime("%A, %B %d, %Y, %I:%M:%S %p (%Z, UTC%z)")
        tz_offset = now.strftime("%z")
        if len(tz_offset) == 5:
            current_time_readable = current_time_readable.replace(tz_offset, f"{tz_offset[:3]}:{tz_offset[3:]}")

        prompt = f"""
Current Time: {current_time_readable} (ISO 8601: {current_time_iso})
User Request: {user_message}

Intent: {json.dumps(intent, indent=2)}

Commander Strategy: {json.dumps(command, indent=2)}
{similar_str}

Create a detailed step-by-step execution plan as JSON.
"""
        plan = await self.think_json(prompt, PLANNER_SYSTEM_PROMPT, session_id)

        steps = plan.get("steps", [])
        await emit(
            session_id,
            "plan_created",
            agent=self.name,
            plan_id=plan.get("plan_id"),
            total_steps=len(steps),
            steps=[s.get("description") for s in steps],
            requires_confirmation=plan.get("requires_confirmation", False),
            risk_level=plan.get("risk_level", "low"),
        )

        return plan
