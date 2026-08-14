from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Jarvis AI OS"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Ollama (free local LLM)
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "phi3:mini"           # ~2.3GB RAM — good for 12GB systems
    OLLAMA_FALLBACK_MODEL: str = "llama3.2:3b" # Alternative if phi3 not installed
    OLLAMA_TIMEOUT: int = 120                  # seconds

    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_SESSION_TTL: int = 3600              # 1 hour

    # PostgreSQL
    POSTGRES_URL: str = "postgresql+asyncpg://jarvis:jarvis_pass@localhost:5432/jarvis_db"

    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_COLLECTION: str = "jarvis_memory"

    # Google APIs (optional — Phase 2)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"

    # Twilio (optional — Phase 2)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None

    # SerpAPI for web search (optional, falls back to DuckDuckGo)
    SERPAPI_KEY: Optional[str] = None

    # ElevenLabs (optional Text-to-Speech integration)
    ELEVENLABS_API_KEY: Optional[str] = None
    ELEVENLABS_VOICE_ID: Optional[str] = "21m00Tcm4TlvDq8ikWAM" # Default: Rachel

    # Deepgram (optional Text-to-Speech integration)
    DEEPGRAM_API_KEY: Optional[str] = None

    # TTS Settings
    TTS_PROVIDER: str = "edge-tts" # "edge-tts" (free neural), "elevenlabs" (paid premium), "deepgram" (paid premium)
    EDGE_TTS_VOICE: str = "en-US-AvaNeural" # Default high quality free voice
    TTS_SPEED: str = "+22%"                  # Speed of Edge-TTS voice (e.g. "+10%" or "-10%")


    # Groq Cloud LLM (optional)
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: Optional[str] = "openai/gpt-oss-20b"
    LLM_PROVIDER: str = "groq" # "groq" to use Groq API, "ollama" to force local Qwen 2.5

    # NVIDIA Cloud LLM (optional fallback)
    NVIDIA_API_KEY: Optional[str] = None

    # Security
    SECRET_KEY: str = "change-me-in-production-please"
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://aura-os-cyan-ten.vercel.app"
    ]
    HOSTED_MODE: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
