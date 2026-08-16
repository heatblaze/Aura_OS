"""
Base Agent — all agents inherit from this.
Provides Ollama LLM access, structured JSON generation, and event emission.
"""
import json
import re
from abc import ABC, abstractmethod
from typing import Any, Optional

# pyrefly: ignore [missing-import]
import httpx
# pyrefly: ignore [missing-import]
import structlog

from backend.config.settings import settings
from backend.core.llm_client import llm_client

logger = structlog.get_logger(__name__)


class BaseAgent(ABC):
    """
    Abstract base for all Jarvis agents.
    Each agent has a name, a system prompt, and calls local LLM or Groq Cloud for reasoning.
    """

    name: str = "base_agent"
    description: str = "Base agent"

    def __init__(self):
        pass

    async def close(self):
        pass

    # ── Core LLM call ──────────────────────────────────────────

    async def think(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        session_id: Optional[str] = None,
        expect_json: bool = True,
    ) -> str:
        """
        Call local LLM or Groq Cloud and return the response text.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        temp = 0.1 if expect_json else 0.7
        return await llm_client.think(
            messages=messages,
            temperature=temp,
            json_mode=expect_json,
            session_id=session_id,
            agent_name=self.name,
            agent_desc=self.description
        )

    async def think_json(
        self,
        prompt: str,
        system_prompt: str,
        session_id: Optional[str] = None,
    ) -> dict:
        """
        Call Ollama and parse the response as JSON.
        Retries once with a correction prompt if parsing fails.
        """
        raw = await self.think(prompt, system_prompt, session_id, expect_json=True)
        parsed = self._extract_json(raw)
        if parsed is not None:
            return parsed

        # Retry: ask model to fix its JSON
        fix_prompt = (
            f"Your previous response was not valid JSON. "
            f"Previous response: {raw[:500]}\n"
            f"Please respond ONLY with valid JSON, no explanation."
        )
        raw2 = await self.think(fix_prompt, system_prompt=system_prompt, session_id=session_id, expect_json=True)
        parsed2 = self._extract_json(raw2)
        if parsed2 is not None:
            return parsed2

        logger.warning("JSON parsing failed twice", agent=self.name, raw=raw[:200])
        return {"error": "Could not parse JSON", "raw": raw}

    @staticmethod
    def _extract_json(text: str) -> Optional[dict]:
        """Try to extract JSON from model output (handles markdown code fences)."""
        # Strip markdown code fences
        text = re.sub(r"```(?:json)?\n?", "", text).strip()
        text = text.rstrip("`").strip()

        # Try direct parse
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        # Try finding first {...} block
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass
        return None

    # ── Abstract interface ─────────────────────────────────────

    @abstractmethod
    async def process(self, context: dict, session_id: str) -> dict:
        """Process a context and return a result dict."""
        ...
