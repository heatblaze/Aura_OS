"""
Base Tool — all tools inherit from this.
Provides a standardized execute() interface with error handling.
"""
from abc import ABC, abstractmethod
from typing import Any
import structlog

logger = structlog.get_logger(__name__)


class ToolResult:
    def __init__(self, success: bool, data: Any = None, error: str = None, metadata: dict = None):
        self.success = success
        self.data = data
        self.error = error
        self.metadata = metadata or {}

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "metadata": self.metadata,
        }


class BaseTool(ABC):
    name: str = "base_tool"
    description: str = "Base tool"
    requires_auth: bool = False
    is_enabled: bool = True

    def is_configured(self) -> bool:
        """Return True if this tool has all required credentials."""
        return True

    async def execute(self, params: dict) -> dict:
        """Execute the tool with given params. Returns a ToolResult dict."""
        if not self.is_enabled:
            return ToolResult(
                success=False,
                error=f"Tool '{self.name}' is currently disabled by protocol manifest.",
                metadata={"tool": self.name, "enabled": False},
            ).to_dict()

        if not self.is_configured():
            return ToolResult(
                success=False,
                error=f"Tool '{self.name}' is not configured. Add API keys to .env file.",
                metadata={"tool": self.name, "configured": False},
            ).to_dict()
        try:
            result = await self._run(params)
            return result if isinstance(result, dict) else result.to_dict()
        except Exception as e:
            logger.error("Tool execution error", tool=self.name, error=str(e))
            return ToolResult(success=False, error=str(e), metadata={"tool": self.name}).to_dict()

    @abstractmethod
    async def _run(self, params: dict) -> ToolResult:
        """Implement actual tool logic here."""
        ...

    def get_info(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "requires_auth": self.requires_auth,
            "configured": self.is_configured(),
            "enabled": self.is_enabled,
        }
