"""
Long-Term Memory — PostgreSQL-backed user profile and preferences.
Stores behavioral patterns, user preferences, and action history.
"""
import json
from typing import Any, Optional
from datetime import datetime

import structlog

logger = structlog.get_logger(__name__)

# ── SQLAlchemy async setup ─────────────────────────────────────
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
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
            logger.info("LongTermMemory connected to PostgreSQL")
        except Exception as e:
            logger.warning("PostgreSQL unavailable, LTM disabled", error=str(e))
            self._available = False

    async def disconnect(self):
        if self._engine:
            await self._engine.dispose()

    # ── User profile ────────────────────────────────────────────

    async def get_or_create_profile(self, user_id: str) -> dict:
        if not self._available:
            return {"user_id": user_id, "preferences": {}}
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
