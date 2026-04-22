"""
Base Agent — all agents inherit from this.
Provides Ollama LLM access, structured JSON generation, and event emission.
"""
import json
import re
from abc import ABC, abstractmethod
from typing import Any, Optional

import httpx
import structlog

from backend.config.settings import settings
from backend.core.message_bus import emit

logger = structlog.get_logger(__name__)


class BaseAgent(ABC):
    """
    Abstract base for all Jarvis agents.
    Each agent has a name, a system prompt, and calls Ollama for reasoning.
    """

    name: str = "base_agent"
    description: str = "Base agent"

    def __init__(self):
        self._client = httpx.AsyncClient(
            base_url=settings.OLLAMA_BASE_URL,
            timeout=settings.OLLAMA_TIMEOUT,
        )

    async def close(self):
        await self._client.aclose()

    # ── Core LLM call ──────────────────────────────────────────

    async def think(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        session_id: Optional[str] = None,
        expect_json: bool = True,
    ) -> str:
        """
        Call Ollama and return the response text.
        Emits 'agent_thinking' event before calling, 'agent_response' after.
        """
        if session_id:
            await emit(session_id, "agent_thinking", agent=self.name, message=f"{self.description} is reasoning...")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.1 if expect_json else 0.7,
                "num_predict": 2048,
            },
        }

        try:
            response = await self._client.post("/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()
            content = data["message"]["content"]

            if session_id:
                await emit(session_id, "agent_response", agent=self.name, content=content[:500])

            return content
        except httpx.TimeoutException:
            logger.error("Ollama timeout", agent=self.name)
            raise RuntimeError(f"LLM timeout — is Ollama running? (ollama serve)")
        except httpx.HTTPStatusError as e:
            # Try fallback model
            if settings.OLLAMA_FALLBACK_MODEL != settings.OLLAMA_MODEL:
                logger.warning("Primary model failed, trying fallback", fallback=settings.OLLAMA_FALLBACK_MODEL)
                payload["model"] = settings.OLLAMA_FALLBACK_MODEL
                response = await self._client.post("/api/chat", json=payload)
                response.raise_for_status()
                return response.json()["message"]["content"]
            raise RuntimeError(f"Ollama error: {e}")

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
        raw2 = await self.think(fix_prompt, session_id=session_id, expect_json=True)
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
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try finding first {...} block
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return None

    # ── Abstract interface ─────────────────────────────────────

    @abstractmethod
    async def process(self, context: dict, session_id: str) -> dict:
        """Process a context and return a result dict."""
        ...
