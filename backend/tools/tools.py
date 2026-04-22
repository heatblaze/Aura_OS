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

        # Try SerpAPI first if key available
        if settings.SERPAPI_KEY:
            return await self._serpapi_search(query, num_results)

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

    async def _serpapi_search(self, query: str, num_results: int) -> ToolResult:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://serpapi.com/search",
                    params={"q": query, "api_key": settings.SERPAPI_KEY, "num": num_results},
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
        if action == "sms":
            if self.is_configured():
                from twilio.rest import Client
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                msg = client.messages.create(
                    body=params.get("message", ""),
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=params.get("to", ""),
                )
                return ToolResult(success=True, data={"sid": msg.sid, "status": msg.status})
            return ToolResult(success=False, error="Twilio credentials not configured")
        return ToolResult(success=False, error=f"Unknown action: {action}")


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
