"""WebSocket endpoints for real-time call monitoring and campaign progress."""

import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.redis import redis_client, get_active_calls_for_tenant, get_all_active_calls
from app.core.auth import verify_jwt

router = APIRouter(tags=["websockets"])


async def authenticate_ws(websocket: WebSocket, token: str | None) -> dict | None:
    """Authenticate a WebSocket connection via JWT token."""
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return None
    try:
        return await verify_jwt(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return None


async def subscribe_to_channel(websocket: WebSocket, channel: str):
    """Subscribe to a Redis pub/sub channel and forward messages to WebSocket."""
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel)

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()


@router.websocket("/ws/calls/{call_id}")
async def ws_call_events(
    websocket: WebSocket,
    call_id: str,
    token: str = Query(default=None),
):
    """Stream real-time events for a specific call.

    Events: turn, call_started, call_ended, user_speech, llm_started,
    llm_completed, tts_started, tts_completed, agent_joined
    """
    payload = await authenticate_ws(websocket, token)
    if not payload:
        return

    await websocket.accept()

    try:
        await subscribe_to_channel(websocket, f"call:{call_id}")
    except WebSocketDisconnect:
        pass


@router.websocket("/ws/campaigns/{campaign_id}")
async def ws_campaign_progress(
    websocket: WebSocket,
    campaign_id: str,
    token: str = Query(default=None),
):
    """Stream live campaign progress (calls initiated, completed, failed)."""
    payload = await authenticate_ws(websocket, token)
    if not payload:
        return

    await websocket.accept()

    try:
        await subscribe_to_channel(websocket, f"campaign:{campaign_id}")
    except WebSocketDisconnect:
        pass


@router.websocket("/ws/admin/calls")
async def ws_admin_all_calls(
    websocket: WebSocket,
    token: str = Query(default=None),
):
    """Superadmin: stream events from ALL active calls across all tenants."""
    payload = await authenticate_ws(websocket, token)
    if not payload:
        return

    # Check superadmin role
    role = payload.get("role", "")
    if role != "superadmin":
        await websocket.close(code=4003, reason="Superadmin only")
        return

    await websocket.accept()

    # Send initial snapshot of all active calls
    active = await get_all_active_calls()
    await websocket.send_text(json.dumps({"event": "snapshot", "calls": active}))

    # Subscribe to the wildcard admin channel
    try:
        await subscribe_to_channel(websocket, "admin:calls")
    except WebSocketDisconnect:
        pass


@router.websocket("/ws/live")
async def ws_live_monitor(
    websocket: WebSocket,
    token: str = Query(default=None),
):
    """Stream events for all active calls belonging to the user's tenant."""
    payload = await authenticate_ws(websocket, token)
    if not payload:
        return

    tenant_id = payload.get("tenant_id", "")
    if not tenant_id:
        await websocket.close(code=4003, reason="No tenant")
        return

    await websocket.accept()

    # Send initial snapshot of tenant's active calls
    active = await get_active_calls_for_tenant(tenant_id)
    await websocket.send_text(json.dumps({"event": "snapshot", "calls": active}))

    try:
        await subscribe_to_channel(websocket, f"tenant:{tenant_id}:calls")
    except WebSocketDisconnect:
        pass
