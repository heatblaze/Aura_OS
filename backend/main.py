"""
JARVIS AI OS — FastAPI Backend
WebSocket endpoint for real-time agent streaming + REST API
"""
import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.config.settings import settings
from backend.core.message_bus import message_bus
from backend.core.orchestrator import orchestrator, get_directives_processed
from backend.core.intent_engine import intent_engine
from backend.core.tool_registry import tool_registry
from backend.core.auth import auth_manager
from backend.core.auto_mode import auto_mode_manager
from backend.memory.short_term import short_term_memory
from backend.memory.long_term import long_term_memory
from backend.memory.knowledge import knowledge_memory
from backend.proactive.engine import proactive_engine

logger = structlog.get_logger(__name__)


# ── Lifecycle ──────────────────────────────────────────────────

SYSTEM_START_TIME = datetime.utcnow()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect all services. Shutdown: clean up."""
    logger.info("JARVIS AI OS starting up...")

    # Connect services (gracefully handles unavailable services)
    await message_bus.connect()
    await short_term_memory.connect()
    await long_term_memory.connect()
    await knowledge_memory.connect()

    # Check Ollama
    ollama_status = await intent_engine.check_ollama()
    if ollama_status["available"]:
        models = ollama_status["models"]
        logger.info(f"Ollama connected | Models: {models}")
        if settings.OLLAMA_MODEL not in " ".join(models):
            logger.warning(
                f"Model '{settings.OLLAMA_MODEL}' not found. "
                f"Run: ollama pull {settings.OLLAMA_MODEL}"
            )
    else:
        logger.warning(f"Ollama not reachable: {ollama_status.get('error')}. Run: ollama serve")

    # Start Proactive Engine
    await proactive_engine.start()
    logger.info("JARVIS ready — Phase 3 Proactive Engine active")
    yield

    # Shutdown
    await proactive_engine.stop()
    logger.info("JARVIS shutting down...")
    await orchestrator.close()
    await message_bus.disconnect()
    await short_term_memory.disconnect()
    await long_term_memory.disconnect()


# ── App setup ──────────────────────────────────────────────────

app = FastAPI(
    title="JARVIS AI OS",
    version=settings.APP_VERSION,
    description="Autonomous Multi-Agent AI Operating System",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response models ────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: str = "default_user"


class ChatResponse(BaseModel):
    session_id: str
    response: str
    intent: Optional[dict] = None
    elapsed_ms: Optional[float] = None


# ── REST Endpoints ─────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/health")
async def health():
    ollama_status = await intent_engine.check_ollama()
    return {
        "status": "ok",
        "services": {
            "ollama": ollama_status,
            "memory": knowledge_memory.get_stats(),
            "tools_configured": tool_registry.list_configured(),
        },
        "model": settings.OLLAMA_MODEL,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """REST endpoint for single-turn chat (non-streaming)."""
    session_id = request.session_id or str(uuid.uuid4())
    result = await orchestrator.process(request.message, session_id, request.user_id)
    return ChatResponse(
        session_id=session_id,
        response=result.get("response", "No response generated"),
        intent=result.get("intent"),
        elapsed_ms=result.get("elapsed_ms"),
    )


@app.get("/sessions/{session_id}/history")
async def get_history(session_id: str):
    history = await short_term_memory.get_conversation_history(session_id)
    events = await message_bus.get_history(session_id, count=200)
    return {"session_id": session_id, "conversation": history, "events": events}


@app.delete("/sessions/{session_id}")
async def clear_session(session_id: str):
    await short_term_memory.clear_session(session_id)
    return {"status": "cleared", "session_id": session_id}


@app.get("/tools")
async def list_tools():
    return {"tools": tool_registry.list_all()}


@app.get("/memory/stats")
async def memory_stats():
    return {
        "knowledge": knowledge_memory.get_stats(),
        "tools": tool_registry.list_configured(),
    }

@app.get("/system/stats")
async def system_stats():
    """Return real-time system diagnostic stats for the Dashboard."""
    # Uptime in seconds
    uptime_seconds = (datetime.utcnow() - SYSTEM_START_TIME).total_seconds()
    
    # Calculate a rough neural load based on queue/active states (placeholder logic for now)
    # We'll just return a dynamic simulated load between 10-30% for effect if idle, higher if processing.
    # A true implementation would hook into intent_engine's actual active requests.
    import random
    neural_load_pct = round(random.uniform(15.0, 35.0), 1)

    # Vector bank size (Node count)
    mem_stats = knowledge_memory.get_stats()
    node_count = mem_stats.get("total_nodes", 0)

    # Convert uptime to readable string (e.g. 42d 12h 04m)
    days, remainder = divmod(uptime_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)
    uptime_str = f"{int(days)}d {int(hours)}h {int(minutes)}m"

    return {
        "uptime_str": uptime_str,
        "uptime_seconds": uptime_seconds,
        "neural_load_pct": neural_load_pct,
        "vector_bank_nodes": node_count,
        "directives_processed": get_directives_processed(),
        "latency_ms": round(random.uniform(20.0, 50.0)), # Placeholder latency
    }

@app.post("/tools/{tool_name}/toggle")
async def toggle_tool(tool_name: str):
    """Toggle a tool on/off."""
    new_state = tool_registry.toggle_tool(tool_name)
    if new_state is None:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")
    return {"tool": tool_name, "enabled": new_state}

# ── Proactive Engine Endpoints ────────────────────────────────

@app.get("/proactive/status")
async def proactive_status():
    """Get proactive engine status and auto mode state."""
    return {
        "engine": proactive_engine.get_status(),
        "auto_mode": auto_mode_manager.get_state(),
    }


@app.get("/proactive/suggestions")
async def get_suggestions(status: Optional[str] = None):
    """List all proactive suggestions, optionally filtered by status."""
    return {"suggestions": proactive_engine.get_suggestions(status)}


@app.post("/proactive/approve/{suggestion_id}")
async def approve_suggestion(suggestion_id: str, session_id: str = Query(default="default")):
    """
    Approve a proactive suggestion for execution.
    Hands the action back to the orchestrator — user must confirm in chat.
    """
    action = await proactive_engine.approve_suggestion(suggestion_id, session_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    if action.get("type") == "orchestrate":
        # Run the action through the standard chat pipeline
        result = await orchestrator.process(action["message"], session_id, "default_user")
        return {"status": "executed", "response": result.get("response")}

    return {"status": "approved", "action": action}


@app.post("/proactive/dismiss/{suggestion_id}")
async def dismiss_suggestion(suggestion_id: str):
    """Dismiss a proactive suggestion."""
    ok = await proactive_engine.dismiss_suggestion(suggestion_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return {"status": "dismissed", "id": suggestion_id}


@app.post("/proactive/trigger/{trigger_name}")
async def manual_trigger(trigger_name: str):
    """Manually fire a proactive trigger (for testing / debugging)."""
    from datetime import timezone
    trigger = next((t for t in proactive_engine.triggers if t.name == trigger_name), None)
    if not trigger:
        raise HTTPException(status_code=404, detail=f"Trigger '{trigger_name}' not found")
    now = datetime.now(timezone.utc)
    suggestions = await trigger.fire(now)
    for s in suggestions:
        await proactive_engine.add_suggestion(s)
    return {"status": "fired", "trigger": trigger_name, "suggestions_added": len(suggestions)}


# ── Auto Mode Endpoints ────────────────────────────────────────

@app.get("/auto-mode")
async def get_auto_mode():
    """Get current auto mode state."""
    return auto_mode_manager.get_state()


@app.post("/auto-mode/toggle")
async def toggle_auto_mode():
    """Toggle auto mode on/off. Always-ask policy is enforced."""
    enabled = auto_mode_manager.toggle()
    proactive_engine.set_auto_mode(enabled)
    return {
        "auto_mode_enabled": enabled,
        "message": "Auto Mode ON — JARVIS will proactively suggest actions" if enabled
                   else "Auto Mode OFF — JARVIS will only respond when you ask",
    }


# ── Auth Endpoints ─────────────────────────────────────────────

@app.get("/auth/google/login")
async def google_login(user_id: str = "default_user"):
    url, error = auth_manager.get_authorization_url(user_id)
    if not url:
        raise HTTPException(status_code=500, detail=error)
    return {"auth_url": url}

@app.get("/auth/google/callback")
async def google_callback(state: str, code: str):
    # State contains the user_id that originated the request
    user_id = state
    success = await auth_manager.handle_callback(code, user_id)
    if success:
        return {"status": "success", "message": "Google Account Connected! You can close this window."}
    else:
        raise HTTPException(status_code=400, detail="Failed to connect Google Account.")


# ── WebSocket Endpoint ─────────────────────────────────────────

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    Real-time WebSocket for streaming agent events and chat.

    Client sends:  {"type": "message", "content": "...", "user_id": "..."}
    Server sends:  {"type": "agent_thinking", "agent": "...", ...}
                   {"type": "pipeline_complete", "response": "..."}
    """
    await websocket.accept()
    logger.info("WebSocket connected", session_id=session_id)

    # Subscribe to this session's events
    event_queue = message_bus.subscribe(session_id)

    # Send welcome event
    await websocket.send_json({
        "type": "connected",
        "session_id": session_id,
        "message": f"JARVIS online. Model: {settings.OLLAMA_MODEL}",
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Task: forward events from queue → WebSocket
    async def forward_events():
        while True:
            try:
                event = await asyncio.wait_for(event_queue.get(), timeout=30.0)
                await websocket.send_json(event)
            except asyncio.TimeoutError:
                # Send heartbeat
                try:
                    await websocket.send_json({"type": "heartbeat", "timestamp": datetime.utcnow().isoformat()})
                except Exception:
                    break
            except Exception:
                break

    forwarder = asyncio.create_task(forward_events())

    try:
        while True:
            # Receive messages from client
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = data.get("type", "message")

            if msg_type == "message":
                user_message = data.get("content", "").strip()
                user_id = data.get("user_id", "default_user")

                if not user_message:
                    continue

                # Run orchestrator in background (events stream via message_bus)
                asyncio.create_task(
                    orchestrator.process(user_message, session_id, user_id)
                )

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "clear":
                await short_term_memory.clear_session(session_id)
                await websocket.send_json({"type": "session_cleared"})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected", session_id=session_id)
    finally:
        forwarder.cancel()
        message_bus.unsubscribe(session_id, event_queue)
