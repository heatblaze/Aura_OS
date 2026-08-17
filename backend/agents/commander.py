"""
Commander Agent — the top-level orchestrator.
Interprets user intent, delegates to Planner, synthesizes final response.
"""
from backend.agents.base import BaseAgent
from backend.core.message_bus import emit


COMMANDER_SYSTEM_PROMPT = """You are the Commander Agent of JARVIS, an autonomous AI operating system.

Your role:
1. Receive the user's request and extracted intent
2. Decide the execution strategy (which tools/agents to use)
3. Return a structured command object

Always respond with valid JSON in this exact format:
{
  "summary": "one-line summary of what needs to be done",
  "strategy": "direct_response | tool_execution | multi_step | clarification_needed",
  "requires_tools": true/false,
  "tools_needed": ["tool1", "tool2"],
  "priority": "low | medium | high | urgent",
  "can_execute_autonomously": true/false,
  "clarification_question": null or "question to ask user if unclear",
  "context_notes": "any relevant context from conversation history"
}

Available tools: google_calendar, gmail, web_search, browser_automation, twilio_call, twilio_sms, local_system (for launching desktop tasks, notepad, file explorer, or running shell commands), system_clock (for checking current date/time for specific cities or time zones)

For any system tasks, opening file explorer, launching local tools/applications (like notepad, notes, calculator), or running scripts/commands, you MUST use the strategy 'tool_execution' and include 'local_system' in 'tools_needed'. Do NOT handle these via direct_response.
- For simple queries about the current LOCAL system date/time (e.g. "what is the time now", "what's today's date", "time now"), you should use the strategy 'direct_response' and set 'requires_tools' to false. The final response generator already has the current system date and time injected.
- For queries asking for the current time or date in OTHER cities, regions, or time zones (e.g. "current time in New York", "time in London", "time in Tokyo", "what's the time in NYC"), you MUST use the strategy 'tool_execution', set 'requires_tools' to true, and specify 'system_clock' in 'tools_needed'. Do NOT handle these via direct_response, as timezone math calculations must be performed programmatically.
"""


class CommanderAgent(BaseAgent):
    name = "commander"
    description = "Commander — analyzing request and forming strategy"

    async def process(self, context: dict, session_id: str) -> dict:
        await emit(session_id, "agent_start", agent=self.name, message="Commander Agent activated")

        intent = context.get("intent", {})
        history = context.get("recent_messages", [])
        patterns = context.get("user_patterns", [])

        history_str = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in history[-5:]
        ) or "No prior conversation."

        patterns_str = (
            "\n".join(f"- {p['key']}: {p['value']}" for p in patterns[:3])
            if patterns else "No patterns detected yet."
        )

        user_msg = str(context.get('user_message', '')).replace('"', '\\"')
        prompt = f"""
User Request: {user_msg}

Extracted Intent: {intent}

Recent Conversation:
{history_str}

Known User Patterns:
{patterns_str}

Based on the above, generate your command strategy as JSON.
"""
        result = await self.think_json(prompt, COMMANDER_SYSTEM_PROMPT, session_id)

        await emit(
            session_id,
            "commander_decision",
            agent=self.name,
            strategy=result.get("strategy"),
            tools=result.get("tools_needed", []),
            summary=result.get("summary"),
        )

        return result
