"""
KRONOS Dual-Engine LLM Client (Groq Cloud ↔ Local Ollama)
Routes LLM reasoning calls automatically to Groq's high-speed cloud APIs
when GROQ_API_KEY is configured, and falls back dynamically to local Ollama.
"""
import httpx
import structlog
from typing import List, Dict, Optional, Any

from backend.config.settings import settings
from backend.core.message_bus import emit

logger = structlog.get_logger(__name__)

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
            # Default Groq model
            model = settings.GROQ_MODEL or "llama3-8b-8192"
            
            headers = {
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "stream": False
            }
            if json_mode:
                payload["response_format"] = {"type": "json_object"}
                
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(self._groq_url, json=payload, headers=headers, timeout=20.0)
                    response.raise_for_status()
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    
                    if session_id and agent_name:
                        await emit(session_id, "agent_response", agent=agent_name.lower(), content=content[:500])
                    return content
            except Exception as e:
                logger.error("Groq Cloud API failed, falling back to local Ollama", error=str(e))
                # Fall back to local execution

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
            logger.error("Local Ollama request failed", error=str(e))
            raise RuntimeError(f"Local LLM execution failed: {str(e)}. Make sure Ollama is serving.")

llm_client = LLMClient()
