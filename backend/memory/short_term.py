"""
Short-Term Memory — Redis-backed session context.
Stores the active conversation, current intent, and task state.
Falls back to an in-memory dict if Redis is unavailable.
"""
import json
from typing import Any, Optional
from datetime import datetime

import redis.asyncio as aioredis
import structlog

from backend.config.settings import settings

logger = structlog.get_logger(__name__)


class ShortTermMemory:
    """Per-session context stored in Redis with TTL."""

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._fallback: dict[str, dict] = {}
        self._use_fallback = False

    async def connect(self):
        try:
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=3,
            )
            await self._redis.ping()
            logger.info("ShortTermMemory connected to Redis")
        except Exception as e:
            logger.warning("Redis unavailable for STM, using dict fallback", error=str(e))
            self._use_fallback = True

    async def disconnect(self):
        if self._redis:
            await self._redis.aclose()

    # ── Core operations ────────────────────────────────────────

    async def set(self, session_id: str, key: str, value: Any):
        full_key = f"jarvis:stm:{session_id}:{key}"
        data = json.dumps(value)
        if self._use_fallback:
            if session_id not in self._fallback:
                self._fallback[session_id] = {}
            self._fallback[session_id][key] = value
            return
        await self._redis.set(full_key, data, ex=settings.REDIS_SESSION_TTL)

    async def get(self, session_id: str, key: str, default: Any = None) -> Any:
        full_key = f"jarvis:stm:{session_id}:{key}"
        if self._use_fallback:
            return self._fallback.get(session_id, {}).get(key, default)
        data = await self._redis.get(full_key)
        if data is None:
            return default
        return json.loads(data)

    async def delete(self, session_id: str, key: str):
        full_key = f"jarvis:stm:{session_id}:{key}"
        if self._use_fallback:
            self._fallback.get(session_id, {}).pop(key, None)
            return
        await self._redis.delete(full_key)

    # ── Conversation history ────────────────────────────────────

    async def append_message(self, session_id: str, role: str, content: str):
        """Append a message to the conversation history."""
        history = await self.get(session_id, "conversation_history", [])
        history.append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        })
        # Keep last 50 messages
        if len(history) > 50:
            history = history[-50:]
        await self.set(session_id, "conversation_history", history)

    async def get_conversation_history(self, session_id: str) -> list[dict]:
        return await self.get(session_id, "conversation_history", [])

    async def get_recent_messages(self, session_id: str, n: int = 10) -> list[dict]:
        history = await self.get_conversation_history(session_id)
        return history[-n:]

    # ── Task state ─────────────────────────────────────────────

    async def set_current_task(self, session_id: str, task: dict):
        await self.set(session_id, "current_task", task)

    async def get_current_task(self, session_id: str) -> Optional[dict]:
        return await self.get(session_id, "current_task")

    async def clear_current_task(self, session_id: str):
        await self.delete(session_id, "current_task")

    # ── Context bundle ─────────────────────────────────────────

    async def get_context_bundle(self, session_id: str) -> dict:
        """Returns a combined context dict for agent prompts."""
        history = await self.get_recent_messages(session_id, 10)
        task = await self.get_current_task(session_id)
        return {
            "recent_messages": history,
            "current_task": task,
        }

    async def clear_session(self, session_id: str):
        """Wipe all session data."""
        if self._use_fallback:
            self._fallback.pop(session_id, None)
            return
        pattern = f"jarvis:stm:{session_id}:*"
        keys = await self._redis.keys(pattern)
        if keys:
            await self._redis.delete(*keys)


# Singleton
short_term_memory = ShortTermMemory()
