"""
Spending limit enforcement for multi-tenant SaaS.

Checks and enforces per-tenant spending limits (minutes and dollars).
Called before campaign start, before individual calls, and after call completion.
"""

from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.tenant import Tenant
from app.models.spending_ledger import SpendingLedger
from app.models.call import Call
from app.models.campaign import Campaign
from app.services import bolna_client
import logging
import uuid

logger = logging.getLogger(__name__)


@dataclass
class SpendingStatus:
    can_proceed: bool
    minutes_remaining: float
    dollars_remaining: float
    minutes_used: float
    dollars_used: float
    minutes_limit: float
    dollars_limit: float
    warning: str | None = None


async def check_spending_limit(db: AsyncSession, tenant_id: uuid.UUID) -> SpendingStatus:
    """Check if a tenant is within their spending limits."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        return SpendingStatus(
            can_proceed=False, minutes_remaining=0, dollars_remaining=0,
            minutes_used=0, dollars_used=0, minutes_limit=0, dollars_limit=0,
            warning="Tenant not found",
        )

    if not tenant.is_active:
        return SpendingStatus(
            can_proceed=False, minutes_remaining=0, dollars_remaining=0,
            minutes_used=tenant.used_minutes, dollars_used=tenant.used_dollars,
            minutes_limit=0, dollars_limit=0,
            warning="Tenant is suspended",
        )

    # Determine effective limits
    minutes_limit = tenant.allocated_minutes if tenant.allocated_minutes > 0 else tenant.monthly_call_minutes_limit
    dollars_limit = tenant.allocated_dollars if tenant.allocated_dollars > 0 else tenant.monthly_spend_limit_usd

    minutes_remaining = max(0, minutes_limit - tenant.used_minutes) if minutes_limit > 0 else float("inf")
    dollars_remaining = max(0, dollars_limit - tenant.used_dollars) if dollars_limit > 0 else float("inf")

    # Check limits
    minutes_exceeded = minutes_limit > 0 and tenant.used_minutes >= minutes_limit
    dollars_exceeded = dollars_limit > 0 and tenant.used_dollars >= dollars_limit

    warning = None
    can_proceed = True

    if minutes_exceeded or dollars_exceeded:
        if tenant.spending_limit_action == "block":
            can_proceed = False
            warning = "Spending limit exceeded. Contact admin to increase your allocation."
        elif tenant.spending_limit_action == "pause":
            can_proceed = False
            warning = "Spending limit reached. Campaigns have been paused."
        else:  # warn
            can_proceed = True
            warning = "Warning: You have exceeded your spending limit."
    elif minutes_limit > 0 and tenant.used_minutes >= minutes_limit * 0.9:
        warning = f"Warning: {minutes_remaining:.1f} minutes remaining out of {minutes_limit}."
    elif dollars_limit > 0 and tenant.used_dollars >= dollars_limit * 0.9:
        warning = f"Warning: ${dollars_remaining:.2f} remaining out of ${dollars_limit:.2f}."

    return SpendingStatus(
        can_proceed=can_proceed,
        minutes_remaining=minutes_remaining,
        dollars_remaining=dollars_remaining,
        minutes_used=tenant.used_minutes,
        dollars_used=tenant.used_dollars,
        minutes_limit=minutes_limit,
        dollars_limit=dollars_limit,
        warning=warning,
    )


async def record_call_spending(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    call: Call,
    campaign_id: uuid.UUID | None = None,
):
    """
    Record spending after a call completes.
    Updates tenant used_minutes/used_dollars and creates a ledger entry.
    Returns True if limit was exceeded (caller should stop the campaign).
    """
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        return False

    duration_minutes = (call.duration_seconds or 0) / 60.0
    cost = call.cost_usd or 0.0

    tenant.used_minutes += duration_minutes
    tenant.used_dollars += cost

    # Create ledger entry
    ledger = SpendingLedger(
        tenant_id=tenant_id,
        event_type="call_completed",
        minutes_delta=duration_minutes,
        dollars_delta=cost,
        balance_minutes_after=tenant.used_minutes,
        balance_dollars_after=tenant.used_dollars,
        call_id=call.id,
        campaign_id=campaign_id,
        note=f"Call to {call.to_number}, {duration_minutes:.1f}min, ${cost:.4f}",
    )
    db.add(ledger)
    await db.flush()

    # Check if limit is now exceeded
    minutes_limit = tenant.allocated_minutes if tenant.allocated_minutes > 0 else tenant.monthly_call_minutes_limit
    dollars_limit = tenant.allocated_dollars if tenant.allocated_dollars > 0 else tenant.monthly_spend_limit_usd

    limit_exceeded = False
    if (minutes_limit > 0 and tenant.used_minutes >= minutes_limit) or \
       (dollars_limit > 0 and tenant.used_dollars >= dollars_limit):
        limit_exceeded = True
        # Log the limit exceeded event
        exceeded_entry = SpendingLedger(
            tenant_id=tenant_id,
            event_type="limit_exceeded",
            minutes_delta=0,
            dollars_delta=0,
            balance_minutes_after=tenant.used_minutes,
            balance_dollars_after=tenant.used_dollars,
            call_id=call.id,
            campaign_id=campaign_id,
            note=f"Limit exceeded: {tenant.used_minutes:.1f}/{minutes_limit}min, ${tenant.used_dollars:.2f}/${dollars_limit:.2f}",
        )
        db.add(exceeded_entry)
        await db.flush()

    return limit_exceeded


async def enforce_limit_on_campaign(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    campaign_id: uuid.UUID,
):
    """
    If tenant limit is exceeded and action is pause/block,
    pause the campaign and stop the Bolna batch if applicable.
    """
    status = await check_spending_limit(db, tenant_id)
    if status.can_proceed:
        return

    # Pause the campaign
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if campaign and campaign.status == "running":
        campaign.status = "paused"
        await db.flush()
        logger.warning(
            f"Campaign {campaign_id} paused due to spending limit for tenant {tenant_id}"
        )

        # Stop the Bolna batch if it exists
        if campaign.bolna_batch_id:
            try:
                await bolna_client.stop_batch(campaign.bolna_batch_id)
                logger.info(f"Stopped Bolna batch {campaign.bolna_batch_id}")
            except Exception as e:
                logger.error(f"Failed to stop Bolna batch {campaign.bolna_batch_id}: {e}")


async def admin_adjust_balance(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    minutes_delta: float = 0,
    dollars_delta: float = 0,
    note: str = "",
):
    """Admin adds or removes minutes/dollars from a tenant's balance."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise ValueError("Tenant not found")

    event_type = "admin_credit" if (minutes_delta >= 0 and dollars_delta >= 0) else "admin_debit"

    if minutes_delta != 0:
        tenant.allocated_minutes = max(0, tenant.allocated_minutes + int(minutes_delta))
    if dollars_delta != 0:
        tenant.allocated_dollars = max(0, tenant.allocated_dollars + dollars_delta)

    ledger = SpendingLedger(
        tenant_id=tenant_id,
        event_type=event_type,
        minutes_delta=minutes_delta,
        dollars_delta=dollars_delta,
        balance_minutes_after=tenant.used_minutes,
        balance_dollars_after=tenant.used_dollars,
        note=note or f"Admin adjustment: {minutes_delta:+.0f}min, ${dollars_delta:+.2f}",
    )
    db.add(ledger)
    await db.flush()
    return tenant


async def admin_reset_usage(db: AsyncSession, tenant_id: uuid.UUID, note: str = ""):
    """Reset a tenant's used_minutes and used_dollars to zero."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise ValueError("Tenant not found")

    old_minutes = tenant.used_minutes
    old_dollars = tenant.used_dollars
    tenant.used_minutes = 0
    tenant.used_dollars = 0

    ledger = SpendingLedger(
        tenant_id=tenant_id,
        event_type="monthly_reset",
        minutes_delta=-old_minutes,
        dollars_delta=-old_dollars,
        balance_minutes_after=0,
        balance_dollars_after=0,
        note=note or f"Usage reset: was {old_minutes:.1f}min, ${old_dollars:.2f}",
    )
    db.add(ledger)
    await db.flush()
    return tenant
