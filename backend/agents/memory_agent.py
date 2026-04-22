"""
Memory Agent — retrieves relevant context and stores new knowledge.
"""
from backend.agents.base import BaseAgent
from backend.core.message_bus import emit
from backend.memory.short_term import short_term_memory
from backend.memory.long_term import long_term_memory
from backend.memory.knowledge import knowledge_memory


class MemoryAgent(BaseAgent):
    name = "memory"
    description = "Memory Agent — retrieving context and updating knowledge"

    async def process(self, context: dict, session_id: str) -> dict:
        """Retrieve enriched context from all memory layers."""
        await emit(session_id, "agent_start", agent=self.name, message="Memory Agent fetching context...")

        user_id = context.get("user_id", "default_user")
        user_message = context.get("user_message", "")

        # Layer 1: Short-term (session)
        stm_context = await short_term_memory.get_context_bundle(session_id)

        # Layer 2: Long-term (user profile + patterns)
        profile = await long_term_memory.get_or_create_profile(user_id)
        recent_actions = await long_term_memory.get_recent_actions(user_id, limit=10)
        patterns = await long_term_memory.get_patterns(user_id)

        # Layer 3: Knowledge (semantic search)
        similar_tasks = await knowledge_memory.recall_similar_tasks(user_message, n=3)

        enriched_context = {
            **context,
            **stm_context,
            "user_profile": profile,
            "recent_actions": recent_actions,
            "user_patterns": patterns,
            "similar_past_tasks": similar_tasks,
            "memory_stats": knowledge_memory.get_stats(),
        }

        await emit(
            session_id,
            "memory_retrieved",
            agent=self.name,
            has_history=len(stm_context.get("recent_messages", [])) > 0,
            similar_tasks_found=len(similar_tasks),
            patterns_loaded=len(patterns),
        )

        return enriched_context

    async def store_result(
        self,
        session_id: str,
        user_id: str,
        user_message: str,
        response: str,
        intent: dict,
        execution_result: dict,
        critic_verdict: dict,
    ):
        """Store the completed interaction in all applicable memory layers."""
        # Short-term: add to conversation history
        await short_term_memory.append_message(session_id, "user", user_message)
        await short_term_memory.append_message(session_id, "assistant", response)

        # Long-term: log the action
        await long_term_memory.log_action(
            session_id=session_id,
            user_id=user_id,
            intent=intent.get("intent", "unknown"),
            tool_used=None,
            success=critic_verdict.get("user_facing_success", True),
            metadata={"verdict": critic_verdict.get("verdict"), "quality": critic_verdict.get("quality_score")},
        )

        # Knowledge: store action summary for future recall
        if critic_verdict.get("user_facing_success"):
            summary = f"User asked: {user_message}. Result: {response[:300]}"
            await knowledge_memory.store_action_summary(
                session_id=session_id,
                action_summary=summary,
                metadata={
                    "intent": intent.get("intent", "unknown"),
                    "user_id": user_id,
                    "timestamp": intent.get("timestamp", ""),
                },
            )

        await emit(session_id, "memory_updated", agent=self.name, message="Context stored in memory")
