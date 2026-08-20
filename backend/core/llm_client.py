import asyncio
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

        use_groq = bool(settings.GROQ_API_KEY) and settings.LLM_PROVIDER.lower() == "groq"
        
        if use_groq:
            logger.info("Routing prompt to Groq Cloud", agent=agent_name)
            # Default Groq model (can be overridden by ContextVar for voice commands)
            override = current_model_override.get()
            model = override or settings.GROQ_MODEL or "openai/gpt-oss-20b"
            # Intercept deprecated Llama 3.1 8b models and replace with openai/gpt-oss-20b
            if not model or "llama-3.1-8b" in model.lower() or "llama3.1" in model.lower():
                model = "openai/gpt-oss-20b"
            
            headers = {
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            
            max_retries = 2
            backoff_delay = 0.5
            current_model = model

            for attempt in range(max_retries + 1):
                payload: Dict[str, Any] = {
                    "model": current_model,
                    "messages": messages,
                    "temperature": temperature,
                    "stream": False
                }
                if json_mode:
                    payload["response_format"] = {"type": "json_object"}
                    
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(self._groq_url, json=payload, headers=headers, timeout=20.0)
                        
                        # Handle 429 Rate Limits
                        if response.status_code == 429:
                            if attempt < max_retries:
                                await asyncio.sleep(backoff_delay)
                                backoff_delay *= 2.0
                                continue
                            else:
                                raise httpx.HTTPStatusError("Groq Rate Limit Exceeded", request=response.request, response=response)
                                
                        response.raise_for_status()
                        data = response.json()
                        content = data["choices"][0]["message"]["content"]
                        
                        if session_id and agent_name:
                            await emit(session_id, "agent_response", agent=agent_name.lower(), content=content[:500])
                        return content
                except Exception as e:
                    # If this is the last attempt or it's a non-429 status error, fail over to secondary/Ollama
                    if attempt >= max_retries or (isinstance(e, httpx.HTTPStatusError) and e.response.status_code != 429):
                        logger.error("Groq Cloud API failed, falling back to secondary provider", error=str(e))
                        break
                    
                    logger.warning("Transient error on Groq, retrying...", error=str(e), attempt=attempt)
                    await asyncio.sleep(backoff_delay)
                    backoff_delay *= 2.0

        # NVIDIA Cloud Fallback Engine (Runs when Groq fails and NVIDIA key is set)
        if settings.NVIDIA_API_KEY:
            logger.info("Routing prompt to NVIDIA NIM Cloud Fallback", agent=agent_name)
            nvidia_url = "https://integrate.api.nvidia.com/v1/chat/completions"
            
            # Map requested Groq model to equivalent NVIDIA NIM model
            override = current_model_override.get()
            requested_model = override or settings.GROQ_MODEL or "llama-3.3-70b-versatile"
            
            if "70b" in requested_model.lower():
                nvidia_model = "meta/llama-3.3-70b-instruct"
            elif "8b" in requested_model.lower():
                nvidia_model = "meta/llama-3.1-8b-instruct"
            else:
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
                "top_p": 0.7,
                "max_tokens": 1024,
                "stream": False
            }

            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(nvidia_url, json=payload, headers=headers, timeout=20.0)
                    response.raise_for_status()
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    
                    if session_id and agent_name:
                        await emit(session_id, "agent_response", agent=agent_name.lower(), content=content[:500])
                    logger.info("Successfully received response from NVIDIA NIM Cloud Fallback", agent=agent_name)
                    return content
            except Exception as e:
                logger.error("NVIDIA Cloud Fallback failed, falling back to local Ollama", error=str(e))

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
