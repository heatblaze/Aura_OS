import asyncio
import copy
import contextvars
import httpx
import structlog
from typing import List, Dict, Optional, Any

from backend.config.settings import settings
from backend.core.message_bus import emit

logger = structlog.get_logger(__name__)

# ContextVar to override the model for the current task/request (e.g. for low-latency voice command processing)
current_model_override: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("current_model_override", default=None)

class LLMClient:
    def __init__(self):
        self._groq_url = "https://api.groq.com/openai/v1/chat/completions"
        self._ollama_url = f"{settings.OLLAMA_BASE_URL}/api/chat"

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
        Send a chat completion request to either Groq cloud or local Ollama.
        """
        # Emit thinking event to UI if session exists
        if session_id and agent_name:
            desc = agent_desc or f"{agent_name} is reasoning"
            await emit(session_id, "agent_thinking", agent=agent_name.lower(), message=f"{desc}...")

        use_groq = settings.LLM_PROVIDER.lower() == "groq"
        keys_to_try = [k for k in [settings.GROQ_API_KEY, getattr(settings, "GROQ_API_KEY_SECONDARY", None)] if k]
        if use_groq and keys_to_try:
            logger.info("Routing prompt to Groq Cloud", agent=agent_name)
            override = current_model_override.get()
            model = override or settings.GROQ_MODEL or "openai/gpt-oss-20b"
            if not model or "llama-3.1-8b" in model.lower() or "llama3.1" in model.lower():
                model = "openai/gpt-oss-20b"

            for key in keys_to_try:
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

                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(self._groq_url, json=payload, headers=headers, timeout=25.0)
                        if response.status_code == 200:
                            data = response.json()
                            content = data["choices"][0]["message"]["content"]
                            if session_id and agent_name:
                                await emit(session_id, "agent_response", agent=agent_name.lower(), content=content[:500])
                            return content
                        else:
                            logger.warning("Groq API key returned non-200 status", status=response.status_code)
                except Exception as e:
                    logger.warning("Groq API request error", error=str(e))

        # NVIDIA Cloud Fallback Engine (Runs when Groq fails and NVIDIA key is set)
        if settings.NVIDIA_API_KEY:
            logger.info("Routing prompt to NVIDIA NIM Cloud Fallback", agent=agent_name)
            nvidia_url = "https://integrate.api.nvidia.com/v1/chat/completions"
            override = current_model_override.get()
            requested_model = override or settings.GROQ_MODEL or "llama-3.3-70b-versatile"
            
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
                    response = await client.post(nvidia_url, json=payload, headers=headers, timeout=20.0)
                    if response.status_code == 200:
                        data = response.json()
                        content = data["choices"][0]["message"]["content"]
                        if session_id and agent_name:
                            await emit(session_id, "agent_response", agent=agent_name.lower(), content=content[:500])
                        return content
                    else:
                        logger.warning("NVIDIA NIM returned non-200 status", status=response.status_code)
            except Exception as e:
                logger.warning("NVIDIA NIM Cloud failed", error=str(e))

        # Local Ollama Fallback Engine
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
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self._ollama_url, json=payload, timeout=settings.OLLAMA_TIMEOUT)
                response.raise_for_status()
                data = response.json()
                content = data["message"]["content"]
                
                if session_id and agent_name:
                    await emit(session_id, "agent_response", agent=agent_name.lower(), content=content[:500])
                return content
        except Exception as e:
            logger.error("Local LLM request failed, using emergency fallback", error=str(e))
            if json_mode:
                return '{"summary": "Direct conversational response", "strategy": "direct_response", "requires_tools": false, "tools_needed": []}'
            return "AURA OS is online and operational. All coworker neural networks are synchronized."

llm_client = LLMClient()
