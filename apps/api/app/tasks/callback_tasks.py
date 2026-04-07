"""Scheduled callback tasks.

scan_due_callbacks: Celery Beat task (every 60s). Finds pending callbacks
    whose scheduled_at has passed and dispatches a call for each one,
    reusing the same dial logic as campaigns.
"""

import asyncio
import logging
from datetime import datetime, timezone

from celery_app import celery

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _scan_callbacks():
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.core.database import async_session
    from app.models.scheduled_callback import ScheduledCallback
    from app.models.contact import Contact
    from app.models.agent import Agent
    from app.models.call import Call
    from app.services.telephony.registry import get_telephony_provider
    from app.core.redis import publish_event

    now = datetime.now(timezone.utc)

    async with async_session() as db:
        result = await db.execute(
            select(ScheduledCallback)
            .where(
                ScheduledCallback.status == "pending",
                ScheduledCallback.scheduled_at <= now,
            )
            .order_by(ScheduledCallback.scheduled_at.asc())
            .limit(50)
        )
        callbacks = result.scalars().all()

        if not callbacks:
            return

        for cb in callbacks:
            try:
                await _dispatch_callback(db, cb)
            except Exception:
                logger.exception("Error dispatching callback %s", cb.id)
                cb.status = "failed"

        await db.commit()


async def _dispatch_callback(db, cb):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.contact import Contact
    from app.models.agent import Agent
    from app.models.call import Call
    from app.services.telephony.registry import get_telephony_provider
    from app.core.redis import publish_event

    contact = (await db.execute(
        select(Contact).where(Contact.id == cb.contact_id)
    )).scalar_one_or_none()

    if not contact or contact.do_not_call:
        cb.status = "cancelled"
        return

    agent = (await db.execute(
        select(Agent).where(Agent.id == cb.agent_id).options(
            selectinload(Agent.telephony_provider),
            selectinload(Agent.llm_provider),
            selectinload(Agent.stt_provider),
            selectinload(Agent.tts_provider),
        )
    )).scalar_one_or_none()

    if not agent or not agent.is_active:
        cb.status = "failed"
        logger.error("Agent %s not found or inactive for callback %s", cb.agent_id, cb.id)
        return

    # Create call record
    call = Call(
        tenant_id=str(cb.tenant_id),
        agent_id=str(cb.agent_id),
        contact_id=str(cb.contact_id),
        direction="outbound",
        status="initiated",
        to_number=contact.phone_number,
        llm_provider=agent.llm_provider.provider_name if agent.llm_provider else "groq",
        stt_provider=agent.stt_provider.provider_name if agent.stt_provider else "deepgram",
        tts_provider=agent.tts_provider.provider_name if agent.tts_provider else "edge_tts",
    )
    db.add(call)
    await db.flush()

    call_id = str(call.id)
    cb.call_id = call.id
    cb.status = "dispatched"

    provider_name = agent.telephony_provider.provider_name if agent.telephony_provider else "vobiz"

    try:
        provider = get_telephony_provider(provider_name)
        call_info = await provider.initiate_call(
            to=contact.phone_number,
            room_name=f"call-{call_id}",
        )

        call.telephony_provider = provider_name
        call.telephony_call_id = call_info.call_id
        call.status = "ringing"
        call.started_at = datetime.now(timezone.utc)

        await db.flush()

        logger.info("Callback %s: call %s initiated → %s",
                     cb.id, call_id, contact.phone_number)

        await publish_event(f"tenant:{cb.tenant_id}:calls", {
            "event": "call_started",
            "call_id": call_id,
            "callback_id": str(cb.id),
            "to_number": contact.phone_number,
        })

    except Exception as e:
        call.status = "failed"
        call.error_message = str(e)
        call.end_reason = "error"
        cb.status = "failed"

        logger.error("Callback %s: failed to initiate call: %s", cb.id, e)


@celery.task(name="app.tasks.callback_tasks.scan_due_callbacks")
def scan_due_callbacks():
    """Scan for pending callbacks that are due. Runs every 60s via Celery Beat."""
    _run_async(_scan_callbacks())
