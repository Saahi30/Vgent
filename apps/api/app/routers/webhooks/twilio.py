"""Twilio webhook handlers for outbound calls."""

from fastapi import APIRouter, Request, Response
from app.core.config import get_settings

router = APIRouter(prefix="/webhooks/twilio", tags=["webhooks"])
settings = get_settings()


@router.post("/voice")
async def twilio_voice_webhook(request: Request):
    """Called when Twilio connects the outbound call.

    Returns TwiML that starts a Media Stream WebSocket
    so we can receive/send real-time audio.
    """
    form = await request.form()
    call_sid = form.get("CallSid", "")

    # Return TwiML that starts a bidirectional media stream
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{settings.api_url}/api/webhooks/twilio/stream/{call_sid}" />
    </Connect>
</Response>"""

    return Response(content=twiml, media_type="application/xml")


@router.post("/status")
async def twilio_status_webhook(request: Request):
    """Called when Twilio call status changes (initiated, ringing, answered, completed)."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    call_status = form.get("CallStatus", "")
    duration = form.get("CallDuration", "0")

    status_map = {
        "queued": "initiated",
        "ringing": "ringing",
        "in-progress": "in_progress",
        "completed": "completed",
        "failed": "failed",
        "busy": "busy",
        "no-answer": "no_answer",
        "canceled": "failed",
    }

    mapped_status = status_map.get(call_status, call_status)

    # Update call record
    from app.services.livekit_agent import update_call_status
    from datetime import datetime, timezone

    kwargs = {}
    if mapped_status == "in_progress":
        kwargs["answered_at"] = datetime.now(timezone.utc)
    elif mapped_status in ("completed", "failed", "busy", "no_answer"):
        kwargs["ended_at"] = datetime.now(timezone.utc)
        kwargs["duration_seconds"] = int(duration)
        kwargs["end_reason"] = mapped_status

    # Find our call by telephony_call_id
    from app.core.database import async_session
    from sqlalchemy import select
    from app.models.call import Call

    async with async_session() as db:
        result = await db.execute(
            select(Call).where(Call.telephony_call_id == call_sid)
        )
        call = result.scalar_one_or_none()
        if call:
            call.status = mapped_status
            for key, value in kwargs.items():
                setattr(call, key, value)
            await db.commit()

            # Fire post-call analysis when call completes
            if mapped_status == "completed":
                from app.tasks.call_analysis_tasks import analyze_call_task
                analyze_call_task.delay(call_id=str(call.id))

    return Response(status_code=200)
