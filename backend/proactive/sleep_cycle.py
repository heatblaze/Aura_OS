"""
Sleep Cycle — Memory Consolidation Trigger.
Runs daily in the deep background (e.g., 3:00 AM) to consolidate conversational memory
into Postgres LearntPatterns.
"""
import asyncio
from datetime import datetime
import json
import structlog

from backend.proactive.triggers import BaseTrigger
from backend.agents.base import BaseAgent
from backend.memory.long_term import long_term_memory
from backend.config.settings import settings

logger = structlog.get_logger(__name__)


class DreamAgent(BaseAgent):
    """Specialized agent just for compressing memories."""
    name = "dream_agent"
    description = "Memory Consolidator"
    
    SYSTEM_PROMPT = """You are JARVIS's Dream Agent.
Your job is to analyze the user's action logs from the past 24 hours.
Identify structural preferences, recurring names, workflows, or instructions the user implied.

Return ONLY a valid JSON list of identified patterns matching this schema:
[
  {
    "type": "preference" | "routine" | "fact",
    "key": "A short, unique identifier (e.g. 'preferred_email_style', 'boss_name')",
    "value": {"details": "Detailed explanation of the pattern expected"}
  }
]
If there are no clear patterns, return an empty list [].
"""

    async def process(self, context: dict, session_id: str) -> dict:
        """Required by BaseAgent. Maps to compress()."""
        logs = context.get("logs", [])
        patterns = await self.compress(logs, session_id)
        return {"patterns": patterns}

    async def compress(self, logs: list[dict], session_id: str = "sleep_cycle") -> list[dict]:
        if not logs:
            return []
            
        prompt = f"Analyze the following action logs from today:\n{json.dumps(logs, indent=2)}"
        result = await self.think_json(prompt, self.SYSTEM_PROMPT, session_id)
        
        if isinstance(result, list):
            return result
        elif isinstance(result, dict) and "patterns" in result:
            return result.get("patterns", [])
        return []


class MemoryConsolidationTrigger(BaseTrigger):
    """
    Fires at 3 AM local time to digest yesterday's ActionLogs.
    """
    name = "memory_consolidation"
    description = "Daily memory compression"
    FIRE_HOUR = 3  # 3 AM

    def __init__(self, engine):
        super().__init__(engine)
        self.dreamer = DreamAgent()

    def should_fire(self, now: datetime) -> bool:
        local_hour = now.astimezone().hour
        # Fire between 3:00 and 3:59 AM
        if local_hour != self.FIRE_HOUR:
            return False
            
        if self._last_fired:
            since_last = (now - self._last_fired).total_seconds()
            if since_last < 3600 * 20:  # not fired in last 20h
                return False
        return True

    async def fire(self, now: datetime) -> list[dict]:
        try:
            # We don't have a rigid way to fetch *only* the last 24h of logs across all users easily 
            # here without modifying long_term.py querying. 
            # For Phase 4, we will fetch the default user's recent actions.
            logs = await long_term_memory.get_recent_actions("default_user", limit=50)
            
            patterns = await self.dreamer.compress(logs)
            
            for p in patterns:
                ptype = p.get("type", "fact")
                pkey = p.get("key")
                pval = p.get("value", {})
                if pkey:
                    await long_term_memory.record_pattern("default_user", ptype, pkey, pval)
            
            logger.info("Sleep cycle complete", patterns_found=len(patterns))
            
            # This trigger does NOT emit a frontend suggestion asking for approval, 
            # because it's an internal autonomous system maintenance task.
            # However, we can return a low-intrustion notification if we wanted.
            
        except Exception as e:
            logger.error("Memory consolidation failed", error=str(e))
            
        return []

