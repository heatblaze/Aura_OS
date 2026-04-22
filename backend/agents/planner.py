"""
Planner Agent — decomposes tasks into executable steps.
"""
import json
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
- Steps must be atomic and verifiable
- Set can_parallel=true for independent steps
- Always include a fallback strategy
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

        prompt = f"""
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
