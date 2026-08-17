"""
Web Search Tool — uses DuckDuckGo (free, no API key) with SerpAPI fallback.
"""
from backend.tools.base_tool import BaseTool, ToolResult
from backend.config.settings import settings
from backend.core.auth import auth_manager
from googleapiclient.discovery import build
from email.message import EmailMessage
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
            service = build('calendar', 'v3', credentials=credentials)
            
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
            service = build('gmail', 'v1', credentials=credentials)
            
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
    description = "Make phone calls via Twilio."
    requires_auth = True

    def is_configured(self) -> bool:
        return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN)

    async def _run(self, params: dict) -> ToolResult:
        if not self.is_configured():
            return ToolResult(success=False, error="Twilio credentials not configured")

        to_number = params.get("to") or params.get("phone_number") or params.get("recipient")
        if not to_number:
            return ToolResult(success=False, error="Recipient phone number ('to' or 'phone_number') is required")

        twiml = params.get("twiml") or params.get("message") or params.get("body") or "<Response><Say>Hello, this is a call from AURA OS.</Say></Response>"

        # If it's a plain message (not XML), wrap it in Say TwiML
        if not twiml.strip().startswith("<"):
            twiml = f"<Response><Say>{twiml}</Say></Response>"

        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            call = client.calls.create(
                twiml=twiml,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=to_number,
            )
            return ToolResult(success=True, data={"sid": call.sid, "status": call.status})
        except Exception as e:
            return ToolResult(success=False, error=str(e))



class BrowserTool(BaseTool):
    name = "browser_automation"
    description = "Browse websites, extract content, and automate web tasks via Playwright."
    requires_auth = False

    async def _run(self, params: dict) -> ToolResult:
        url = params.get("url", "")
        action = params.get("action", "get_text")

        if not url:
            return ToolResult(success=False, error="No URL provided")

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
        "Uses free Pollinations AI FLUX engine by default."
    )
    requires_auth = False

    async def _run(self, params: dict) -> ToolResult:
        prompt = params.get("prompt") or params.get("description") or params.get("query") or "creative logo design"
        width = params.get("width", 1024)
        height = params.get("height", 1024)

        import urllib.parse
        encoded = urllib.parse.quote(prompt)

        # Free, instant Pollinations FLUX image generation endpoint (requires no API key)
        image_url = f"https://image.pollinations.ai/prompt/{encoded}?width={width}&height={height}&nologo=true"

        return ToolResult(
            success=True,
            data={
                "prompt": prompt,
                "image_url": image_url,
                "viz_type": "image",
                "message": f"Generated visual design for: '{prompt}'"
            },
            metadata={"tool": self.name}
        )
