"""
Proactive Initiative Engine — JARVIS's background brain.

Runs a background loop of triggers that watch for contextual signals
and surface proactive suggestions to the user. All suggestions require
user approval before any action is taken (Option A policy).
"""
import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional
import structlog

from backend.core.message_bus import message_bus, emit
from backend.proactive.triggers import MorningBriefTrigger, EventReminderTrigger, InboxScanTrigger
from backend.proactive.sleep_cycle import MemoryConsolidationTrigger

logger = structlog.get_logger(__name__)


class ProactiveEngine:
    """
    Background scheduler that periodically fires triggers and
    broadcasts proactive suggestions via the message bus.

    Uses a special broadcast session ID so all connected clients
    receive proactive events regardless of their active session.
    """

    BROADCAST_SESSION = "__proactive_broadcast__"

    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._auto_mode_enabled = False
        self._suggestions: list[dict] = []  # pending suggestions awaiting approval

        self.triggers = [
            MorningBriefTrigger(self),
            EventReminderTrigger(self),
            InboxScanTrigger(self),
            MemoryConsolidationTrigger(self),
        ]

    # ── Lifecycle ──────────────────────────────────────────────

    async def start(self):
        """Start the proactive background loop."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="proactive_engine")
        logger.info("Proactive Initiative Engine started")

    async def stop(self):
        """Gracefully stop the loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Proactive engine stopped")

    # ── Main loop ──────────────────────────────────────────────

    async def _loop(self):
        """Main scheduler loop — checks all triggers every 60 seconds."""
        # Wait a bit after startup before first scan
        await asyncio.sleep(10)

        while self._running:
            try:
                await self._scan_all_triggers()
            except Exception as e:
                logger.error("Proactive engine scan error", error=str(e))
            # Scan every 60 seconds
            await asyncio.sleep(60)

    async def _scan_all_triggers(self):
        """Run all triggers and collect any new suggestions."""
        now = datetime.now(timezone.utc)
        logger.debug("Proactive scan running", triggers=len(self.triggers), time=now.isoformat())

        for trigger in self.triggers:
            try:
                if trigger.should_fire(now):
                    suggestions = await trigger.fire(now)
                    for suggestion in suggestions:
                        await self.add_suggestion(suggestion)
                    trigger.mark_fired(now)
            except Exception as e:
                logger.error(f"Trigger {trigger.name} failed", error=str(e))

    # ── Suggestion management ──────────────────────────────────

    async def add_suggestion(self, suggestion: dict):
        """Register a new proactive suggestion and broadcast it to all sessions."""
        suggestion_id = str(uuid.uuid4())[:8]
        entry = {
            "id": suggestion_id,
            "trigger": suggestion.get("trigger", "unknown"),
            "title": suggestion.get("title", "JARVIS Suggestion"),
            "description": suggestion.get("description", ""),
            "action_label": suggestion.get("action_label", "Execute"),
            "action": suggestion.get("action"),  # structured payload for executor
            "risk_level": suggestion.get("risk_level", "low"),
            "icon": suggestion.get("icon", "💡"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending",  # pending | approved | dismissed | executed
        }
        self._suggestions.append(entry)

        # Keep only last 50
        if len(self._suggestions) > 50:
            self._suggestions = self._suggestions[-50:]

        # Broadcast to all active sessions via special broadcast session
        await self._broadcast_suggestion(entry)
        logger.info("New proactive suggestion", id=suggestion_id, title=entry["title"])

    async def _broadcast_suggestion(self, suggestion: dict):
        """Emit suggestion to all currently subscribed sessions."""
        for session_id in list(message_bus._subscribers.keys()):
            if message_bus._subscribers[session_id]:  # has active subscribers
                await emit(
                    session_id,
                    "proactive_suggestion",
                    suggestion=suggestion,
                    message=f"{suggestion['title']}",
                )

    def get_suggestions(self, status: Optional[str] = None) -> list[dict]:
        """Return pending (or filtered) suggestions."""
        if status:
            return [s for s in self._suggestions if s["status"] == status]
        return list(self._suggestions)

    def get_suggestion_by_id(self, suggestion_id: str) -> Optional[dict]:
        for s in self._suggestions:
            if s["id"] == suggestion_id:
                return s
        return None

    async def dismiss_suggestion(self, suggestion_id: str) -> bool:
        """Mark a suggestion as dismissed."""
        suggestion = self.get_suggestion_by_id(suggestion_id)
        if not suggestion:
            return False
        suggestion["status"] = "dismissed"
        suggestion["dismissed_at"] = datetime.now(timezone.utc).isoformat()
        return True

    async def approve_suggestion(self, suggestion_id: str, session_id: str) -> Optional[dict]:
        """
        Mark a suggestion as approved for execution.
        Returns the action payload for the orchestrator to process.
        Since policy = always ask, this sends the action to the chat flow.
        """
        suggestion = self.get_suggestion_by_id(suggestion_id)
        if not suggestion:
            return None
        suggestion["status"] = "approved"
        suggestion["approved_at"] = datetime.now(timezone.utc).isoformat()

        # Notify the session that execution is being handed to orchestrator
        await emit(
            session_id,
            "proactive_executing",
            suggestion_id=suggestion_id,
            title=suggestion["title"],
            message=f"Executing: {suggestion['title']}",
        )
        return suggestion.get("action")

    # ── Auto Mode ──────────────────────────────────────────────

    @property
    def auto_mode(self) -> bool:
        return self._auto_mode_enabled

    def set_auto_mode(self, enabled: bool):
        self._auto_mode_enabled = enabled
        logger.info("Auto mode changed", enabled=enabled)

    def get_status(self) -> dict:
        pending_count = len([s for s in self._suggestions if s["status"] == "pending"])
        return {
            "running": self._running,
            "auto_mode": self._auto_mode_enabled,
            "triggers": [t.name for t in self.triggers],
            "pending_suggestions": pending_count,
            "total_suggestions": len(self._suggestions),
        }


# Singleton
proactive_engine = ProactiveEngine()
