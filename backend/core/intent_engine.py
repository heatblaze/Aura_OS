"""
Intent Engine — extracts structured intent from natural language using Ollama.
"""
import json
from datetime import datetime, timezone
from typing import Optional

# pyrefly: ignore [missing-import]
import httpx
# pyrefly: ignore [missing-import]
import structlog

from backend.config.settings import settings
from backend.core.llm_client import llm_client

logger = structlog.get_logger(__name__)


INTENT_SYSTEM_PROMPT = """You are an intent extraction engine for JARVIS, an AI operating system.

Extract the intent from the user's message and return ONLY valid JSON in this exact format:
{
  "intent": "intent_name",
  "confidence": 0.0-1.0,
  "entities": {
    "key": "value"
  },
  "priority": "low | medium | high | urgent",
  "category": "productivity | communication | information | automation | system | conversation",
  "requires_action": true/false,
  "sentiment": "positive | neutral | negative | urgent",
  "language": "en"
}

Intent names (use these exactly):
- schedule_event: Calendar/meeting scheduling
- send_email: Compose and send email
- search_web: Search the internet
- make_call: Make a phone call
- send_message: Send SMS/WhatsApp message
- browse_website: Open or scrape a website
- get_information: Get facts, weather, news
- set_reminder: Set a reminder
- create_note: Create a note
- manage_tasks: Task/to-do management
- system_control: Control system settings
- system_command: Open local folders, files, file explorer, notepad, or run desktop shell commands
- conversation: General chat or questions
- unknown: Cannot determine intent

Extract ALL relevant entities (names, dates, times, locations, topics, etc.)"""


class IntentEngine:
    def __init__(self):
        pass

    async def close(self):
        pass

    async def extract(self, user_message: str, conversation_history: Optional[list] = None) -> dict:
        """
        Extract structured intent from a natural language message.
        Returns an intent dict with entities, priority, and category.
        """
        # Fast rule-based bypass for simple conversational phrases to reduce latency
        msg_clean = user_message.strip().lower().rstrip("?").rstrip("!").rstrip(".")

        # Capture the Arise protocol invocation cleanly
        if "arise" in msg_clean and ("initiate" in msg_clean or "protocol" in msg_clean or "arise" == msg_clean):
            logger.info("ARISE Protocol fast-path bypass triggered", message=user_message)
            intent = self._fallback_intent(user_message)
            intent["intent"] = "arise_protocol"
            intent["confidence"] = 1.0
            intent["raw_message"] = user_message
            intent["timestamp"] = datetime.now(timezone.utc).isoformat()
            return intent
        conversational_phrases = {
            "hi", "hello", "hey", "hola", "can you hear me", "test", "testing",
            "how are you", "who are you", "what is your name", "yes", "no", "ok",
            "okay", "sure", "cancel", "stop", "good morning", "good afternoon",
            "good evening", "thank you", "thanks", "bye", "goodbye", "help"
        }
        action_keywords = {"open", "run", "start", "launch", "execute", "close", "kill", "system", "cmd", "powershell"}
        is_action = any(kw in msg_clean.split() for kw in action_keywords)
        if msg_clean in conversational_phrases or (len(msg_clean.split()) <= 2 and not is_action):
            logger.info("Intent extraction fast-path bypass triggered", message=user_message)
            intent = self._fallback_intent(user_message)
            intent["intent"] = "conversation"
            intent["confidence"] = 1.0
            intent["raw_message"] = user_message
            intent["timestamp"] = datetime.now(timezone.utc).isoformat()
            return intent

        history_str = ""
        if conversation_history:
            history_str = "\nRecent conversation context:\n" + "\n".join(
                f"{m['role'].upper()}: {m['content']}" for m in conversation_history[-3:]
            )

        prompt = f"""User message: "{user_message}"{history_str}

Extract the intent. Return ONLY the JSON object, no other text."""

        messages = [
            {"role": "system", "content": INTENT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        try:
            content = await llm_client.think(
                messages=messages,
                temperature=0.0,
                json_mode=True,
                agent_name="Intent",
                agent_desc="Intent Extractor"
            )
            intent = self._parse_intent(content)
        except Exception as e:
            logger.warning("Intent extraction failed, using fallback", error=str(e))
            intent = self._fallback_intent(user_message)

        intent["raw_message"] = user_message
        intent["timestamp"] = datetime.now(timezone.utc).isoformat()
        return intent

    def _parse_intent(self, text: str) -> dict:
        """Parse JSON from LLM response."""
        import re
        text = re.sub(r"```(?:json)?\n?", "", text).strip().rstrip("`").strip()
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass
        return self._fallback_intent(text)

    def _fallback_intent(self, message: str) -> dict:
        """Rule-based fallback when LLM fails."""
        message_lower = message.lower()
        intent_map = [
            (("explorer", "notepad", "notes", "terminal", "cmd", "command", "system", "app", "application", "calc", "calculator", "file", "folder"), "system_command"),
            (("schedule", "meeting", "appointment", "calendar", "book"), "schedule_event"),
            (("email", "send", "mail", "compose"), "send_email"),
            (("search", "find", "look up", "google", "what is"), "search_web"),
            (("call", "phone", "ring", "dial"), "make_call"),
            (("remind", "reminder", "alert"), "set_reminder"),
            (("browse", "open", "website", "url"), "browse_website"),
        ]
        detected_intent = "conversation"
        for keywords, intent_name in intent_map:
            if any(kw in message_lower for kw in keywords):
                detected_intent = intent_name
                break
        
        category = "conversation"
        requires_action = False
        if detected_intent == "system_command":
            category = "system"
            requires_action = True
        elif detected_intent != "conversation":
            category = "productivity"
            requires_action = True

        return {
            "intent": detected_intent,
            "confidence": 0.5,
            "entities": {},
            "priority": "medium",
            "category": category,
            "requires_action": requires_action,
            "sentiment": "neutral",
            "language": "en",
        }

    async def check_ollama(self) -> dict:
        """Check if Ollama is running and which models are available."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5)
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return {"available": True, "models": models}
        except Exception as e:
            return {"available": False, "error": str(e), "models": []}


# Singleton
intent_engine = IntentEngine()
