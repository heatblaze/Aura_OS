"""
OAuth Strategy and Token Management for JARVIS.
Currently supports Google Workspace integrations.
"""
import json
import structlog
from typing import Optional
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from backend.config.settings import settings
from backend.memory.long_term import long_term_memory

logger = structlog.get_logger(__name__)

# Scopes needed for Calendar and Gmail
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
]

class AuthManager:
    def __init__(self):
        self._init_flow()

    def _init_flow(self):
        if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
            client_config = {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "project_id": "jarvis-ai-os",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
                }
            }
            self.flow = Flow.from_client_config(
                client_config,
                scopes=SCOPES,
                redirect_uri=settings.GOOGLE_REDIRECT_URI
            )
        else:
            self.flow = None

    def get_authorization_url(self, user_id: str) -> tuple[Optional[str], str]:
        if not self.flow:
            return None, "Google Client ID/Secret not configured in .env"
        
        auth_url, state = self.flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=user_id # We pass user_id as state so we know who authorized on callback
        )
        return auth_url, state

    async def handle_callback(self, code: str, user_id: str) -> bool:
        if not self.flow:
            return False
            
        try:
            self.flow.fetch_token(code=code)
            credentials = self.flow.credentials
            
            # Convert credentials to dict
            creds_data = {
                'token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'scopes': credentials.scopes
            }
            
            # Save to long term memory under user preferences
            await long_term_memory.update_preference(user_id, "google_credentials", creds_data)
            logger.info("Successfully fetched and saved Google credentials", user=user_id)
            return True
        except Exception as e:
            logger.error("Failed to fetch Google token", error=str(e))
            return False

    async def get_credentials(self, user_id: str) -> Optional[Credentials]:
        """Retrieve actual Google Credentials object for the user."""
        profile = await long_term_memory.get_or_create_profile(user_id)
        creds_data = profile.get("preferences", {}).get("google_credentials")
        
        if not creds_data:
            return None
            
        try:
            return Credentials(**creds_data)
        except Exception as e:
            logger.error("Failed to reconstruct credentials", error=str(e))
            return None

# Singleton instance
auth_manager = AuthManager()
