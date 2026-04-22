"""
Message Bus — Redis Streams-based async inter-agent communication.
Agents publish events here; the orchestrator and frontend WebSocket consume them.
"""
import json
import asyncio
import time
from typing import AsyncIterator, Optional, Callable
from datetime import datetime

import redis.asyncio as aioredis
import structlog

from backend.config.settings import settings

logger = structlog.get_logger(__name__)


class MessageBus:
    """
    Redis Streams-based pub/sub for agent event communication.
    Falls back to an in-memory asyncio.Queue if Redis is unavailable.
    """

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._fallback_queues: dict[str, asyncio.Queue] = {}
        self._use_fallback = False
        self._subscribers: dict[str, list[asyncio.Queue]] = {}

    async def connect(self):
        try:
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=3,
            )
            await self._redis.ping()
            logger.info("MessageBus connected to Redis", url=settings.REDIS_URL)
        except Exception as e:
            logger.warning("Redis unavailable, using in-memory fallback", error=str(e))
            self._use_fallback = True

    async def disconnect(self):
        if self._redis:
            await self._redis.aclose()

    async def publish(self, session_id: str, event: dict):
        """Publish an event to a session's stream."""
        event["timestamp"] = datetime.utcnow().isoformat()
        event["session_id"] = session_id

        if self._use_fallback:
            # In-memory: push to all subscribers for this session
            for q in self._subscribers.get(session_id, []):
                await q.put(event)
            return

        try:
            stream_key = f"jarvis:events:{session_id}"
            await self._redis.xadd(
                stream_key,
                {"data": json.dumps(event)},
                maxlen=500,  # keep last 500 events per session
            )
            # Also push to local subscribers (same process)
            for q in self._subscribers.get(session_id, []):
                await q.put(event)
        except Exception as e:
            logger.error("Failed to publish event", error=str(e))

    def subscribe(self, session_id: str) -> asyncio.Queue:
        """Subscribe to events for a session. Returns an asyncio Queue."""
        q: asyncio.Queue = asyncio.Queue()
        if session_id not in self._subscribers:
            self._subscribers[session_id] = []
        self._subscribers[session_id].append(q)
        return q

    def unsubscribe(self, session_id: str, queue: asyncio.Queue):
        """Remove a subscriber queue."""
        if session_id in self._subscribers:
            try:
                self._subscribers[session_id].remove(queue)
            except ValueError:
                pass

    async def get_history(self, session_id: str, count: int = 100) -> list[dict]:
        """Retrieve recent events from the stream."""
        if self._use_fallback:
            return []
        try:
            stream_key = f"jarvis:events:{session_id}"
            entries = await self._redis.xrevrange(stream_key, count=count)
            return [json.loads(e[1]["data"]) for e in reversed(entries)]
        except Exception:
            return []


# Singleton instance
message_bus = MessageBus()


# ── Helper: emit typed events ────────────────────────────────────

async def emit(session_id: str, event_type: str, **kwargs):
    """Convenience wrapper for publishing typed events."""
    event = {"type": event_type, **kwargs}
    await message_bus.publish(session_id, event)
