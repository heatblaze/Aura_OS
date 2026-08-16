"""
KRONOS Learned Experience Compiler — Background Memory Consolidator
Periodically scans action logs and consolidates successes and failures
into a persistent markdown brain node so the LLM continuously learns from experience.
"""
import asyncio
from datetime import datetime
from typing import Optional
import structlog

from backend.agents.base import BaseAgent
from backend.memory.long_term import long_term_memory
from backend.memory.markdown_brain import markdown_brain

logger = structlog.get_logger(__name__)

LEARNED_EXPERIENCE_PROMPT = """
You are the KRONOS Experience Compiler for Aura OS.
Your task is to review the recent action logs from the operator's interactions and compile a list of Wins (successful operations) and Failures (errored or timed-out operations).

Recent Actions:
{actions}

Review the actions. Merge duplicate operations, summarize what succeeded and what failed, and draft a clean, high-impact markdown summary.
Include:
1. A brief summary of AURA's recent state.
2. A ## Successes (Wins) section listing actions that succeeded with a short 1-sentence takeaway.
3. A ## Failures (Learnings) section listing actions that failed, explaining why they failed and a short recommendation on how to avoid it next time.

Respond ONLY with the complete markdown document. Do not include markdown code block fences (like ```markdown) or introductory text. Start directly with the title: '# KRONOS Learned Experience'.
"""

class LearnedExperienceCompiler(BaseAgent):
    name = "experience_compiler"
    description = "KRONOS Memory Compiler"

    def __init__(self):
        super().__init__()
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def process(self, context: dict, session_id: str) -> dict:
        """Required by abstract base class."""
        return {}

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="experience_compiler_loop")
        logger.info("KRONOS Learned Experience Compiler active")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("KRONOS Experience Compiler stopped")

    async def _loop(self):
        # Wait a minute after startup before first compilation to accumulate logs
        await asyncio.sleep(60)
        while self._running:
            try:
                await self.compile_experiences()
            except Exception as e:
                logger.error("Failed KRONOS memory compilation", error=str(e))
            # Compile memory every 5 minutes (300 seconds)
            await asyncio.sleep(300)

    async def compile_experiences(self):
        # 1. Fetch recent actions from PostgreSQL LTM
        recent = await long_term_memory.get_recent_actions(user_id="default_user", limit=15)
        
        if not recent:
            # Skip background compilation when no action logs exist to conserve Groq API tokens
            logger.debug("Skipping KRONOS memory compilation — no action logs found.")
            return
            
        # 2. Format actions
        actions_str = ""
        for i, a in enumerate(recent, 1):
            status = "Success" if a["success"] else "FAILED"
            tool = a["tool_used"] or "None"
            actions_str += f"{i}. [{a['created_at']}] Intent: '{a['intent']}' | Tool: {tool} | Status: {status}\n"
            
        # 3. Request synthesis from Ollama LLM
        prompt = LEARNED_EXPERIENCE_PROMPT.format(actions=actions_str)
        sys_prompt = "You are the KRONOS Experience Compiler. Always return clean, well-formatted markdown memory nodes."
        
        compiled_markdown = await self.think(prompt, sys_prompt, expect_json=False)
        
        if compiled_markdown and "# KRONOS" in compiled_markdown:
            # Write/overwrite learned_experience.md node in brain folder
            markdown_brain.write_file("learned_experience", compiled_markdown)
            logger.info("KRONOS persistent memory network updated.")
        else:
            logger.warning("KRONOS memory compilation rejected due to invalid LLM output format")

experience_compiler = LearnedExperienceCompiler()
