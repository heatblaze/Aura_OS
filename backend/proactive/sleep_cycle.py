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
        
        # If we haven't fired in memory yet (e.g. system just booted), we MUST return True 
        # so `fire()` can check the database timestamp for catch-up.
        if self._last_fired is None:
            return True
            
        # Standard strict 3 AM check
        if local_hour == self.FIRE_HOUR:
            since_last = (now - self._last_fired).total_seconds()
            if since_last > 3600 * 20:  # Prevent double-firing at 3 AM
                return True
                
        # Drift check: if it's been more than 24 hours since the last in-memory run
        since_last = (now - self._last_fired).total_seconds()
        if since_last > 3600 * 24:
            return True
            
        return False

    async def fire(self, now: datetime) -> list[dict]:
        try:
            # Fetch persistent state from Postgres
            profile = await long_term_memory.get_or_create_profile("default_user")
            prefs = profile.get("preferences", {})
            last_sleep_cycle_str = prefs.get("last_sleep_cycle")
            
            # Check if we really need to run
            if last_sleep_cycle_str:
                last_sleep_cycle = datetime.fromisoformat(last_sleep_cycle_str)
                # If we ran in the last 20 hours, skip it (no catch-up needed)
                if (now.replace(tzinfo=None) - last_sleep_cycle.replace(tzinfo=None)).total_seconds() < 3600 * 20:
                    logger.debug("Sleep cycle catch-up skipped: already ran recently")
                    self.mark_fired(now) # Update in-memory to prevent immediate re-checks
                    return []
            
            logger.info("Executing Sleep Cycle Memory Consolidation...")
            
            logs = await long_term_memory.get_recent_actions("default_user", limit=50)
            patterns = await self.dreamer.compress(logs)
            
            for p in patterns:
                ptype = p.get("type", "fact")
                pkey = p.get("key")
                pval = p.get("value", {})
                if pkey:
                    await long_term_memory.record_pattern("default_user", ptype, pkey, pval)
            
            logger.info("Sleep cycle complete", patterns_found=len(patterns))
            
            # Persist successful run timestamp to database
            await long_term_memory.update_preference("default_user", "last_sleep_cycle", now.isoformat())
            self.mark_fired(now) # Update in-memory state
            
        except Exception as e:
            logger.error("Memory consolidation failed", error=str(e))
            
        return []

