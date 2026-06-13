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

    async def _run(self, params: dict) -> ToolResult:
        command = params.get("command")
        timeout = params.get("timeout", 30)  # Default 30s timeout

        if not command:
            return ToolResult(success=False, error="No command provided.")

        if settings.HOSTED_MODE:
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
