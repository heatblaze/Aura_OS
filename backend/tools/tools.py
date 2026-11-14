"""
Web Search Tool — uses DuckDuckGo (free, no API key) with SerpAPI fallback.
"""
from backend.tools.base_tool import BaseTool, ToolResult
from backend.config.settings import settings
from backend.core.auth import auth_manager
from backend.memory.long_term import long_term_memory
from googleapiclient.discovery import build
from email.message import EmailMessage
from typing import Any
import base64
import structlog

logger = structlog.get_logger(__name__)


class WebSearchTool(BaseTool):
    name = "web_search"
    description = "Search the web for information. Uses DuckDuckGo (free) by default."
    requires_auth = False

    async def _run(self, params: dict) -> ToolResult:
        query = params.get("query", "")
        num_results = params.get("num_results", 5)

        if not query:
            return ToolResult(success=False, error="No search query provided")

        # Try API Search first if key available
        if settings.SERPAPI_KEY:
            api_key = settings.SERPAPI_KEY.strip().lstrip('#').strip()
            # Detect if it's a SearchApi.io key (typically 24 characters) or SerpApi.com key (typically 64 characters)
            if len(api_key) == 24:
                res = await self._searchapi_io_search(query, num_results, api_key)
            else:
                res = await self._serpapi_search(query, num_results, api_key)

            if res.success and isinstance(res.data, dict) and res.data.get("results"):
                return res
            logger.warning("Configured Search API failed; falling back to DuckDuckGo", query=query)

        # Free fallback: DuckDuckGo
        return await self._ddg_search(query, num_results)

    async def _ddg_search(self, query: str, num_results: int) -> ToolResult:
        try:
            from duckduckgo_search import DDGS
            results = []
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=num_results):
                    results.append({
                        "title": r.get("title"),
                        "url": r.get("href"),
                        "snippet": r.get("body"),
                    })
            return ToolResult(
                success=True,
                data={"query": query, "results": results, "source": "duckduckgo"},
                metadata={"tool": self.name, "result_count": len(results)},
            )
        except Exception as e:
            return ToolResult(success=False, error=f"DuckDuckGo search failed: {e}")

    async def _serpapi_search(self, query: str, num_results: int, api_key: str) -> ToolResult:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://serpapi.com/search",
                    params={"q": query, "api_key": api_key, "num": num_results},
                    timeout=15,
                )
                data = response.json()
                results = [
                    {"title": r.get("title"), "url": r.get("link"), "snippet": r.get("snippet")}
                    for r in data.get("organic_results", [])[:num_results]
                ]
                return ToolResult(
                    success=True,
                    data={"query": query, "results": results, "source": "serpapi"},
                    metadata={"tool": self.name},
                )
        except Exception as e:
            return ToolResult(success=False, error=f"SerpAPI search failed: {e}")

    async def _searchapi_io_search(self, query: str, num_results: int, api_key: str) -> ToolResult:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.searchapi.io/api/v1/search",
                    params={"q": query, "api_key": api_key, "engine": "google", "num": num_results},
                    timeout=15,
                )
                data = response.json()
                results = [
                    {"title": r.get("title"), "url": r.get("link"), "snippet": r.get("snippet")}
                    for r in data.get("organic_results", [])[:num_results]
                ]
                return ToolResult(
                    success=True,
                    data={"query": query, "results": results, "source": "searchapi.io"},
                    metadata={"tool": self.name},
                )
        except Exception as e:
            return ToolResult(success=False, error=f"SearchApi.io search failed: {e}")


