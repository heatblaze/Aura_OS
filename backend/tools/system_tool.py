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
