"""
Executor Agent — runs individual plan steps using the tool registry.
"""
import asyncio
import time
from backend.agents.base import BaseAgent
from backend.core.message_bus import emit


class ExecutorAgent(BaseAgent):
    name = "executor"
    description = "Executor — running action steps"

    async def process(self, context: dict, session_id: str) -> dict:
        await emit(session_id, "agent_start", agent=self.name, message="Executor Agent starting...")

        plan = context.get("plan", {})
        tool_registry = context.get("tool_registry")
        steps = plan.get("steps", [])

        results = []
        all_success = True

        # Separate parallel and sequential steps
        parallel_steps = [s for s in steps if s.get("can_parallel")]
        sequential_steps = [s for s in steps if not s.get("can_parallel")]

        # Run sequential steps
        completed_ids = set()
        user_id = context.get("user_id", "default_user")

        for step in sequential_steps:
            depends = step.get("depends_on", [])
            if not all(d in completed_ids for d in depends):
                continue  # skip if dependency not met (simplified)

            result = await self._execute_step(step, tool_registry, session_id, user_id)
            results.append(result)
            if result.get("success"):
                completed_ids.add(step["step_id"])
            else:
                all_success = False

        # Run parallel steps concurrently
        if parallel_steps:
            await emit(session_id, "executor_info", agent=self.name,
                       message=f"Running {len(parallel_steps)} steps in parallel")
            tasks = [self._execute_step(s, tool_registry, session_id, user_id) for s in parallel_steps]
            parallel_results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in parallel_results:
                if isinstance(r, Exception):
                    results.append({"success": False, "error": str(r)})
                    all_success = False
                else:
                    results.append(r)

        await emit(
            session_id,
            "execution_complete",
            agent=self.name,
            total_steps=len(steps),
            successful_steps=sum(1 for r in results if r.get("success")),
            all_success=all_success,
        )

        return {"results": results, "all_success": all_success, "total_steps": len(steps)}

    async def _execute_step(self, step: dict, tool_registry, session_id: str, user_id: str) -> dict:
        step_id = step.get("step_id")
        tool_name = step.get("tool")
        params = step.get("tool_params", {})
        params["user_id"] = user_id
        params["session_id"] = session_id
        
        # Inject client timezone if available
        from backend.memory.short_term import short_term_memory
        client_tz = await short_term_memory.get(session_id, "timezone")
        if client_tz:
            params["client_timezone"] = client_tz
            
        description = step.get("description", "")

        await emit(
            session_id,
            "step_start",
            agent=self.name,
            step_id=step_id,
            description=description,
            tool=tool_name,
        )

        start_time = time.monotonic()

        if tool_name is None:
            # No tool needed — informational step
            await emit(session_id, "step_complete", agent=self.name, step_id=step_id, success=True)
            return {"step_id": step_id, "success": True, "result": "No tool required", "description": description}

        if tool_registry is None:
            await emit(session_id, "step_complete", agent=self.name, step_id=step_id, success=False, error="No tool registry")
            return {"step_id": step_id, "success": False, "error": "Tool registry not available"}

        try:
            tool = tool_registry.get(tool_name)
            if tool is None:
                raise ValueError(f"Tool '{tool_name}' not found in registry")

            result = await tool.execute(params)
            elapsed_ms = (time.monotonic() - start_time) * 1000

            await emit(
                session_id,
                "step_complete",
                agent=self.name,
                step_id=step_id,
                tool=tool_name,
                success=True,
                elapsed_ms=round(elapsed_ms),
                result_preview=str(result.get("data", ""))[:200],
            )
            return {
                "step_id": step_id,
                "description": description,
                "tool": tool_name,
                "success": True,
                "result": result,
                "elapsed_ms": round(elapsed_ms),
            }

        except Exception as e:
            fallback = step.get("fallback", "No fallback defined")
            await emit(
                session_id,
                "step_failed",
                agent=self.name,
                step_id=step_id,
                tool=tool_name,
                error=str(e),
                fallback=fallback,
            )
            return {
                "step_id": step_id,
                "description": description,
                "tool": tool_name,
                "success": False,
                "error": str(e),
                "fallback": fallback,
            }
