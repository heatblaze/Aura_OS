"""
Critic Agent — validates execution results, detects conflicts, suggests corrections.
"""
import json
from backend.agents.base import BaseAgent
from backend.core.message_bus import emit


CRITIC_SYSTEM_PROMPT = """You are the Critic Agent of JARVIS. Your role is to validate execution results and ensure quality.

Given the execution results and original user intent, assess:
1. Was the task completed correctly?
2. Are there any conflicts or errors?
3. What should be improved?

Respond with valid JSON:
{
  "verdict": "success | partial_success | failure | needs_retry",
  "confidence": 0.0-1.0,
  "issues_detected": [],
  "corrections": [],
  "should_retry": false,
  "retry_reason": null,
  "user_facing_success": true,
  "quality_score": 0-10,
  "notes": "brief assessment"
}
"""


class CriticAgent(BaseAgent):
    name = "critic"
    description = "Critic — validating execution quality"

    async def process(self, context: dict, session_id: str) -> dict:
        await emit(session_id, "agent_start", agent=self.name, message="Critic Agent reviewing results...")

        intent = context.get("intent", {})
        execution_result = context.get("execution_result", {})
        plan = context.get("plan", {})

        prompt = f"""
Original User Intent: {json.dumps(intent, indent=2)}

Execution Plan:
Steps: {len(plan.get('steps', []))} total
Risk level: {plan.get('risk_level', 'unknown')}

Execution Results:
{json.dumps(execution_result, indent=2)}

Validate the execution results against the user intent. Return your verdict as JSON.
"""
        assessment = await self.think_json(prompt, CRITIC_SYSTEM_PROMPT, session_id)

        await emit(
            session_id,
            "critic_verdict",
            agent=self.name,
            verdict=assessment.get("verdict"),
            confidence=assessment.get("confidence"),
            quality_score=assessment.get("quality_score"),
            issues=assessment.get("issues_detected", []),
        )

        return assessment