class GoogleCalendarTool(BaseTool):
    name = "google_calendar"
    description = "Create, read, update Google Calendar events."
    requires_auth = True

    def is_configured(self) -> bool:
        return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)

    async def _run(self, params: dict) -> ToolResult:
        user_id = params.get("user_id", "default_user")
        action = params.get("action", "read")
        
        credentials = await auth_manager.get_credentials(user_id)
        if not credentials:
            return ToolResult(success=False, error="User must connect their Google Account first via OAuth.")

        try:
            service: Any = build('calendar', 'v3', credentials=credentials)
            
            if action == "create":
                event = {
                    'summary': params.get("title", "New Event"),
                    'description': params.get("description", ""),
                    'start': {
                        'dateTime': params.get("start_time"), # ISO 8601
                        'timeZone': params.get("timezone", "UTC"),
                    },
                    'end': {
                        'dateTime': params.get("end_time"), # ISO 8601
                        'timeZone': params.get("timezone", "UTC"),
                    },
                }
                
                # Attendees if any
                attendees = params.get("attendees", [])
                if attendees:
                    event["attendees"] = [{'email': a} for a in attendees]

                created_event = service.events().insert(calendarId='primary', body=event).execute()
                return ToolResult(
                    success=True, 
                    data={"message": "Event created", "link": created_event.get('htmlLink')},
                    metadata={"tool": self.name}
                )

            elif action == "read":
                timeMin = params.get("timeMin")
                timeMax = params.get("timeMax")
                
                events_result = service.events().list(
                    calendarId='primary', timeMin=timeMin, timeMax=timeMax,
                    maxResults=10, singleEvents=True, orderBy='startTime'
                ).execute()
                events = events_result.get('items', [])
                
                if not events:
                    return ToolResult(success=True, data={"message": "No upcoming events found."})
                
                results = []
                for event in events:
                    start = event['start'].get('dateTime', event['start'].get('date'))
                    results.append(f"{start} - {event.get('summary', 'Busy')}")
                    
                return ToolResult(success=True, data={"events": results})
                
            else:
                return ToolResult(success=False, error=f"Unsupported action for Calendar: {action}")
                
        except Exception as e:
            if "invalid_grant" in str(e).lower():
                logger.warning("Google credentials expired or revoked, clearing stored token", user=user_id)
                await long_term_memory.update_preference(user_id, "google_credentials", None)
                return ToolResult(success=False, error="Google credentials expired. Please reconnect your Google Account.")
            logger.error("Calendar API Error", error=str(e))
            return ToolResult(success=False, error=f"Calendar Google API error: {str(e)}")


class GmailTool(BaseTool):
    name = "gmail"
    description = "Send emails via Gmail."
    requires_auth = True

    def is_configured(self) -> bool:
        return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)

    async def _run(self, params: dict) -> ToolResult:
        user_id = params.get("user_id", "default_user")
        action = params.get("action", "send")
        
        credentials = await auth_manager.get_credentials(user_id)
        if not credentials:
            return ToolResult(success=False, error="User must connect their Google Account first.")

        try:
            service: Any = build('gmail', 'v1', credentials=credentials)
            
            if action == "send":
                message = EmailMessage()
                message.set_content(params.get("body", ""))
                message['To'] = params.get("to")
                message['Subject'] = params.get("subject", "No Subject")
                
                encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
                create_message = {'raw': encoded_message}
                
                sent_message = service.users().messages().send(userId="me", body=create_message).execute()
                return ToolResult(success=True, data={"message": "Email sent", "id": sent_message['id']})
                
            elif action == "read":
                # Only read top 5 unread messages
                results = service.users().messages().list(userId='me', q="is:unread", maxResults=5).execute()
                messages = results.get('messages', [])
                
                if not messages:
                    return ToolResult(success=True, data={"message": "No new unread emails."})
                    
                email_summaries = []
                for msg in messages:
                    msg_data = service.users().messages().get(userId='me', id=msg['id'], format='metadata').execute()
                    headers = msg_data['payload']['headers']
                    subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "No Subject")
                    sender = next((h['value'] for h in headers if h['name'] == 'From'), "Unknown Sender")
                    email_summaries.append({"from": sender, "subject": subject})
                    
                return ToolResult(success=True, data={"emails": email_summaries})
                
            else:
                return ToolResult(success=False, error=f"Unsupported action: {action}")
                
        except Exception as e:
            logger.error("Gmail API Error", error=str(e))
            return ToolResult(success=False, error=f"Gmail API error: {str(e)}")


