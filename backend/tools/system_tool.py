"""
Local System Tool — Execute local Powershell and Shell scripts cleanly.
"""
import asyncio
import os
import structlog
from typing import Optional

from backend.tools.base_tool import BaseTool, ToolResult
from backend.config.settings import settings

logger = structlog.get_logger(__name__)


class LocalSystemTool(BaseTool):
    name = "local_system"
    description = (
        "Execute local Powershell or CMD commands on the host machine. "
        "Use this for file operations, running scripts, or managing the OS."
    )
    requires_auth = False

    def is_configured(self) -> bool:
        # Always available on the local machine
        return True

    @staticmethod
    def _extract_url(command: str) -> Optional[str]:
        import re
        if not command:
            return None
        # 1. Explicit http:// or https:// URL anywhere in the command
        m = re.search(r'(https?://[^\s"\'<>]+)', command, re.IGNORECASE)
        if m:
            return m.group(1).rstrip('.,;"\')')
        # 2. Launch/browser command with a bare domain (e.g. 'start youtube.com', 'start chrome www.github.com')
        cmd_lower = command.lower()
        if any(k in cmd_lower for k in ("start ", "open ", "xdg-open", "chrome", "msedge", "firefox", "brave", "explorer")):
            dom = re.search(
                r'\b((?:www\.)?[a-zA-Z0-9-]+\.(?:com|org|net|io|ai|in|co|edu|gov|dev|app|tv|me)(?:/[^\s"\'<>]*)?)',
                command,
                re.IGNORECASE,
            )
            if dom:
                candidate = dom.group(1).rstrip('.,;"\')')
                if not candidate.lower().endswith((".exe", ".bat", ".cmd", ".ps1", ".py", ".sh")):
                    return f"https://{candidate}"
        return None

    @staticmethod
    async def _resolve_youtube_video_if_applicable(url: str) -> str:
        """If URL is a YouTube search query for a specific video, resolve the top video watch URL when possible."""
        import re
        import httpx
        if "youtube.com/results?search_query=" not in url:
            return url
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            }
            async with httpx.AsyncClient(timeout=3.0, headers=headers, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code == 200 and resp.text:
                    match = re.search(r'"videoId":"([a-zA-Z0-9_-]{11})"', resp.text)
                    if match:
                        video_id = match.group(1)
                        return f"https://www.youtube.com/watch?v={video_id}"
        except Exception as e:
            logger.debug("YouTube direct video resolution skipped, using search URL", error=str(e))
        return url

    async def _run(self, params: dict) -> ToolResult:
        command = params.get("command")
        timeout = params.get("timeout", 30)  # Default 30s timeout
        session_id = params.get("session_id")

        if not command:
            return ToolResult(success=False, error="No command provided.")

        # Detect if this command opens a website/URL and bridge it to the client browser via WebSocket
        target_url = self._extract_url(command)
        if target_url:
            target_url = await self._resolve_youtube_video_if_applicable(target_url)
            if session_id:
                from backend.core.message_bus import emit
                logger.info("Emitting open_url event to client browser", url=target_url, session_id=session_id)
                await emit(session_id, "open_url", url=target_url)

        if settings.HOSTED_MODE:
            if target_url:
                return ToolResult(
                    success=True,
                    data={
                        "command": command,
                        "opened_url": target_url,
                        "stdout": f"Successfully opened {target_url} in a new browser tab.",
                        "stderr": "",
                        "exit_code": 0,
                    },
                    metadata={"tool": self.name, "opened_in_client_browser": True},
                )
            logger.info("Hosted mode active: simulating command execution", command=command)
            cmd_lower = command.lower().strip()
            stdout_str = ""
            if cmd_lower in ["ls", "dir"]:
                stdout_str = (
                    "Directory: /home/sandbox/workspace\n\n"
                    "Mode                 LastWriteTime         Length Name\n"
                    "----                 -------------         ------ ----\n"
                    "d-----        13-06-2026     12:00                backend\n"
                    "d-----        13-06-2026     12:00                frontend\n"
                    "-a----        13-06-2026     12:00           1044 .env.example\n"
                    "-a----        13-06-2026     12:00           3926 README.md\n"
                )
            elif "whoami" in cmd_lower:
                stdout_str = "aura-os-cloud-sandbox"
            elif "git status" in cmd_lower:
                stdout_str = (
                    "On branch main\n"
                    "Your branch is up to date with 'origin/main'.\n\n"
                    "nothing to commit, working tree clean"
                )
            elif "python" in cmd_lower and "version" in cmd_lower:
                stdout_str = "Python 3.11.5"
            else:
                stdout_str = (
                    f"[SIMULATED CLOUD SANDBOX]\n"
                    f"Command: {command}\n"
                    f"Status: Safe execution complete (Hosted Mode)\n"
                    f"Reason: OS command invocation is sandboxed on public hosted environments for security."
                )
            return ToolResult(
                success=True,
                data={
                    "command": command,
                    "stdout": stdout_str.strip(),
                    "stderr": "",
                    "exit_code": 0
                },
                metadata={"tool": self.name, "simulated": True}
            )

        try:
            logger.info("Executing local command", command=command)
            
            # Use synchronous subprocess.run inside a background thread via asyncio.to_thread.
            # This completely bypasses Windows asyncio NotImplementedError/event-loop policy limits
            # under runners like Uvicorn, while keeping command execution non-blocking.
            def run_command_sync():
                import subprocess
                try:
                    res = subprocess.run(
                        command,
                        shell=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        errors="replace",
                        cwd=os.getcwd(),
                        timeout=timeout
                    )
                    return res.returncode, res.stdout, res.stderr, False
                except subprocess.TimeoutExpired:
                    return -1, "", "", True

            returncode, stdout_str, stderr_str, timed_out = await asyncio.to_thread(run_command_sync)

            if timed_out:
                return ToolResult(success=False, error=f"Command timed out after {timeout} seconds.")

            # Check exit code
            if returncode == 0:
                return ToolResult(
                    success=True,
                    data={
                        "command": command,
                        "stdout": stdout_str.strip(),
                        "stderr": stderr_str.strip(),
                        "exit_code": returncode
                    },
                    metadata={"tool": self.name}
                )
            else:
                return ToolResult(
                    success=False,
                    error=f"Command failed with exit code {returncode}:\n{stderr_str.strip() or stdout_str.strip()}",
                    data={"stdout": stdout_str.strip(), "stderr": stderr_str.strip()}
                )

        except Exception as e:
            import traceback
            traceback_str = traceback.format_exc()
            logger.error("LocalSystemTool Error", error=str(e), traceback=traceback_str)
            return ToolResult(success=False, error=f"Execution error: {str(e)}")
