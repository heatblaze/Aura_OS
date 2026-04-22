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
            
            # Using asyncio.create_subprocess_shell to run the command asynchronously
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=os.getcwd()  # Usually the project root
            )

            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
                
                stdout_str = stdout.decode("utf-8", errors="replace").strip()
                stderr_str = stderr.decode("utf-8", errors="replace").strip()
                
                # Check exit code
                if process.returncode == 0:
                    return ToolResult(
                        success=True,
                        data={
                            "command": command,
                            "stdout": stdout_str,
                            "stderr": stderr_str,
                            "exit_code": process.returncode
                        },
                        metadata={"tool": self.name}
                    )
                else:
                    return ToolResult(
                        success=False,
                        error=f"Command failed with exit code {process.returncode}:\n{stderr_str or stdout_str}",
                        data={"stdout": stdout_str, "stderr": stderr_str}
                    )
                    
            except asyncio.TimeoutError:
                process.kill()
                return ToolResult(success=False, error=f"Command timed out after {timeout} seconds.")

        except Exception as e:
            logger.error("LocalSystemTool Error", error=str(e))
            return ToolResult(success=False, error=f"Execution error: {str(e)}")
