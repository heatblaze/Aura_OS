"""
Proactive Triggers — individual background scanners.

Each trigger knows:
- when it should fire (schedule / condition)
- what to check (tools or heuristics)
- what suggestions to produce

All suggestions are opinion-only — no actions are taken without user approval.
"""
import asyncio
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from typing import TYPE_CHECKING

import httpx
import structlog

from backend.config.settings import settings

if TYPE_CHECKING:
    from backend.proactive.engine import ProactiveEngine

logger = structlog.get_logger(__name__)


class BaseTrigger(ABC):
    """Abstract base for all proactive triggers."""
    name: str = "base_trigger"
    description: str = ""

    def __init__(self, engine: "ProactiveEngine"):
        self.engine = engine
        self._last_fired: datetime | None = None

    @abstractmethod
    def should_fire(self, now: datetime) -> bool:
        """Return True if this trigger should run now."""
        ...

    @abstractmethod
    async def fire(self, now: datetime) -> list[dict]:
        """Execute the trigger check and return a list of suggestion dicts."""
        ...

    def mark_fired(self, at: datetime):
        self._last_fired = at

    def _hours_since_last_fired(self, now: datetime) -> float:
        if not self._last_fired:
            return float("inf")
        delta = now - self._last_fired
        return delta.total_seconds() / 3600


# ── Morning Brief Trigger ───────────────────────────────────────

class MorningBriefTrigger(BaseTrigger):
    """
    Fires once per day between 7–8 AM local time.
    Produces a suggestion to deliver a morning briefing including:
    - Today's calendar events (if Google connected)
    - Unread email count (if Gmail connected)
    """
    name = "morning_brief"
    description = "Daily morning briefing — calendar + emails"
    FIRE_HOUR = 7  # 7 AM

    def should_fire(self, now: datetime) -> bool:
        local_hour = now.astimezone().hour
        # Fire between 7:00 and 7:59 AM, once per day
        if local_hour != self.FIRE_HOUR:
            return False
        if self._last_fired:
            since_last = (now - self._last_fired).total_seconds()
            if since_last < 3600 * 20:  # not fired in last 20h
                return False
        return True

    async def fire(self, now: datetime) -> list[dict]:
        date_str = now.astimezone().strftime("%A, %B %d")
        return [{
            "trigger": self.name,
            "title": f"Good morning! Ready for your {date_str} brief?",
            "description": (
                "JARVIS can pull your calendar events and unread emails "
                "to prepare your daily briefing."
            ),
            "action_label": "Generate Brief",
            "action": {
                "type": "orchestrate",
                "message": f"Give me a morning brief for today, {date_str}. "
                           "Summarise my calendar and any important emails.",
            },
            "risk_level": "low",
            "icon": "🌅",
        }]


# ── Event Reminder Trigger ──────────────────────────────────────

class EventReminderTrigger(BaseTrigger):
    """
    Polls Google Calendar every 10 minutes.
    Emits a reminder suggestion when an event is within 15 minutes.
    Gracefully skips if Google Calendar is not connected.
    """
    name = "event_reminder"
    description = "15-minute reminders for upcoming calendar events"
    POLL_MINUTES = 10
    REMIND_MINUTES = 15

    def __init__(self, engine: "ProactiveEngine"):
        super().__init__(engine)
        self._reminded_events: set[str] = set()

    def should_fire(self, now: datetime) -> bool:
        if not self._last_fired:
            return True
        since_last_mins = (now - self._last_fired).total_seconds() / 60
        return since_last_mins >= self.POLL_MINUTES

    async def fire(self, now: datetime) -> list[dict]:
        suggestions = []
        try:
            # Check if Google Calendar tool is available
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get("http://localhost:8000/health")
                if resp.status_code != 200:
                    return []
                health = resp.json()
                tools = health.get("services", {}).get("tools_configured", [])
                if "google_calendar" not in tools:
                    return []  # Calendar not connected — skip silently

            # Fetch upcoming events from the calendar tool
            window_start = now.isoformat()
            window_end = (now + timedelta(minutes=self.REMIND_MINUTES + 5)).isoformat()

            # We call the REST endpoint so we don't import tool directly
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post("http://localhost:8000/chat", json={
                    "message": f"List my calendar events between {window_start} and {window_end}. "
                               "Reply as JSON list with fields: id, title, start_time.",
                    "session_id": "__proactive_calendar_check__",
                    "user_id": "default_user",
                })
                if resp.status_code != 200:
                    return []
                data = resp.json()

            # Parse events from response (best-effort)
            response_text = data.get("response", "")
            # We emit a generic reminder suggestion if we detect upcoming events
            if any(keyword in response_text.lower() for keyword in ["meeting", "call", "event", "appointment"]):
                event_key = f"reminder_{now.strftime('%Y%m%d%H%M')}"
                if event_key not in self._reminded_events:
                    self._reminded_events.add(event_key)
                    suggestions.append({
                        "trigger": self.name,
                        "title": "Upcoming event in ~15 minutes",
                        "description": "JARVIS detected an upcoming calendar event. View your schedule?",
                        "action_label": "Show My Schedule",
                        "action": {
                            "type": "orchestrate",
                            "message": "What are my next events in the next hour?",
                        },
                        "risk_level": "low",
                        "icon": "📅",
                    })
        except Exception as e:
            logger.debug("EventReminderTrigger skipped", reason=str(e))

        return suggestions


# ── Inbox Scan Trigger ─────────────────────────────────────────

class InboxScanTrigger(BaseTrigger):
    """
    Runs every hour. Checks Gmail for unread emails requiring action.
    Emits a suggestion for each batch of unread actionable emails.
    Gracefully skips if Gmail is not connected.
    """
    name = "inbox_scan"
    description = "Hourly scan for actionable emails"
    POLL_HOURS = 1

    def should_fire(self, now: datetime) -> bool:
        hours_since = self._hours_since_last_fired(now)
        return hours_since >= self.POLL_HOURS

    async def fire(self, now: datetime) -> list[dict]:
        suggestions = []
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get("http://localhost:8000/health")
                if resp.status_code != 200:
                    return []
                health = resp.json()
                tools = health.get("services", {}).get("tools_configured", [])
                if "gmail" not in tools:
                    return []  # Gmail not connected — skip

            suggestions.append({
                "trigger": self.name,
                "title": "Inbox check: Review unread emails?",
                "description": (
                    "JARVIS can scan your inbox for emails that may need a reply "
                    "or action, and help you draft responses."
                ),
                "action_label": "Scan Inbox",
                "action": {
                    "type": "orchestrate",
                    "message": "Check my Gmail inbox for unread emails that need action. "
                               "Summarise them and suggest replies.",
                },
                "risk_level": "low",
                "icon": "📬",
            })
        except Exception as e:
            logger.debug("InboxScanTrigger skipped", reason=str(e))

        return suggestions
