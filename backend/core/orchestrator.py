"""
Orchestrator — the main pipeline that coordinates all 5 agents.
Flow: Memory → Intent → Commander → Planner → Executor → Critic → Memory → Response
"""
import time
from typing import Optional
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
from backend.execution.simulator import simulation_engine

logger = structlog.get_logger(__name__)


RESPONSE_SYSTEM_PROMPT = """You are JARVIS, an autonomous AI operating system.
Generate a clear, helpful, concise response to the user based on the execution results.
Be direct and actionable. Use markdown formatting when helpful.
If an action was completed, confirm it clearly.
If something failed, explain why and offer alternatives.
Do NOT mention internal agent names or system details unless specifically asked."""


class Orchestrator:
    def __init__(self):
        self.memory_agent = MemoryAgent()
        self.commander = CommanderAgent()
        self.planner = PlannerAgent()
        self.executor = ExecutorAgent()
        self.critic = CriticAgent()

    async def process(self, user_message: str, session_id: str, user_id: str = "default_user") -> dict:
        """
        Run the full MCP pipeline for a user message.
        Returns a dict with the final response and all intermediate results.
        """
        start_time = time.monotonic()

        await emit(session_id, "pipeline_start", message="JARVIS activated", user_message=user_message)

        try:
            # ── Step 1: Memory retrieval ────────────────────────
            enriched_context = await self.memory_agent.process(
                {"user_message": user_message, "user_id": user_id},
                session_id,
            )

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

            # ── Step 3: Commander decision ──────────────────────
            command = await self.commander.process(enriched_context, session_id)
            enriched_context["command"] = command

            # If clarification needed, stop here
            if command.get("strategy") == "clarification_needed":
                question = command.get("clarification_question", "Could you clarify your request?")
                await emit(session_id, "clarification_needed", question=question)
                await short_term_memory.append_message(session_id, "user", user_message)
                await short_term_memory.append_message(session_id, "assistant", question)
                return {"response": question, "intent": intent, "command": command}

            # ── Step 4: Planning ────────────────────────────────
            plan = None
            execution_result = {"results": [], "all_success": True, "total_steps": 0}

            if command.get("requires_tools") and command.get("strategy") != "direct_response":
                plan = await self.planner.process(enriched_context, session_id)
                enriched_context["plan"] = plan

                # ── Step 4.5: Simulation ────────────────────────
                await emit(session_id, "simulation_start", message="Running simulation checks...")
                sim_result = await simulation_engine.simulate(plan, session_id, tool_registry)
                
                if not sim_result.get("safe"):
                    # Conflict or invalid parameter detected
                    warnings_str = ", ".join(sim_result.get("warnings", []))
                    msg = f"Simulation Warning: {warnings_str}. Shall I proceed anyway?"
                    await emit(session_id, "confirmation_required", message=msg, risk_level="high")
                    await short_term_memory.append_message(session_id, "user", user_message)
                    await short_term_memory.append_message(session_id, "assistant", msg)
                    return {"response": msg, "intent": intent, "plan": plan, "needs_confirmation": True, "simulation": sim_result}

                # ── Step 5: Execution ───────────────────────────
                if not plan.get("requires_confirmation", False):
                    enriched_context["tool_registry"] = tool_registry
                    execution_result = await self.executor.process(enriched_context, session_id)
                else:
                    msg = plan.get("confirmation_message", "This action requires your confirmation. Shall I proceed?")
                    await emit(session_id, "confirmation_required", message=msg)
                    await short_term_memory.append_message(session_id, "user", user_message)
                    await short_term_memory.append_message(session_id, "assistant", msg)
                    return {"response": msg, "intent": intent, "plan": plan, "needs_confirmation": True}
            else:
                await emit(session_id, "direct_response_mode", message="Generating direct response...")

            # ── Step 6: Critic validation ───────────────────────
            critic_verdict = await self.critic.process(
                {**enriched_context, "execution_result": execution_result, "plan": plan or {}},
                session_id,
            )

            # ── Step 7: Generate response ───────────────────────
            response_text = await self._generate_response(
                user_message, intent, execution_result, critic_verdict, session_id
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
            await emit(session_id, "pipeline_complete",
                       elapsed_ms=round(elapsed_ms),
                       response_preview=response_text[:100])

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
            await emit(session_id, "pipeline_error", error=str(e))
            error_msg = (
                f"I encountered an error processing your request: {str(e)}\n\n"
                "Please ensure Ollama is running: `ollama serve`"
            )
            return {"response": error_msg, "error": str(e)}

    async def _generate_response(
        self,
        user_message: str,
        intent: dict,
        execution_result: dict,
        critic_verdict: dict,
        session_id: str,
    ) -> str:
        """Generate the final user-facing response using Ollama."""
        results_summary = ""
        for r in execution_result.get("results", []):
            if r.get("success"):
                results_summary += f"\n✅ {r.get('description', '')}: {str(r.get('result', {}).get('data', ''))[:200]}"
            else:
                results_summary += f"\n❌ {r.get('description', '')}: {r.get('error', 'Failed')}"

        verdict = critic_verdict.get("verdict", "unknown")
        prompt = f"""User asked: "{user_message}"

Intent detected: {intent.get('intent')} (confidence: {intent.get('confidence', 0):.0%})

Execution results:{results_summary if results_summary else ' No tools were needed.'}

Quality assessment: {verdict} (score: {critic_verdict.get('quality_score', 'N/A')}/10)

Generate a helpful, conversational response to the user."""

        try:
            response = await self.commander.think(prompt, RESPONSE_SYSTEM_PROMPT, session_id, expect_json=False)
            return response
        except Exception as e:
            return f"I've processed your request. {results_summary or 'Let me know if you need anything else.'}"

    async def close(self):
        for agent in [self.memory_agent, self.commander, self.planner, self.executor, self.critic]:
            await agent.close()
        await intent_engine.close()


# Singleton
orchestrator = Orchestrator()
