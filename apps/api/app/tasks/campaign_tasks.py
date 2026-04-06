"""Campaign dialer tasks — the heart of the outbound calling engine.

scan_active_campaigns: Celery Beat task (every 60s). Finds running campaigns
    that are within calling hours and have pending contacts, then dispatches
    dial_contact tasks up to max_concurrent_calls.

dial_contact: Initiates a single outbound call for a campaign contact.
    Handles retries, status updates, and publishes progress via Redis.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from celery_app import celery

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from synchronous Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _scan():
    """Core async logic for scanning campaigns."""
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    from app.core.database import async_session
    from app.models.campaign import Campaign, CampaignContact
    from app.models.call import Call

    async with async_session() as db:
        # Find all running campaigns
        result = await db.execute(
            select(Campaign).where(Campaign.status == "running")
        )
        campaigns = result.scalars().all()

        if not campaigns:
            return

        for campaign in campaigns:
            try:
                await _process_campaign(db, campaign)
            except Exception:
                logger.exception("Error processing campaign %s", campaign.id)

        await db.commit()


async def _process_campaign(db, campaign):
    """Process a single running campaign: check hours, find contacts, dispatch calls."""
    import pytz
    from sqlalchemy import select, func
    from app.models.campaign import CampaignContact
    from app.models.call import Call
    from app.core.redis import publish_event

    # --- Check calling hours ---
    try:
        tz = pytz.timezone(campaign.timezone)
    except pytz.UnknownTimeZoneError:
        tz = pytz.UTC

    now_local = datetime.now(tz)
    current_weekday = now_local.isoweekday()  # 1=Monday, 7=Sunday

    if current_weekday not in (campaign.calling_days or [1, 2, 3, 4, 5]):
        logger.debug("Campaign %s: not a calling day (%s)", campaign.id, current_weekday)
        return

    current_time = now_local.time()
    if not (campaign.calling_hours_start <= current_time <= campaign.calling_hours_end):
        logger.debug("Campaign %s: outside calling hours (%s not in %s-%s)",
                      campaign.id, current_time, campaign.calling_hours_start, campaign.calling_hours_end)
        return

    # --- Check how many calls are currently active for this campaign ---
    active_count_result = await db.execute(
        select(func.count()).select_from(Call).where(
            Call.campaign_id == campaign.id,
            Call.status.in_(["initiated", "ringing", "in_progress"]),
        )
    )
    active_calls = active_count_result.scalar() or 0
    slots_available = max(0, campaign.max_concurrent_calls - active_calls)

    if slots_available <= 0:
        logger.debug("Campaign %s: no slots available (%d/%d active)",
                      campaign.id, active_calls, campaign.max_concurrent_calls)
        return

    # --- Find pending contacts eligible for dialing ---
    # Exclude contacts that were recently attempted (respect retry_delay)
    retry_cutoff = datetime.now(timezone.utc) - timedelta(minutes=campaign.retry_delay_minutes)

    pending_query = (
        select(CampaignContact)
        .where(
            CampaignContact.campaign_id == campaign.id,
            CampaignContact.status.in_(["pending", "failed"]),
        )
        .where(
            # Either never attempted, or last attempt was before retry cutoff
            (CampaignContact.last_attempted_at == None)  # noqa: E711
            | (CampaignContact.last_attempted_at < retry_cutoff)
        )
        .where(
            # Respect max retries for failed contacts
            CampaignContact.attempts <= campaign.max_retries
        )
        .order_by(CampaignContact.created_at.asc())
        .limit(slots_available)
    )
    result = await db.execute(pending_query)
    contacts_to_dial = result.scalars().all()

    if not contacts_to_dial:
        # Check if campaign is complete (no pending/calling contacts left)
        remaining_result = await db.execute(
            select(func.count()).select_from(CampaignContact).where(
                CampaignContact.campaign_id == campaign.id,
                CampaignContact.status.in_(["pending", "calling", "failed"]),
                CampaignContact.attempts <= campaign.max_retries,
            )
        )
        remaining = remaining_result.scalar() or 0

        if remaining == 0 and active_calls == 0:
            campaign.status = "completed"
            logger.info("Campaign %s completed — all contacts processed", campaign.id)
            await publish_event(f"campaign:{campaign.id}", {
                "event": "campaign_completed",
                "campaign_id": str(campaign.id),
                "completed_calls": campaign.completed_calls,
                "failed_calls": campaign.failed_calls,
                "total_contacts": campaign.total_contacts,
            })
        return

    # --- Dispatch calls ---
    for cc in contacts_to_dial:
        cc.status = "calling"
        cc.attempts += 1
        cc.last_attempted_at = datetime.now(timezone.utc)
        await db.flush()

        # Dispatch async Celery task
        dial_contact.delay(
            campaign_id=str(campaign.id),
            campaign_contact_id=str(cc.id),
            contact_id=str(cc.contact_id),
            agent_id=str(campaign.agent_id),
            tenant_id=str(campaign.tenant_id),
        )

        logger.info("Campaign %s: dispatched call for contact %s (attempt %d)",
                     campaign.id, cc.contact_id, cc.attempts)

    await publish_event(f"campaign:{campaign.id}", {
        "event": "calls_dispatched",
        "campaign_id": str(campaign.id),
        "count": len(contacts_to_dial),
    })


@celery.task(name="app.tasks.campaign_tasks.scan_active_campaigns")
def scan_active_campaigns():
    """Scan for campaigns that should be actively dialing. Runs every 60s via Celery Beat."""
    _run_async(_scan())


async def _dial(campaign_id: str, campaign_contact_id: str, contact_id: str,
                agent_id: str, tenant_id: str):
    """Core async logic for dialing a single contact."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.core.database import async_session
    from app.models.campaign import Campaign, CampaignContact
    from app.models.contact import Contact
    from app.models.agent import Agent
    from app.models.call import Call
    from app.services.telephony.registry import get_telephony_provider
    from app.core.redis import publish_event

    async with async_session() as db:
        # Load campaign contact, contact, and agent
        cc = (await db.execute(
            select(CampaignContact).where(CampaignContact.id == campaign_contact_id)
        )).scalar_one_or_none()

        if not cc or cc.status != "calling":
            return

        contact = (await db.execute(
            select(Contact).where(Contact.id == contact_id)
        )).scalar_one_or_none()

        if not contact or contact.do_not_call:
            cc.status = "do_not_call"
            await db.commit()
            return

        agent = (await db.execute(
            select(Agent).where(Agent.id == agent_id).options(
                selectinload(Agent.telephony_provider),
                selectinload(Agent.llm_provider),
                selectinload(Agent.stt_provider),
                selectinload(Agent.tts_provider),
            )
        )).scalar_one_or_none()

        if not agent or not agent.is_active:
            cc.status = "failed"
            await db.commit()
            logger.error("Agent %s not found or inactive for campaign %s", agent_id, campaign_id)
            return

        # Create call record
        call = Call(
            tenant_id=tenant_id,
            agent_id=agent_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
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
        cc.call_id = call.id

        # Initiate via telephony provider
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

            logger.info("Call %s initiated for campaign %s → %s",
                         call_id, campaign_id, contact.phone_number)

            await publish_event(f"campaign:{campaign_id}", {
                "event": "call_initiated",
                "campaign_id": campaign_id,
                "call_id": call_id,
                "contact_id": contact_id,
                "phone_number": contact.phone_number,
            })

            await publish_event(f"tenant:{tenant_id}:calls", {
                "event": "call_started",
                "call_id": call_id,
                "campaign_id": campaign_id,
                "to_number": contact.phone_number,
            })

        except Exception as e:
            call.status = "failed"
            call.error_message = str(e)
            call.end_reason = "error"

            cc.status = "failed" if cc.attempts >= (await _get_max_retries(db, campaign_id)) else "pending"

            logger.error("Failed to initiate call for campaign %s, contact %s: %s",
                          campaign_id, contact_id, e)

            await publish_event(f"campaign:{campaign_id}", {
                "event": "call_failed",
                "campaign_id": campaign_id,
                "contact_id": contact_id,
                "error": str(e),
            })

        # Update campaign counters
        campaign = (await db.execute(
            select(Campaign).where(Campaign.id == campaign_id)
        )).scalar_one_or_none()

        if campaign and call.status == "failed":
            campaign.failed_calls = (campaign.failed_calls or 0) + 1

        await db.commit()


async def _get_max_retries(db, campaign_id: str) -> int:
    from sqlalchemy import select
    from app.models.campaign import Campaign
    campaign = (await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
    )).scalar_one_or_none()
    return campaign.max_retries if campaign else 2


