"""Vobiz webhook handler for SIP call events."""

from fastapi import APIRouter, Request, Response
from app.core.config import get_settings
from app.core.database import async_session
from sqlalchemy import select
from app.models.call import Call
from datetime import datetime, timezone

router = APIRouter(prefix="/webhooks/vobiz", tags=["webhooks"])
settings = get_settings()


@router.post("/event")
async def vobiz_event_webhook(request: Request):
    """Handle Vobiz SIP call events.

    Events come from LiveKit SIP integration when call status changes.
    """
    try:
        body = await request.json()
    except Exception:
        return Response(status_code=400)

    event_type = body.get("event", "")
    call_id = body.get("call_id", "")
    room_name = body.get("room_name", "")

    # Try to find the call by room name or call_id
    async with async_session() as db:
        call = None

        if call_id:
            result = await db.execute(
                select(Call).where(Call.telephony_call_id == call_id)
            )
            call = result.scalar_one_or_none()

        if not call and room_name:
            # Room name format is "call-{uuid}"
            internal_id = room_name.replace("call-", "")
            result = await db.execute(
                select(Call).where(Call.id == internal_id)
            )
            call = result.scalar_one_or_none()

        if not call:
            return Response(status_code=200)  # Acknowledge but ignore

        # Map Vobiz events to our status
        if event_type in ("call.answered", "call.connected"):
            call.status = "in_progress"
            call.answered_at = datetime.now(timezone.utc)

        elif event_type in ("call.ended", "call.completed", "call.hangup"):
            call.status = "completed"
            call.ended_at = datetime.now(timezone.utc)
            call.end_reason = body.get("reason", "completed")
            if call.started_at:
                call.duration_seconds = int((call.ended_at - call.started_at).total_seconds())

            # Fire post-call analysis (summary + sentiment)
            from app.tasks.call_analysis_tasks import analyze_call_task
            analyze_call_task.delay(call_id=str(call.id))

        elif event_type == "call.failed":
            call.status = "failed"
            call.ended_at = datetime.now(timezone.utc)
            call.end_reason = "error"
            call.error_message = body.get("error", "Call failed")

        elif event_type == "call.busy":
            call.status = "busy"
            call.ended_at = datetime.now(timezone.utc)
            call.end_reason = "user_hangup"

        elif event_type == "call.no_answer":
            call.status = "no_answer"
            call.ended_at = datetime.now(timezone.utc)
            call.end_reason = "timeout"

        await db.commit()

    return Response(status_code=200)
