"""Usage tracking — records per-tenant call usage for billing."""

from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.call import Call
from app.models.usage import UsageRecord


async def track_call_usage(db: AsyncSession, call: Call):
    """Update the usage record for the current billing period after a call ends."""
    today = date.today()
    period_start = today.replace(day=1)
    if today.month == 12:
        period_end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        period_end = today.replace(month=today.month + 1, day=1)

    # Find or create usage record for this period
    result = await db.execute(
        select(UsageRecord).where(
            UsageRecord.tenant_id == call.tenant_id,
            UsageRecord.period_start == period_start,
            UsageRecord.period_end == period_end,
        )
    )
    usage = result.scalar_one_or_none()

    if not usage:
        usage = UsageRecord(
            tenant_id=call.tenant_id,
            period_start=period_start,
            period_end=period_end,
        )
        db.add(usage)

    # Update totals
    usage.total_calls += 1
    duration_minutes = (call.duration_seconds or 0) / 60
    usage.total_call_minutes += duration_minutes
    usage.total_tokens_used += call.total_tokens_used or 0
    usage.total_cost_usd += call.cost_usd or 0

    # Update per-provider breakdown
    breakdown = dict(usage.breakdown)
    for provider_type in ("llm", "stt", "tts", "telephony"):
        provider_name = getattr(call, f"{provider_type}_provider", None)
        if provider_name:
            key = f"{provider_type}:{provider_name}"
            if key not in breakdown:
                breakdown[key] = {"calls": 0, "minutes": 0}
            breakdown[key]["calls"] += 1
            breakdown[key]["minutes"] += duration_minutes
    usage.breakdown = breakdown

    await db.flush()
