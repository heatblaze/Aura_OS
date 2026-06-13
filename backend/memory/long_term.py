"""
Long-Term Memory — PostgreSQL-backed user profile and preferences.
Stores behavioral patterns, user preferences, and action history.
"""
import json
import os
from typing import Any, Optional
from datetime import datetime

import aiofiles
import structlog

logger = structlog.get_logger(__name__)

# ── SQLAlchemy async setup ─────────────────────────────────────
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
try:
    from sqlalchemy.ext.asyncio import async_sessionmaker
except ImportError:
    from sqlalchemy.orm import sessionmaker
    def async_sessionmaker(bind, **kwargs):
        return sessionmaker(bind, class_=AsyncSession, **kwargs)

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, DateTime, JSON, Integer, Float, select, update
from sqlalchemy.sql import func

from backend.config.settings import settings


class Base(DeclarativeBase):
    pass


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(256))
    email: Mapped[Optional[str]] = mapped_column(String(256))
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class ActionLog(Base):
    __tablename__ = "action_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    intent: Mapped[str] = mapped_column(String(256))
    tool_used: Mapped[Optional[str]] = mapped_column(String(128))
    success: Mapped[bool] = mapped_column(default=True)
    execution_time_ms: Mapped[Optional[float]] = mapped_column(Float)
    action_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class LearntPattern(Base):
    __tablename__ = "learnt_patterns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    pattern_type: Mapped[str] = mapped_column(String(128))  # "preference", "routine", "correction"
    pattern_key: Mapped[str] = mapped_column(String(256))
    pattern_value: Mapped[dict] = mapped_column(JSON)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    occurrences: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


# ── LongTermMemory class ───────────────────────────────────────

