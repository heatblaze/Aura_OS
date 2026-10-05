import os
import sys
import time
import asyncio
import structlog
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from backend.config.settings import settings

logger = structlog.get_logger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "scheduled_tasks.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

jobstores = {
    'default': SQLAlchemyJobStore(url=f'sqlite:///{DB_PATH}')
}

job_defaults = {
    'coalesce': True,
    'max_instances': 3,
    'misfire_grace_time': 3600 * 24  # Catch up within 24 hours if system was off!
}

class LivingSystemDaemon:
    """
    AURA OS Living System Daemon.
    Persists scheduled tasks & meetings to SQLite disk.
    Executes tasks even when app UI is closed, and places automated phone calls
    to remind and converse with the user for scheduled events/meetings.
    """

    def __init__(self):
        self.scheduler = AsyncIOScheduler(jobstores=jobstores, job_defaults=job_defaults)
        self.is_running = False

    def start(self):
        if not self.is_running:
            self.scheduler.start()
            self.is_running = True
            logger.info("LivingSystemDaemon active with SQLite JobStore", db_path=DB_PATH)

    def stop(self):
        if self.is_running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False
            logger.info("LivingSystemDaemon stopped")

    async def trigger_phone_call_reminder(self, task_title: str, task_details: str, recipient_phone: Optional[str] = None):
        """Place an automated voice call via Twilio to remind the user about the task."""
        to_number = recipient_phone or os.getenv("MY_PHONE_NUMBER") or os.getenv("TWILIO_PHONE_NUMBER")
        
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.warning("Twilio credentials missing. Cannot place voice call reminder.", task=task_title)
            return False

        if not to_number:
            logger.warning("No recipient phone number configured for voice call reminder.")
            return False

        twiml_speech = (
            f"<Response>"
            f"<Say voice='Polly.Amy'>Hello! This is AURA OS with your scheduled reminder. "
            f"Event title: {task_title}. Details: {task_details}. "
            f"Please check your Virtual Desktop for any attached files.</Say>"
            f"<Gather input='speech' timeout='5' action='/api/telephony/voice-respond'>"
            f"<Say voice='Polly.Amy'>Do you have any questions or directives for me?</Say>"
            f"</Gather>"
            f"</Response>"
        )

        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            call = client.calls.create(
                twiml=twiml_speech,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=to_number
            )
            logger.info("Twilio voice call dispatched successfully", call_sid=call.sid, to=to_number)
            return True
        except Exception as e:
            logger.error("Failed to place Twilio voice call", error=str(e))
            return False

    def schedule_task(self, task_id: str, run_at: datetime, title: str, details: str, place_call: bool = True, recipient_phone: Optional[str] = None):
        """Schedule a persistent task to execute at run_at timestamp."""
        self.scheduler.add_job(
            execute_scheduled_living_task,
            'date',
            run_date=run_at,
            args=[task_id, title, details, place_call, recipient_phone],
            id=task_id,
            replace_existing=True
        )
        logger.info("Scheduled living task", task_id=task_id, run_at=run_at.isoformat(), title=title, recipient=recipient_phone)


# Top-level execution wrapper picklable by SQLAlchemyJobStore
def execute_scheduled_living_task(task_id: str, title: str, details: str, place_call: bool = True, recipient_phone: Optional[str] = None):
    logger.info(f"[LivingSystemDaemon] Executing scheduled task: {title}", task_id=task_id, recipient=recipient_phone)
    if place_call:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(living_daemon.trigger_phone_call_reminder(title, details, recipient_phone=recipient_phone))
            else:
                loop.run_until_complete(living_daemon.trigger_phone_call_reminder(title, details, recipient_phone=recipient_phone))
        except RuntimeError:
            asyncio.run(living_daemon.trigger_phone_call_reminder(title, details, recipient_phone=recipient_phone))


# Singleton instance
living_daemon = LivingSystemDaemon()

