"""
Simulation Engine — Pre-execution interceptor.
Phase 4: Upgraded to use an LLM-driven SimulatorAgent to predict outcomes and flag risks.
"""
from typing import Any
import structlog
import json

from backend.agents.base import BaseAgent

logger = structlog.get_logger(__name__)


class SimulatorAgent(BaseAgent):
    name = "simulator"
    description = "Simulation Engine"
    
    SYSTEM_PROMPT = """You are the JARVIS Application Simulator.
Your job is to dry-run a proposed execution plan and predict its side effects before it actually runs.
You must carefully evaluate the risk. Any task making destructive changes to the local OS, interacting with external users via email/SMS, or modifying important data requires strict scrutiny.

Return ONLY a valid JSON object matching this schema:
{
  "safe": boolean, // True if perfectly harmless, False if there's any risk, modification, or side-effect that needs user review.
  "warnings": ["Array of specific string warnings about side effects or missing parameters"],
  "predictions": ["Array of predicted outcomes if the plan succeeds"],
  "risk_level": "low" | "medium" | "high" 
}
"""

    async def process(self, context: dict, session_id: str) -> dict:
        """
        Takes the plan and simulates execution.
        """
        plan = context.get("plan", {})
        
        prompt = f"""Evaluate this proposed execution plan:
{json.dumps(plan, indent=2)}

Predict side effects, identify risks, and assign a safety rating.
"""
        result = await self.think_json(prompt, self.SYSTEM_PROMPT, session_id)
        
        return {
            "safe": result.get("safe", False),
            "warnings": result.get("warnings", []),
            "predictions": result.get("predictions", []),
            "risk_level": result.get("risk_level", "medium"),
            "raw": result
        }


class SimulationEngine:
    """Wrapper that matches the old interface for orchestrator."""
    def __init__(self):
        self.agent = SimulatorAgent()

    async def simulate(self, plan: dict, session_id: str, tool_registry: Any) -> dict:
        """
        Run the LLM simulation.
        We still pass tool_registry in case we want to inject tool schemas into the prompt later.
        """
        result = await self.agent.process({"plan": plan}, session_id)
        return result


# Singleton
simulation_engine = SimulationEngine()
