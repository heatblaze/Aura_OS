"""
Tool Registry — central registry for all available tools.
"""
from typing import Optional
from backend.tools.tools import (
    WebSearchTool,
    GoogleCalendarTool,
    GmailTool,
    TwilioTool,
    TwilioSmsTool,
    TwilioCallTool,
    BrowserTool,
    ClockTool,
    GenerateImageTool,
)
from backend.tools.system_tool import LocalSystemTool
from backend.tools.base_tool import BaseTool
import structlog

logger = structlog.get_logger(__name__)


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool):
        self._tools[tool.name] = tool
        logger.info("Tool registered", name=tool.name, configured=tool.is_configured())

    def get(self, name: str) -> Optional[BaseTool]:
        if not name:
            return None
        name_clean = name.lower().strip()
        if name_clean in self._tools:
            return self._tools.get(name_clean)
        # Map planner tool aliases
        if name_clean in {"twilio_sms", "twilio_call"}:
            return self._tools.get("twilio")
        if name_clean in {"generate_image", "image_generator", "generate_image_tool", "image_generation", "dall_e", "flux"}:
            return self._tools.get("generate_image")
        return None

    def list_all(self) -> list[dict]:
        return [t.get_info() for t in self._tools.values()]

    def list_configured(self) -> list[str]:
        return [name for name, t in self._tools.items() if t.is_configured()]

    def toggle_tool(self, name: str) -> Optional[bool]:
        """Toggle a tool's enabled state. Returns the new state, or None if not found."""
        tool = self._tools.get(name)
        if tool:
            tool.is_enabled = not tool.is_enabled
            logger.info("Tool toggled", name=name, enabled=tool.is_enabled)
            return tool.is_enabled
        return None


def create_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(WebSearchTool())
    registry.register(GoogleCalendarTool())
    registry.register(GmailTool())
    registry.register(TwilioTool())
    registry.register(TwilioSmsTool())
    registry.register(TwilioCallTool())
    registry.register(BrowserTool())
    registry.register(LocalSystemTool())
    registry.register(ClockTool())
    registry.register(GenerateImageTool())
    return registry


# Singleton
tool_registry = create_registry()