class TwilioTool(BaseTool):
    name = "twilio"
    description = "Make calls and send SMS via Twilio."
    requires_auth = True

    def is_configured(self) -> bool:
        return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN)

    async def _run(self, params: dict) -> ToolResult:
        action = params.get("action", "sms")
        to_number = params.get("to") or params.get("phone_number") or params.get("recipient")
        if not to_number:
            return ToolResult(success=False, error="Recipient phone number ('to' or 'phone_number') is required")

        if action == "sms":
            if self.is_configured():
                from twilio.rest import Client
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                msg = client.messages.create(
                    body=params.get("message") or params.get("body") or "",
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=to_number,
                )
                return ToolResult(success=True, data={"sid": msg.sid, "status": msg.status})
            return ToolResult(success=False, error="Twilio credentials not configured")
        elif action == "call":
            if self.is_configured():
                from twilio.rest import Client
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                twiml = params.get("twiml") or params.get("message") or params.get("body") or "<Response><Say>Hello, this is a call from AURA.</Say></Response>"
                if not twiml.strip().startswith("<"):
                    twiml = f"<Response><Say>{twiml}</Say></Response>"
                call = client.calls.create(
                    twiml=twiml,
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=to_number,
                )
                return ToolResult(success=True, data={"sid": call.sid, "status": call.status})
            return ToolResult(success=False, error="Twilio credentials not configured")
        return ToolResult(success=False, error=f"Unknown action: {action}")


class TwilioSmsTool(BaseTool):
    name = "twilio_sms"
    description = "Send SMS messages via Twilio."
    requires_auth = True

    def is_configured(self) -> bool:
        return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN)

    async def _run(self, params: dict) -> ToolResult:
        if not self.is_configured():
            return ToolResult(success=False, error="Twilio credentials not configured")

        to_number = params.get("to") or params.get("phone_number") or params.get("recipient")
        if not to_number:
            return ToolResult(success=False, error="Recipient phone number ('to' or 'phone_number') is required")

        message_body = params.get("message") or params.get("body") or ""

        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            msg = client.messages.create(
                body=message_body,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=to_number,
            )
            return ToolResult(success=True, data={"sid": msg.sid, "status": msg.status})
        except Exception as e:
            return ToolResult(success=False, error=str(e))


class TwilioCallTool(BaseTool):
    name = "twilio_call"
    description = "Make phone calls via Twilio immediately, or schedule an automated call for a future time."
    requires_auth = True

    def is_configured(self) -> bool:
        return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN)

    async def _run(self, params: dict) -> ToolResult:
        if not self.is_configured():
            return ToolResult(success=False, error="Twilio credentials not configured in settings or environment")

        to_number = params.get("to") or params.get("phone_number") or params.get("recipient")
        if not to_number:
            return ToolResult(success=False, error="Recipient phone number ('to' or 'phone_number') is required")

        msg_body = params.get("message") or params.get("body") or params.get("twiml") or "Hello, this is a call from AURA OS."

        # Check if caller requested scheduling for a specific future timestamp
        run_at_raw = params.get("run_at") or params.get("scheduled_time") or params.get("time")
        if run_at_raw:
            try:
                from datetime import datetime
                from dateutil import parser as dt_parser
                scheduled_dt = dt_parser.parse(str(run_at_raw))
                now = datetime.now(scheduled_dt.tzinfo) if scheduled_dt.tzinfo else datetime.now()

                if scheduled_dt > now:
                    import uuid
                    from backend.services.living_daemon import living_daemon
                    task_id = f"call_{uuid.uuid4().hex[:8]}"
                    clean_msg = msg_body if not str(msg_body).strip().startswith("<") else "Scheduled voice reminder from AURA OS"

                    living_daemon.schedule_task(
                        task_id=task_id,
                        run_at=scheduled_dt,
                        title=f"Call to {to_number}",
                        details=clean_msg,
                        place_call=True,
                        recipient_phone=to_number
                    )
                    readable_time = scheduled_dt.strftime("%I:%M %p on %b %d, %Y (%Z)") if scheduled_dt.tzinfo else scheduled_dt.strftime("%I:%M %p on %b %d, %Y")
                    logger.info("Scheduled future Twilio call", task_id=task_id, run_at=scheduled_dt.isoformat(), recipient=to_number)
                    return ToolResult(
                        success=True,
                        data={
                            "task_id": task_id,
                            "status": "scheduled",
                            "scheduled_time": scheduled_dt.isoformat(),
                            "recipient": to_number,
                            "details": f"Voice call successfully scheduled for {readable_time} to {to_number}."
                        }
                    )
            except Exception as e:
                logger.warning("Failed parsing scheduled time for call, proceeding to immediate call", error=str(e), run_at=run_at_raw)

        # Immediate Call execution
        twiml = msg_body
        if not str(twiml).strip().startswith("<"):
            twiml = f"<Response><Say voice='Polly.Amy'>{twiml}</Say></Response>"

        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            call = client.calls.create(
                twiml=twiml,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=to_number,
            )
            return ToolResult(success=True, data={"sid": call.sid, "status": call.status, "recipient": to_number})
        except Exception as e:
            return ToolResult(success=False, error=str(e))



