"""
Auto Mode state manager.

Tracks whether JARVIS is in auto mode and enforces the
approval policy: ALWAYS ask before executing (Option A).

In auto mode, the proactive engine fires more aggressively and
suggestions are highlighted prominently in the UI — but execution
still requires explicit user approval every time.
"""
from datetime import datetime, timezone
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)


class AutoModeManager:
    def __init__(self):
        self._enabled: bool = False
        self._enabled_at: Optional[str] = None
        self._disabled_at: Optional[str] = None
        self._approval_policy: str = "always_ask"  # Phase 3: always ask

    @property
    def enabled(self) -> bool:
        return self._enabled

    def toggle(self) -> bool:
        """Toggle auto mode and return new state."""
        self._enabled = not self._enabled
        ts = datetime.now(timezone.utc).isoformat()
        if self._enabled:
            self._enabled_at = ts
            logger.info("🤖 Auto Mode ENABLED — JARVIS will proactively suggest tasks")
        else:
            self._disabled_at = ts
            logger.info("⏸️  Auto Mode DISABLED")
        return self._enabled

    def get_state(self) -> dict:
        return {
            "enabled": self._enabled,
            "approval_policy": self._approval_policy,
            "policy_description": "JARVIS will always ask for your approval before executing any action.",
            "enabled_at": self._enabled_at,
            "disabled_at": self._disabled_at,
        }


# Singleton
auto_mode_manager = AutoModeManager()
