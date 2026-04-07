"""
Bolna webhook endpoint — receives call-completion events from Bolna.

Bolna sends a POST to this endpoint after each call in a batch completes.
This is the core of the SaaS metering: we log the call, track usage,
and enforce spending limits mid-campaign.

The endpoint is idempotent: duplicate deliveries (same execution_id)
are detected and ignored.
"""

from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import logging

from app.core.database import get_db
from app.models.call import Call, CallTurn
from app.models.campaign import Campaign, CampaignContact
from app.models.agent import Agent
from app.models.contact import Contact
from app.services.spending_limiter import record_call_spending, enforce_limit_on_campaign
from app.services.usage_tracker import track_call_usage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks/bolna", tags=["webhooks"])


@router.post("/call-complete")
async def bolna_call_complete(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive Bolna call completion webhook.

    Expected payload (from Bolna):
    {
        "execution_id": "...",
        "agent_id": "...",          # Bolna agent ID
        "batch_id": "...",          # Bolna batch ID (if from a batch)
        "status": "completed|failed|busy|no_answer|voicemail",
        "recipient_phone_number": "+91...",
        "from_phone_number": "+1...",
        "duration": 120,            # seconds
        "transcript": [...],        # array of {role, content}
        "recording_url": "...",
        "extracted_data": {...},
        "cost": {
            "total": 0.05,
            "llm": 0.02,
            "tts": 0.01,
            "stt": 0.01,
            "telephony": 0.01
        },
        "started_at": "...",
        "ended_at": "..."
    }
    """
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    execution_id = payload.get("execution_id")
    if not execution_id:
        return JSONResponse(status_code=400, content={"error": "Missing execution_id"})

    # Idempotency: skip if we already processed this execution
    existing = await db.execute(
        select(Call).where(Call.bolna_execution_id == execution_id)
    )
    if existing.scalar_one_or_none():
        logger.info(f"Duplicate webhook for execution {execution_id}, skipping")
        return JSONResponse(content={"status": "already_processed"})

    bolna_agent_id = payload.get("agent_id")
    bolna_batch_id = payload.get("batch_id")

    # Find our internal agent by bolna_agent_id
    agent_result = await db.execute(
        select(Agent).where(Agent.bolna_agent_id == bolna_agent_id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        logger.warning(f"No agent found for bolna_agent_id={bolna_agent_id}")
        return JSONResponse(status_code=200, content={"status": "agent_not_found"})

    tenant_id = agent.tenant_id

    # Find campaign by bolna_batch_id if present
    campaign = None
    campaign_contact = None
    contact = None

    if bolna_batch_id:
        camp_result = await db.execute(
            select(Campaign).where(Campaign.bolna_batch_id == bolna_batch_id)
        )
        campaign = camp_result.scalar_one_or_none()

    # Try to find the contact by phone number
    to_number = payload.get("recipient_phone_number", "")
    if to_number:
        contact_result = await db.execute(
            select(Contact).where(
                Contact.tenant_id == tenant_id,
                Contact.phone_number == to_number,
            )
        )
        contact = contact_result.scalar_one_or_none()

    # Map Bolna status to our status
    bolna_status = payload.get("status", "completed")
    status_map = {
        "completed": "completed",
        "failed": "failed",
        "busy": "busy",
        "no_answer": "no_answer",
        "voicemail": "completed",
        "error": "failed",
    }
    call_status = status_map.get(bolna_status, "completed")

    # Extract cost
    cost_data = payload.get("cost", {})
    total_cost = cost_data.get("total", 0) if isinstance(cost_data, dict) else 0
    duration = payload.get("duration", 0) or 0

    # Create the call record
    call = Call(
        tenant_id=tenant_id,
        agent_id=agent.id,
        campaign_id=campaign.id if campaign else None,
        contact_id=contact.id if contact else None,
        direction="outbound",
        status=call_status,
        telephony_provider="bolna",
        bolna_execution_id=execution_id,
        from_number=payload.get("from_phone_number"),
        to_number=to_number,
        started_at=_parse_dt(payload.get("started_at")),
        ended_at=_parse_dt(payload.get("ended_at")),
        duration_seconds=int(duration),
        recording_url=payload.get("recording_url"),
        cost_usd=float(total_cost),
        end_reason="completed" if call_status == "completed" else "error",
        metadata_={"bolna_payload": payload.get("extracted_data", {})},
    )
    db.add(call)
    await db.flush()

    # Save transcript turns
    transcript = payload.get("transcript", [])
    if isinstance(transcript, list):
        for i, turn in enumerate(transcript):
            if isinstance(turn, dict):
                ct = CallTurn(
                    call_id=call.id,
                    tenant_id=tenant_id,
                    role=turn.get("role", "user"),
                    content=turn.get("content", ""),
                    timestamp_ms=i * 1000,
                )
                db.add(ct)

    # Update campaign contact status if applicable
    if campaign and contact:
        cc_result = await db.execute(
            select(CampaignContact).where(
                CampaignContact.campaign_id == campaign.id,
                CampaignContact.contact_id == contact.id,
            )
        )
        campaign_contact = cc_result.scalar_one_or_none()
        if campaign_contact:
            campaign_contact.status = "completed" if call_status == "completed" else "failed"
            campaign_contact.call_id = call.id
            campaign_contact.attempts += 1
            campaign_contact.last_attempted_at = datetime.now(timezone.utc)

    # Update campaign counters
    if campaign:
        if call_status == "completed":
            campaign.completed_calls = (campaign.completed_calls or 0) + 1
        else:
            campaign.failed_calls = (campaign.failed_calls or 0) + 1

    await db.flush()

    # Track usage in usage_records table
    await track_call_usage(db, call)

    # Record spending and check limits
    limit_exceeded = await record_call_spending(
        db, tenant_id, call,
        campaign_id=campaign.id if campaign else None,
    )

    # If limit exceeded, pause the campaign and stop the Bolna batch
    if limit_exceeded and campaign:
        await enforce_limit_on_campaign(db, tenant_id, campaign.id)

    await db.commit()

    logger.info(
        f"Processed Bolna call {execution_id}: "
        f"tenant={tenant_id}, status={call_status}, "
        f"duration={duration}s, cost=${total_cost:.4f}"
    )

    return JSONResponse(content={
        "status": "processed",
        "call_id": str(call.id),
        "limit_exceeded": limit_exceeded,
    })


def _parse_dt(val) -> datetime | None:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except Exception:
        return None
