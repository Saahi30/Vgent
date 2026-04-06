from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.models.tenant import Tenant
from app.models.agent import Agent
from app.models.call import Call
from app.models.usage import UsageRecord
from app.schemas.tenant import TenantResponse, TenantUpdate
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/current", response_model=ApiResponse[TenantResponse])
async def get_current_tenant(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's tenant."""
    if not user.tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")

    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return ApiResponse(data=TenantResponse.model_validate(tenant))


@router.patch("/current", response_model=ApiResponse[TenantResponse])
async def update_current_tenant(
    body: TenantUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current tenant. Owner only."""
    if user.role not in ("owner", "superadmin"):
        raise HTTPException(status_code=403, detail="Only owners can update tenant settings")

    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tenant, key, value)

    await db.flush()
    return ApiResponse(data=TenantResponse.model_validate(tenant))


@router.get("/current/usage", response_model=ApiResponse[dict])
async def get_current_tenant_usage(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get usage stats for the current tenant."""
    if not user.tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")

    # Get tenant for limits
    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Count agents
    agents_result = await db.execute(
        select(func.count())
        .select_from(Agent)
        .where(Agent.tenant_id == user.tenant_id)
        .where(Agent.is_active == True)
    )
    agents_count = agents_result.scalar() or 0

    # Calls this month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    calls_result = await db.execute(
        select(func.count())
        .select_from(Call)
        .where(Call.tenant_id == user.tenant_id)
        .where(Call.created_at >= month_start)
    )
    calls_this_month = calls_result.scalar() or 0

    # Minutes used this month
    minutes_result = await db.execute(
        select(func.coalesce(func.sum(Call.duration_seconds), 0))
        .where(Call.tenant_id == user.tenant_id)
        .where(Call.created_at >= month_start)
    )
    seconds_used = minutes_result.scalar() or 0
    minutes_used = round(seconds_used / 60, 1)

    # Total cost this month from usage records
    cost_result = await db.execute(
        select(UsageRecord)
        .where(UsageRecord.tenant_id == user.tenant_id)
        .where(UsageRecord.period_start >= month_start.date())
    )
    usage_record = cost_result.scalar_one_or_none()
    total_cost_usd = round(usage_record.total_cost_usd, 4) if usage_record else 0.0
    cost_per_minute = round(total_cost_usd / minutes_used, 4) if minutes_used > 0 else 0.0

    return ApiResponse(data={
        "plan": tenant.plan,
        "agents_count": agents_count,
        "max_agents": tenant.max_agents,
        "calls_this_month": calls_this_month,
        "minutes_used": minutes_used,
        "monthly_call_minutes_limit": tenant.monthly_call_minutes_limit,
        "max_concurrent_calls": tenant.max_concurrent_calls,
        "total_cost_usd": total_cost_usd,
        "cost_per_minute": cost_per_minute,
    })