@celery.task(name="app.tasks.campaign_tasks.dial_contact", bind=True, max_retries=0)
def dial_contact(self, campaign_id: str, campaign_contact_id: str,
                 contact_id: str, agent_id: str, tenant_id: str):
    """Initiate a single outbound call for a campaign contact."""
    _run_async(_dial(campaign_id, campaign_contact_id, contact_id, agent_id, tenant_id))


@celery.task(name="app.tasks.campaign_tasks.update_call_result")
def update_call_result(call_id: str, campaign_id: str, campaign_contact_id: str,
                       status: str):
    """Called when a call ends — updates campaign contact status and counters.

    This should be triggered from the call orchestrator or telephony webhook
    when a call reaches a terminal state.
    """
    _run_async(_update_result(call_id, campaign_id, campaign_contact_id, status))


async def _update_result(call_id: str, campaign_id: str, campaign_contact_id: str,
                         status: str):
    """Update campaign contact and campaign counters after a call ends."""
    from sqlalchemy import select
    from app.core.database import async_session
    from app.models.campaign import Campaign, CampaignContact
    from app.core.redis import publish_event

    async with async_session() as db:
        cc = (await db.execute(
            select(CampaignContact).where(CampaignContact.id == campaign_contact_id)
        )).scalar_one_or_none()

        campaign = (await db.execute(
            select(Campaign).where(Campaign.id == campaign_id)
        )).scalar_one_or_none()

        if not cc or not campaign:
            return

        if status in ("completed",):
            cc.status = "completed"
            campaign.completed_calls = (campaign.completed_calls or 0) + 1
        elif status in ("failed", "busy", "no_answer"):
            if cc.attempts >= campaign.max_retries:
                cc.status = "failed"
                campaign.failed_calls = (campaign.failed_calls or 0) + 1
            else:
                # Will be retried on next scan
                cc.status = "failed"
        else:
            cc.status = "failed"

        await db.commit()

        await publish_event(f"campaign:{campaign_id}", {
            "event": "call_result",
            "campaign_id": campaign_id,
            "campaign_contact_id": campaign_contact_id,
            "call_id": call_id,
            "status": cc.status,
            "completed_calls": campaign.completed_calls,
            "failed_calls": campaign.failed_calls,
            "total_contacts": campaign.total_contacts,
        })