class LongTermMemory:
    def __init__(self):
        self._engine = None
        self._session_factory = None
        self._available = False
        self._use_json_fallback = False
        self._fallback_path = None

    async def connect(self):
        try:
            self._engine = create_async_engine(
                settings.POSTGRES_URL,
                echo=False,
                pool_size=5,
                max_overflow=10,
            )
            self._session_factory = async_sessionmaker(
                self._engine, class_=AsyncSession, expire_on_commit=False
            )
            # Create tables if they don't exist
            async with self._engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            self._available = True
            self._use_json_fallback = False
            logger.info("LongTermMemory connected to PostgreSQL")
            # Auto-migrate any profiles (Google OAuth credentials) from local JSON fallback if present
            await self._migrate_fallback_to_postgres()
        except Exception as e:
            logger.warning("PostgreSQL unavailable, using local JSON file database fallback for LTM", error=str(e))
            self._available = True  # Set available to True so other components don't bypass operations
            self._use_json_fallback = True
            self._fallback_path = os.path.join("backend", "brain", "jarvis_ltm.json")
            # Ensure folder exists
            os.makedirs(os.path.dirname(self._fallback_path), exist_ok=True)
            if not os.path.exists(self._fallback_path):
                try:
                    async with aiofiles.open(self._fallback_path, "w", encoding="utf-8") as f:
                        await f.write(json.dumps({
                            "user_profiles": {},
                            "action_logs": [],
                            "learnt_patterns": []
                        }, indent=2))
                except Exception as write_err:
                    logger.error("Failed to initialize JSON fallback file", error=str(write_err))

    async def _migrate_fallback_to_postgres(self):
        fallback_path = os.path.join("backend", "brain", "jarvis_ltm.json")
        if not os.path.exists(fallback_path):
            return
        
        try:
            async with aiofiles.open(fallback_path, "r", encoding="utf-8") as f:
                content = await f.read()
                data = json.loads(content)
            
            profiles = data.get("user_profiles", {})
            if not profiles:
                return
                
            logger.info("Checking JSON fallback for credentials migration to PostgreSQL...", profile_count=len(profiles))
            async with self._session_factory() as session:
                for user_id, profile_dict in profiles.items():
                    # Check if user already exists in PostgreSQL
                    result = await session.execute(
                        select(UserProfile).where(UserProfile.user_id == user_id)
                    )
                    existing = result.scalar_one_or_none()
                    if not existing:
                        logger.info("Migrating profile from JSON fallback to PostgreSQL", user_id=user_id)
                        new_profile = UserProfile(
                            user_id=user_id,
                            name=profile_dict.get("name"),
                            email=profile_dict.get("email"),
                            preferences=profile_dict.get("preferences", {})
                        )
                        session.add(new_profile)
                    else:
                        # If profile exists, check if google_credentials need merging/saving
                        postgres_prefs = existing.preferences or {}
                        json_prefs = profile_dict.get("preferences", {})
                        if "google_credentials" in json_prefs and "google_credentials" not in postgres_prefs:
                            logger.info("Merging Google credentials from JSON fallback to PostgreSQL", user_id=user_id)
                            postgres_prefs["google_credentials"] = json_prefs["google_credentials"]
                            existing.preferences = postgres_prefs
                            session.add(existing)
                            
                await session.commit()
        except Exception as e:
            logger.error("Error migrating fallback JSON to PostgreSQL", error=str(e))

    async def disconnect(self):
        if self._engine:
            await self._engine.dispose()

    async def _read_fallback(self) -> dict:
        try:
            if not os.path.exists(self._fallback_path):
                return {"user_profiles": {}, "action_logs": [], "learnt_patterns": []}
            async with aiofiles.open(self._fallback_path, "r", encoding="utf-8") as f:
                content = await f.read()
                return json.loads(content)
        except Exception as e:
            logger.error("Failed to read JSON fallback file", error=str(e))
            return {"user_profiles": {}, "action_logs": [], "learnt_patterns": []}

    async def _write_fallback(self, data: dict):
        try:
            async with aiofiles.open(self._fallback_path, "w", encoding="utf-8") as f:
                await f.write(json.dumps(data, indent=2))
        except Exception as e:
            logger.error("Failed to write to LTM JSON fallback", error=str(e))

    # ── User profile ────────────────────────────────────────────

    async def get_or_create_profile(self, user_id: str) -> dict:
        if not self._available:
            return {"user_id": user_id, "preferences": {}}
        
        if self._use_json_fallback:
            data = await self._read_fallback()
            profiles = data.get("user_profiles", {})
            if user_id not in profiles:
                profiles[user_id] = {
                    "user_id": user_id,
                    "name": None,
                    "email": None,
                    "preferences": {}
                }
                data["user_profiles"] = profiles
                await self._write_fallback(data)
            return profiles[user_id]

        async with self._session_factory() as session:
            result = await session.execute(
                select(UserProfile).where(UserProfile.user_id == user_id)
            )
            profile = result.scalar_one_or_none()
            if profile is None:
                profile = UserProfile(user_id=user_id, preferences={})
                session.add(profile)
                await session.commit()
                await session.refresh(profile)
            return {
                "user_id": profile.user_id,
                "name": profile.name,
                "email": profile.email,
                "preferences": profile.preferences or {},
            }

    async def update_preference(self, user_id: str, key: str, value: Any):
        if not self._available:
            return
        
        if self._use_json_fallback:
            data = await self._read_fallback()
            profiles = data.get("user_profiles", {})
            if user_id not in profiles:
                profiles[user_id] = {
                    "user_id": user_id,
                    "name": None,
                    "email": None,
                    "preferences": {}
                }
            prefs = dict(profiles[user_id].get("preferences") or {})
            prefs[key] = value
            profiles[user_id]["preferences"] = prefs
            data["user_profiles"] = profiles
            await self._write_fallback(data)
            return

        async with self._session_factory() as session:
            result = await session.execute(
                select(UserProfile).where(UserProfile.user_id == user_id)
            )
            profile = result.scalar_one_or_none()
            if profile:
                prefs = dict(profile.preferences or {})
                prefs[key] = value
                profile.preferences = prefs
                await session.commit()

    # ── Action logging ──────────────────────────────────────────

    async def log_action(
        self,
        session_id: str,
        user_id: str,
        intent: str,
        tool_used: Optional[str] = None,
        success: bool = True,
        execution_time_ms: Optional[float] = None,
        metadata: Optional[dict] = None,
    ):
        if not self._available:
            return
        
        if self._use_json_fallback:
            data = await self._read_fallback()
            logs = data.get("action_logs", [])
            logs.append({
                "session_id": session_id,
                "user_id": user_id,
                "intent": intent,
                "tool_used": tool_used,
                "success": success,
                "execution_time_ms": execution_time_ms,
                "action_metadata": metadata or {},
                "created_at": datetime.utcnow().isoformat()
            })
            if len(logs) > 100:
                logs = logs[-100:]
            data["action_logs"] = logs
            await self._write_fallback(data)
            return

        async with self._session_factory() as session:
            log = ActionLog(
                session_id=session_id,
                user_id=user_id,
                intent=intent,
                tool_used=tool_used,
                success=success,
                execution_time_ms=execution_time_ms,
                action_metadata=metadata or {},
            )
            session.add(log)
            await session.commit()

    async def get_recent_actions(self, user_id: str, limit: int = 20) -> list[dict]:
        if not self._available:
            return []
        
        if self._use_json_fallback:
            data = await self._read_fallback()
            logs = data.get("action_logs", [])
            user_logs = [l for l in logs if l.get("user_id") == user_id]
            user_logs.reverse()
            return [
                {
                    "intent": l["intent"],
                    "tool_used": l["tool_used"],
                    "success": l["success"],
                    "created_at": l["created_at"],
                }
                for l in user_logs[:limit]
            ]

        async with self._session_factory() as session:
            result = await session.execute(
                select(ActionLog)
                .where(ActionLog.user_id == user_id)
                .order_by(ActionLog.created_at.desc())
                .limit(limit)
            )
            logs = result.scalars().all()
            return [
                {
                    "intent": l.intent,
                    "tool_used": l.tool_used,
                    "success": l.success,
                    "created_at": l.created_at.isoformat(),
                }
                for l in logs
            ]

    # ── Pattern learning ────────────────────────────────────────

    async def record_pattern(self, user_id: str, pattern_type: str, key: str, value: dict):
        if not self._available:
            return
        
        if self._use_json_fallback:
            data = await self._read_fallback()
            patterns = data.get("learnt_patterns", [])
            found = False
            for p in patterns:
                if p.get("user_id") == user_id and p.get("pattern_key") == key:
                    p["occurrences"] = p.get("occurrences", 1) + 1
                    p["confidence"] = min(1.0, p.get("confidence", 0.5) + 0.05)
                    p["pattern_value"] = value
                    found = True
                    break
            if not found:
                patterns.append({
                    "user_id": user_id,
                    "pattern_type": pattern_type,
                    "pattern_key": key,
                    "pattern_value": value,
                    "confidence": 0.5,
                    "occurrences": 1,
                    "created_at": datetime.utcnow().isoformat()
                })
            data["learnt_patterns"] = patterns
            await self._write_fallback(data)
            return

        async with self._session_factory() as session:
            result = await session.execute(
                select(LearntPattern).where(
                    LearntPattern.user_id == user_id,
                    LearntPattern.pattern_key == key,
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.occurrences += 1
                existing.confidence = min(1.0, existing.confidence + 0.05)
                existing.pattern_value = value
            else:
                pattern = LearntPattern(
                    user_id=user_id,
                    pattern_type=pattern_type,
                    pattern_key=key,
                    pattern_value=value,
                )
                session.add(pattern)
            await session.commit()

    async def get_patterns(self, user_id: str, pattern_type: Optional[str] = None) -> list[dict]:
        if not self._available:
            return []
        
        if self._use_json_fallback:
            data = await self._read_fallback()
            patterns = data.get("learnt_patterns", [])
            filtered = [p for p in patterns if p.get("user_id") == user_id]
            if pattern_type:
                filtered = [p for p in filtered if p.get("pattern_type") == pattern_type]
            filtered.sort(key=lambda x: x.get("confidence", 0.5), reverse=True)
            return [
                {
                    "type": p["pattern_type"],
                    "key": p["pattern_key"],
                    "value": p["pattern_value"],
                    "confidence": p["confidence"],
                    "occurrences": p["occurrences"],
                }
                for p in filtered
            ]

        async with self._session_factory() as session:
            query = select(LearntPattern).where(LearntPattern.user_id == user_id)
            if pattern_type:
                query = query.where(LearntPattern.pattern_type == pattern_type)
            result = await session.execute(query.order_by(LearntPattern.confidence.desc()))
            patterns = result.scalars().all()
            return [
                {
                    "type": p.pattern_type,
                    "key": p.pattern_key,
                    "value": p.pattern_value,
                    "confidence": p.confidence,
                    "occurrences": p.occurrences,
                }
                for p in patterns
            ]


# Singleton
long_term_memory = LongTermMemory()