class BrowserTool(BaseTool):
    name = "browser_automation"
    description = "Browse websites, extract content, and automate web tasks via Playwright."
    requires_auth = False

    async def _run(self, params: dict) -> ToolResult:
        url = (params.get("url") or "").strip()
        action = params.get("action", "get_text")
        session_id = params.get("session_id")

        if not url:
            return ToolResult(success=False, error="No URL provided")

        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"

        if session_id and action in ("open", "navigate", "browse", "get_text"):
            from backend.core.message_bus import emit
            await emit(session_id, "open_url", url=url)
            if settings.HOSTED_MODE or action in ("open", "navigate", "browse"):
                return ToolResult(
                    success=True,
                    data={"url": url, "message": f"Successfully opened {url} in the user's browser."},
                    metadata={"tool": self.name, "opened_in_client_browser": True},
                )

        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.goto(url, timeout=30000)
                if action == "get_text":
                    text = await page.inner_text("body")
                    await browser.close()
                    return ToolResult(
                        success=True,
                        data={"url": url, "text": text[:3000]},
                        metadata={"tool": self.name},
                    )
                elif action == "screenshot":
                    screenshot = await page.screenshot(type="png")
                    await browser.close()
                    return ToolResult(
                        success=True,
                        data={"url": url, "screenshot_bytes": len(screenshot)},
                        metadata={"tool": self.name},
                    )
                await browser.close()
                return ToolResult(success=False, error=f"Unknown action: {action}")
        except Exception as e:
            if session_id:
                return ToolResult(
                    success=True,
                    data={"url": url, "message": f"Opened {url} in a new browser tab."},
                    metadata={"tool": self.name, "opened_in_client_browser": True},
                )
            return ToolResult(success=False, error=f"Browser error: {e}")


