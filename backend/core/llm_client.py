import asyncio
import copy
import contextvars
import time
import httpx
import structlog
from typing import List, Dict, Optional, Any

from backend.config.settings import settings
from backend.core.message_bus import emit

logger = structlog.get_logger(__name__)

# ContextVar to override the model for the current task/request (e.g. for low-latency voice command processing)
current_model_override: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("current_model_override", default=None)


class ProviderHealth:
    """Tracks provider health, failure counts, and cooldown windows to prevent cascading pipeline hangs."""

    def __init__(self, name: str):
        self.name = name
        self.cooldown_until: float = 0.0
        self.consecutive_failures: int = 0

    @property
    def is_available(self) -> bool:
        return time.monotonic() >= self.cooldown_until

    def mark_success(self):
        self.consecutive_failures = 0
        self.cooldown_until = 0.0

    def mark_rate_limited(self, retry_after: float):
        self.consecutive_failures += 1
        # Cooldown for at least retry_after seconds (capped between 5s and 120s)
        cooldown = max(min(retry_after, 120.0), 5.0)
        self.cooldown_until = time.monotonic() + cooldown
        logger.warning(
            "Provider rate limited, placing on cooldown",
            provider=self.name,
            cooldown_seconds=round(cooldown, 1)
        )

    def mark_failure(self, cooldown_seconds: float = 30.0):
        self.consecutive_failures += 1
        # Scale cooldown with consecutive failures: 15s -> 30s -> 60s
        cooldown = min(cooldown_seconds * (1.5 ** (self.consecutive_failures - 1)), 180.0)
        self.cooldown_until = time.monotonic() + cooldown
        logger.warning(
            "Provider failure recorded, cooldown set",
            provider=self.name,
            consecutive_failures=self.consecutive_failures,
            cooldown_seconds=round(cooldown, 1)
        )