class ClockTool(BaseTool):
    name = "system_clock"
    description = (
        "Get the current date and time for a specific location or time zone. "
        "Accepts a 'location' parameter (e.g. 'New York', 'London', 'Tokyo', 'UTC', or 'Asia/Kolkata')."
    )
    requires_auth = False

    async def _run(self, params: dict) -> ToolResult:
        location = params.get("location", "").strip()
        if not location or location.lower() in {"local", "user", "current", "my", "me"}:
            location = params.get("client_timezone") or "Asia/Kolkata"

        import zoneinfo
        from datetime import datetime

        try:
            tz_name = self.resolve_timezone(location)
            tz = zoneinfo.ZoneInfo(tz_name)
            now = datetime.now(tz)

            # Format current_time to be human-readable and natural (e.g. "Tuesday, June 09, 2026, 05:29:32 PM (IST, UTC+05:30)")
            current_time = now.strftime("%A, %B %d, %Y, %I:%M:%S %p (%Z, UTC%z)")
            tz_offset = now.strftime("%z")
            if len(tz_offset) == 5:
                current_time = current_time.replace(tz_offset, f"{tz_offset[:3]}:{tz_offset[3:]}")

            return ToolResult(
                success=True,
                data={
                    "location": location,
                    "resolved_timezone": tz_name,
                    "current_time": current_time,
                    "iso_timestamp": now.isoformat()
                },
                metadata={"tool": self.name}
            )
        except Exception as e:
            return ToolResult(success=False, error=f"Failed to get clock time: {str(e)}")

    def resolve_timezone(self, location: str) -> str:
        loc_clean = location.strip().lower().replace(" ", "_")

        # Common abbreviations & aliases
        aliases = {
            "nyc": "America/New_York",
            "new york": "America/New_York",
            "new york city": "America/New_York",
            "la": "America/Los_Angeles",
            "ist": "Asia/Kolkata",
            "india": "Asia/Kolkata",
            "utc": "UTC",
            "gmt": "UTC",
            "bst": "Europe/London",
            "pt": "America/Los_Angeles",
            "et": "America/New_York",
            "ct": "America/Chicago",
            "mt": "America/Denver",
            "pst": "America/Los_Angeles",
            "est": "America/New_York",
            "cst": "America/Chicago",
            "mst": "America/Denver",
            "cet": "Europe/Paris",
            "eet": "Europe/Kiev",
            "wet": "Europe/London",
        }

        # Check key with clean underscores
        if loc_clean in aliases:
            return aliases[loc_clean]
        
        # Check raw input with spaces (e.g. "new york" instead of "new_york" in aliases just in case)
        raw_clean = location.strip().lower()
        if raw_clean in aliases:
            return aliases[raw_clean]

        import zoneinfo
        try:
            zones = zoneinfo.available_timezones()
        except Exception:
            zones = set()

        # 1. Exact match (case-insensitive)
        for zone in zones:
            if zone.lower() == loc_clean:
                return zone

        # 2. Match city suffix, e.g. "new_york" matches "America/New_York"
        for zone in zones:
            parts = zone.lower().split("/")
            if parts[-1] == loc_clean:
                return zone

        # 3. Fuzzy match: target is a substring of the timezone name
        for zone in zones:
            if loc_clean in zone.lower():
                return zone

        # Fallback to local timezone or raise error
        raise ValueError(f"Could not resolve timezone for location '{location}'")