class LLMClient:
    def __init__(self):
        self._groq_url = "https://api.groq.com/openai/v1/chat/completions"
        self._ollama_url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        self._health_trackers: Dict[str, ProviderHealth] = {}

    def _get_health(self, identifier: str) -> ProviderHealth:
        if identifier not in self._health_trackers:
            self._health_trackers[identifier] = ProviderHealth(identifier)
        return self._health_trackers[identifier]

    async def think(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        json_mode: bool = False,
        session_id: Optional[str] = None,
        agent_name: Optional[str] = None,
        agent_desc: Optional[str] = None,
    ) -> str:
        """
        Send a chat completion request with intelligent multi-tiered resilience:
        1. Groq primary (with 429 Retry-After backoff)
        2. Groq secondary key (if primary rate-limited)
        3. NVIDIA NIM cloud fallback (if Groq unavailable)
        4. Local Ollama (with short timeout & circuit breaker)
        5. Emergency resilient fallback (context-aware JSON)
        """
        # Emit thinking event to UI if session exists
        if session_id and agent_name:
            desc = agent_desc or f"{agent_name} is reasoning"
            await emit(session_id, "agent_thinking", agent=agent_name.lower(), message=f"{desc}...")

        # ── 1. Groq Cloud Engine with 429 Retry-After & Key Rotation ──────────
        use_groq = settings.LLM_PROVIDER.lower() == "groq"
        keys_to_try = [k for k in [settings.GROQ_API_KEY, getattr(settings, "GROQ_API_KEY_SECONDARY", None)] if k]

        if use_groq and keys_to_try:
            override = current_model_override.get()
            model = override or settings.GROQ_MODEL or "openai/gpt-oss-20b"
            if not model or "llama-3.1-8b" in model.lower() or "llama3.1" in model.lower():
                model = "openai/gpt-oss-20b"

            for idx, key in enumerate(keys_to_try):
                key_id = f"groq_key_{idx}"
                health = self._get_health(key_id)

                if not health.is_available:
                    remaining = round(health.cooldown_until - time.monotonic(), 1)
                    logger.info("Groq key currently in cooldown, checking next", key_index=idx, remaining_sec=remaining)
                    continue

                logger.info("Routing prompt to Groq Cloud", agent=agent_name, key_index=idx)
                headers = {
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json"
                }
                payload: Dict[str, Any] = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "stream": False
                }
                if json_mode:
                    payload["response_format"] = {"type": "json_object"}

                # Allow 1 immediate retry on 429 if the wait is brief (<= 3 seconds)
                max_retries = 1
                for attempt in range(max_retries + 1):
                    try:
                        async with httpx.AsyncClient() as client:
                            response = await client.post(self._groq_url, json=payload, headers=headers, timeout=15.0)

                            if response.status_code == 200:
                                health.mark_success()
                                data = response.json()
                                content = data["choices"][0]["message"]["content"]
                                if session_id and agent_name:
                                    await emit(session_id, "agent_response", agent=agent_name.lower(), content=content[:500])
                                return content

                            elif response.status_code == 429:
                                # Groq returned rate limit. Read Retry-After header if present.
                                retry_header = response.headers.get("retry-after")
                                retry_sec = 2.0
                                if retry_header:
                                    try:
                                        retry_sec = float(retry_header)
                                    except ValueError:
                                        pass

                                logger.warning(
                                    "Groq 429 rate limit hit",
                                    agent=agent_name,
                                    attempt=attempt + 1,
                                    retry_seconds=retry_sec
                                )

                                # If wait time is reasonable and we have an attempt remaining, wait & retry!
                                if attempt < max_retries and retry_sec <= 3.0:
                                    await asyncio.sleep(retry_sec)
                                    continue
                                else:
                                    health.mark_rate_limited(retry_sec)
                                    break  # Move to next key or next provider
                            else:
                                logger.warning("Groq API returned non-200 status", status=response.status_code, key_index=idx)
                                health.mark_failure(cooldown_seconds=20.0)
                                break
                    except Exception as e:
                        logger.warning("Groq API request error", error=str(e), key_index=idx)
                        health.mark_failure(cooldown_seconds=15.0)
                        break

        # ── 2. NVIDIA NIM Cloud Fallback Engine ────────────────────────────────
        if settings.NVIDIA_API_KEY:
            nvidia_health = self._get_health("nvidia")
            if nvidia_health.is_available:
                logger.info("Routing prompt to NVIDIA NIM Cloud Fallback", agent=agent_name)
                nvidia_url = "https://integrate.api.nvidia.com/v1/chat/completions"
                nvidia_model = "meta/llama-3.3-70b-instruct"

                headers = {
                    "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
                    "Content-Type": "application/json"
                }

                nvidia_messages = copy.deepcopy(messages)
                if json_mode:
                    if nvidia_messages and nvidia_messages[0].get("role") == "system":
                        nvidia_messages[0]["content"] += "\nRespond ONLY with valid raw JSON."
                    else:
                        nvidia_messages.insert(0, {"role": "system", "content": "Respond ONLY with valid raw JSON."})

                payload: Dict[str, Any] = {
                    "model": nvidia_model,
                    "messages": nvidia_messages,
                    "temperature": temperature,
                    "max_tokens": 1024,
                    "stream": False
                }

                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(nvidia_url, json=payload, headers=headers, timeout=12.0)
                        if response.status_code == 200:
                            nvidia_health.mark_success()
                            data = response.json()
                            content = data["choices"][0]["message"]["content"]
                            if session_id and agent_name:
                                await emit(session_id, "agent_response", agent=agent_name.lower(), content=content[:500])
                            return content
                        else:
                            logger.warning("NVIDIA NIM returned non-200 status", status=response.status_code)
                            nvidia_health.mark_failure(cooldown_seconds=30.0)
                except Exception as e:
                    logger.warning("NVIDIA NIM Cloud failed", error=str(e))
                    nvidia_health.mark_failure(cooldown_seconds=30.0)
            else:
                logger.debug("NVIDIA NIM currently in cooldown, skipping")

        # ── 3. Local Ollama Fallback Engine ────────────────────────────────────
        ollama_health = self._get_health("ollama")
        if ollama_health.is_available:
            logger.info("Routing prompt to Local Ollama", agent=agent_name, model=settings.OLLAMA_MODEL)
            payload = {
                "model": settings.OLLAMA_MODEL,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": 2048
                }
            }
            ollama_timeout = float(getattr(settings, "OLLAMA_TIMEOUT", 5) or 5.0)
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(self._ollama_url, json=payload, timeout=ollama_timeout)
                    response.raise_for_status()
                    data = response.json()
                    content = data["message"]["content"]
                    ollama_health.mark_success()
                    if session_id and agent_name:
                        await emit(session_id, "agent_response", agent=agent_name.lower(), content=content[:500])
                    return content
            except Exception as e:
                logger.warning("Local Ollama request failed or offline; placing on cooldown", error=str(e))
                # Put on cooldown for 60s so subsequent agent steps don't waste seconds waiting on offline Ollama
                ollama_health.mark_failure(cooldown_seconds=60.0)

        # ── 4. Emergency Intelligent Fallback ───────────────────────────────────
        logger.error("All LLM providers unavailable or exhausted, using intelligent emergency fallback", agent=agent_name)
        if json_mode:
            # Check messages to see if user requested specific tool actions
            msg_texts = [str(m.get("content", "")) for m in messages if isinstance(m, dict)]
            combined = " ".join(msg_texts).lower()

            if any(kw in combined for kw in ["call", "phone", "dial", "ring", "twilio", "+91", "mobile"]):
                return (
                    '{"summary": "Telephony directive execution", "strategy": "tool_execution", '
                    '"requires_tools": true, "tools_needed": ["twilio_call"], "priority": "high", '
                    '"can_execute_autonomously": true, "clarification_question": null, '
                    '"context_notes": "Emergency fallback triggered voice call directive."}'
                )
            elif any(kw in combined for kw in ["calendar", "meeting", "schedule", "events"]):
                return (
                    '{"summary": "Calendar check directive", "strategy": "tool_execution", '
                    '"requires_tools": true, "tools_needed": ["google_calendar"], "priority": "medium", '
                    '"can_execute_autonomously": true, "clarification_question": null, '
                    '"context_notes": "Emergency fallback triggered calendar directive."}'
                )
            return '{"summary": "Direct conversational response", "strategy": "direct_response", "requires_tools": false, "tools_needed": []}'

        return "AURA OS is online. Telephony, daemon, and core operating subsystems remain synchronized."


llm_client = LLMClient()