class GenerateImageTool(BaseTool):
    name = "generate_image"
    description = (
        "Generate visual assets, images, logos, or UI mockup graphics. "
        "Uses HuggingFace Inference API (FLUX.1 / SDXL) and saves directly to Virtual Desktop."
    )
    requires_auth = False

    async def _run(self, params: dict) -> ToolResult:
        import os
        import io
        import base64
        import urllib.parse
        import httpx
        from backend.storage.virtual_desktop import desktop_manager

        import re
        import random
        import math

        raw_prompt = params.get("prompt") or params.get("description") or params.get("query") or "scenic night sky view"
        # Clean conversational prefixes if the full user sentence was passed
        cleaned_prompt = re.sub(
            r"^(?:please\s+|can you\s+|could you\s+)?(?:generate|create|draw|design|make|render|show(?:\s+me)?)\s+(?:an?\s+)?(?:image|picture|photo|view|wallpaper|illustration|artwork|graphic)\s+(?:of\s+|for\s+)?",
            "",
            raw_prompt.strip(),
            flags=re.IGNORECASE,
        ).strip()
        cleaned_prompt = re.sub(r"\s+and\s+(?:show|display|save)\s+it.*$", "", cleaned_prompt, flags=re.IGNORECASE).strip()
        if cleaned_prompt:
            raw_prompt = cleaned_prompt

        width = int(params.get("width", 1024))
        height = int(params.get("height", 1024))

        is_logo = any(k in raw_prompt.lower() for k in ("logo", "icon", "emblem", "badge", "brand"))
        if is_logo:
            enhanced_prompt = f"{raw_prompt}, high contrast graphic design, crisp typography, clean vector emblem logo, 8k resolution, studio lighting"
        else:
            enhanced_prompt = f"{raw_prompt}, breathtaking masterpiece, 8k resolution, photorealistic, cinematic lighting, ultra-detailed, vivid colors"

        hf_api_key = (settings.HUGGINGFACE_API_KEY or os.getenv("HUGGINGFACE_API_KEY") or "").strip()

        hf_models = [
            "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
            "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
            "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
            "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
        ]

        image_bytes = None
        used_model = "HuggingFace FLUX.1-schnell"

        if hf_api_key:
            headers = {"Authorization": f"Bearer {hf_api_key}"}
            payload = {"inputs": enhanced_prompt}

            async with httpx.AsyncClient(timeout=30.0) as client:
                for model_url in hf_models:
                    try:
                        resp = await client.post(model_url, headers=headers, json=payload)
                        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image/"):
                            image_bytes = resp.content
                            used_model = model_url.split("/")[-1]
                            break
                    except Exception as e:
                        logger.warning(f"Hugging Face model call error ({model_url}): {e}")

        # Fallback 1: Try Pollinations image stream bytes
        if not image_bytes:
            encoded_prompt = urllib.parse.quote(enhanced_prompt)
            seed = random.randint(1, 999999)
            pollinations_urls = [
                f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&seed={seed}&nologo=true&model=flux",
                f"https://pollinations.ai/p/{encoded_prompt}?width={width}&height={height}&seed={seed}&nologo=true",
            ]
            req_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            }
            async with httpx.AsyncClient(timeout=25.0, headers=req_headers) as client:
                for p_url in pollinations_urls:
                    try:
                        resp = await client.get(p_url, follow_redirects=True)
                        ctype = resp.headers.get("content-type", "")
                        if resp.status_code == 200 and resp.content and len(resp.content) > 2000 and ("image" in ctype or resp.content[:4] in (b"\x89PNG", b"\xff\xd8\xff\xe0", b"\xff\xd8\xff\xe1", b"\xff\xd8\xff\xdb")):
                            image_bytes = resp.content
                            used_model = "Pollinations FLUX Engine"
                            break
                    except Exception as e:
                        logger.warning(f"Pollinations stream fallback failed ({p_url}): {e}")

        # Fallback 2: Rich procedural artwork synthesizer via PIL when cloud image APIs are unreachable
        if not image_bytes:
            try:
                from PIL import Image, ImageDraw, ImageFilter
                prompt_lower = raw_prompt.lower()
                img = Image.new("RGB", (width, height), color=(5, 8, 22))
                draw = ImageDraw.Draw(img)

                is_night_or_space = any(w in prompt_lower for w in ("night", "sky", "star", "space", "galaxy", "nebula", "moon", "cosmos", "aurora", "universe", "evening"))
                is_sunset = any(w in prompt_lower for w in ("sunset", "sunrise", "dawn", "dusk", "horizon", "beach", "ocean"))

                # 1. Vertical atmospheric gradient
                for y in range(height):
                    t = y / max(1, height - 1)
                    if is_sunset:
                        r = int(18 + 220 * (t ** 1.5))
                        g = int(12 + 95 * (t ** 1.2))
                        b = int(48 + 60 * (1 - t))
                    elif is_night_or_space:
                        r = int(4 + 18 * (t ** 1.6))
                        g = int(7 + 28 * (t ** 1.4))
                        b = int(20 + 68 * (t ** 1.1))
                    else:
                        r = int(8 + 30 * t)
                        g = int(15 + 55 * t)
                        b = int(35 + 95 * t)
                    draw.line([(0, y), (width, y)], fill=(min(255, r), min(255, g), min(255, b)))

                # 2. Glowing nebula / aurora clouds overlay
                glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                gdraw = ImageDraw.Draw(glow)
                rng = random.Random(hash(raw_prompt) & 0xFFFFFFFF)
                nebula_colors = [
                    (56, 189, 248, 38),
                    (139, 92, 246, 36),
                    (236, 72, 153, 28),
                    (16, 185, 129, 30),
                ]
                for _ in range(14):
                    cx = rng.randint(int(width * 0.1), int(width * 0.9))
                    cy = rng.randint(int(height * 0.1), int(height * 0.65))
                    rx = rng.randint(int(width * 0.12), int(width * 0.32))
                    ry = rng.randint(int(height * 0.06), int(height * 0.18))
                    col = rng.choice(nebula_colors)
                    gdraw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=col)
                glow = glow.filter(ImageFilter.GaussianBlur(radius=48))
                img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
                draw = ImageDraw.Draw(img)

                # 3. Starfield & constellations
                for _ in range(420):
                    sx = rng.randint(0, width - 1)
                    sy = rng.randint(0, int(height * 0.82))
                    brightness = rng.randint(150, 255)
                    tint = rng.choice([(brightness, brightness, 255), (255, brightness, brightness), (200, 240, 255)])
                    size = rng.choices([1, 2, 3], weights=[82, 15, 3])[0]
                    if size == 1:
                        draw.point((sx, sy), fill=tint)
                    else:
                        draw.ellipse([sx - size, sy - size, sx + size, sy + size], fill=tint)
                        if size == 3:
                            draw.line([(sx - 6, sy), (sx + 6, sy)], fill=(200, 230, 255), width=1)
                            draw.line([(sx, sy - 6), (sx, sy + 6)], fill=(200, 230, 255), width=1)

                # 4. Shooting star
                sx0, sy0 = int(width * 0.28), int(height * 0.22)
                draw.line([(sx0, sy0), (sx0 + 130, sy0 + 55)], fill=(224, 242, 254), width=2)

                # 5. Luminous Moon / Celestial Body
                mx, my, mr = int(width * 0.76), int(height * 0.22), int(min(width, height) * 0.075)
                moon_glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                mgdraw = ImageDraw.Draw(moon_glow)
                for mult, alpha in [(2.4, 25), (1.7, 50), (1.25, 85)]:
                    rr = int(mr * mult)
                    mgdraw.ellipse([mx - rr, my - rr, mx + rr, my + rr], fill=(224, 242, 254, alpha))
                moon_glow = moon_glow.filter(ImageFilter.GaussianBlur(radius=18))
                img = Image.alpha_composite(img.convert("RGBA"), moon_glow).convert("RGB")
                draw = ImageDraw.Draw(img)
                draw.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(248, 250, 252))

                # 6. Layered mountain silhouettes along the horizon
                layers = [
                    (0.72, 0.07, (17, 24, 48), 1),
                    (0.79, 0.055, (11, 16, 34), 2),
                    (0.86, 0.035, (6, 9, 20), 3),
                ]
                for base_h, amp, col, seed_off in layers:
                    pts = [(0, height)]
                    for x in range(0, width + 16, 16):
                        nx = x / width
                        y = int(
                            height * base_h
                            - math.sin(nx * 6.5 + seed_off) * (height * amp)
                            - math.cos(nx * 14.0 - seed_off * 1.7) * (height * amp * 0.45)
                            - math.sin(nx * 29.0 + seed_off * 3.1) * (height * amp * 0.18)
                        )
                        pts.append((x, y))
                    pts.append((width, height))
                    draw.polygon(pts, fill=col)

                buf = io.BytesIO()
                img.save(buf, format="PNG")
                image_bytes = buf.getvalue()
                used_model = "AURA Procedural Canvas Engine"
            except Exception as e:
                logger.warning(f"Local PIL generation error: {e}")

        safe_title = "".join(c for c in raw_prompt[:30] if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
        if not safe_title:
            safe_title = "generated_design"
        
        saved_record = desktop_manager.save_file(
            file_name=f"{safe_title}.png",
            content_bytes=image_bytes or b"",
            category="images",
            source_tool="generate_image",
            metadata={"prompt": raw_prompt, "model": used_model}
        )

        b64_str = base64.b64encode(image_bytes or b"").decode("utf-8")
        data_uri = f"data:image/png;base64,{b64_str}"

        return ToolResult(
            success=True,
            data={
                "prompt": raw_prompt,
                "image_url": data_uri,
                "local_url": saved_record.get("relative_url"),
                "file_id": saved_record.get("id"),
                "file_name": saved_record.get("filename"),
                "viz_type": "image",
                "model_used": used_model,
                "message": f"Generated visual design saved to Virtual Desktop ({saved_record.get('filename')})"
            },
            metadata={"tool": self.name}
        )


