from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from uuid import UUID
from datetime import datetime, timedelta, timezone
import math

from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.auth import require_role, CurrentUser
from app.core.redis import redis_client
from app.core.supabase_admin import create_auth_user, delete_auth_user
from app.models.tenant import Tenant
from app.models.call import Call
from app.models.agent import Agent
from app.models.user import User
from app.models.spending_ledger import SpendingLedger
from app.models.usage import UsageRecord
from app.schemas.tenant import TenantResponse, TenantUpdate, AdminTenantCreate
from app.schemas.call import CallResponse
from app.schemas.common import ApiResponse, PaginatedResponse
from app.services.spending_limiter import admin_adjust_balance, admin_reset_usage

router = APIRouter(prefix="/admin", tags=["admin"])

superadmin = require_role("superadmin")


@router.get("/tenants", response_model=PaginatedResponse[TenantResponse])
async def admin_list_tenants(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count()).select_from(Tenant))).scalar() or 0
    result = await db.execute(
        select(Tenant).order_by(Tenant.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    tenants = result.scalars().all()

    # Get agents count per tenant
    tenant_ids = [t.id for t in tenants]
    agents_counts = {}
    if tenant_ids:
        count_result = await db.execute(
            select(Agent.tenant_id, func.count(Agent.id))
            .where(Agent.tenant_id.in_(tenant_ids))
            .group_by(Agent.tenant_id)
        )
        agents_counts = dict(count_result.all())

    return PaginatedResponse(
        data=[TenantResponse.from_tenant(t, agents_counts.get(t.id, 0)) for t in tenants],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("/tenants", response_model=ApiResponse[TenantResponse])
async def admin_create_tenant(
    body: AdminTenantCreate,
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tenant with an owner user (via Supabase Auth)."""
    # Check slug uniqueness
    existing = await db.execute(select(Tenant).where(Tenant.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{body.slug}' already exists")

    # 1. Create Supabase auth user
    try:
        auth_user = await create_auth_user(body.owner_email, body.owner_password, body.owner_name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    auth_user_id = auth_user.get("id")

    # 2. Create tenant
    tenant = Tenant(
        name=body.name,
        slug=body.slug,
        plan=body.plan,
        max_agents=body.max_agents,
        max_concurrent_calls=body.max_concurrent_calls,
        monthly_call_minutes_limit=body.monthly_call_minutes_limit,
        allocated_minutes=body.allocated_minutes,
        allocated_dollars=body.allocated_dollars,
        monthly_spend_limit_usd=body.monthly_spend_limit_usd,
        spending_limit_action=body.spending_limit_action,
    )
    db.add(tenant)
    await db.flush()

    # 3. Create owner user in public.users linked to tenant
    owner = User(
        id=auth_user_id,
        tenant_id=tenant.id,
        role="owner",
        full_name=body.owner_name,
    )
    db.add(owner)

    try:
        await db.flush()
    except Exception:
        # Rollback: delete the Supabase auth user if DB insert fails
        await delete_auth_user(auth_user_id)
        raise HTTPException(status_code=500, detail="Failed to create user record")

    return ApiResponse(data=TenantResponse.from_tenant(tenant))


@router.get("/tenants/{tenant_id}", response_model=ApiResponse[TenantResponse])
async def admin_get_tenant(
    tenant_id: UUID,
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return ApiResponse(data=TenantResponse.from_tenant(tenant))


@router.patch("/tenants/{tenant_id}", response_model=ApiResponse[TenantResponse])
async def admin_update_tenant(
    tenant_id: UUID,
    body: TenantUpdate,
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(tenant, key, value)

    await db.flush()
    return ApiResponse(data=TenantResponse.from_tenant(tenant))


@router.post("/tenants/{tenant_id}/suspend", response_model=ApiResponse[TenantResponse])
async def admin_suspend_tenant(
    tenant_id: UUID,
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.is_active = not tenant.is_active
    await db.flush()
    return ApiResponse(data=TenantResponse.from_tenant(tenant))


@router.get("/calls", response_model=PaginatedResponse[CallResponse])
async def admin_list_calls(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tenant_id: UUID | None = None,
    status: str | None = None,
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Call)
    count_query = select(func.count()).select_from(Call)

    if tenant_id:
        query = query.where(Call.tenant_id == tenant_id)
        count_query = count_query.where(Call.tenant_id == tenant_id)
    if status:
        query = query.where(Call.status == status)
        count_query = count_query.where(Call.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Call.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    calls = result.scalars().all()

    return PaginatedResponse(
        data=[CallResponse.model_validate(c) for c in calls],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/usage", response_model=ApiResponse)
async def admin_platform_usage(
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_tenants = (await db.execute(select(func.count()).select_from(Tenant))).scalar() or 0
    total_calls_today = (await db.execute(
        select(func.count()).select_from(Call).where(Call.created_at >= today_start)
    )).scalar() or 0
    active_calls = (await db.execute(
        select(func.count()).select_from(Call).where(Call.status == "in_progress")
    )).scalar() or 0
    total_minutes_today = (await db.execute(
        select(func.coalesce(func.sum(Call.duration_seconds), 0))
        .where(Call.created_at >= today_start)
    )).scalar() or 0

    return ApiResponse(data={
        "total_tenants": total_tenants,
        "calls_today": total_calls_today,
        "active_calls": active_calls,
        "total_minutes_today": round(total_minutes_today / 60, 2),
    })


@router.get("/health", response_model=ApiResponse)
async def admin_health(
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    """System health check."""
    health = {"database": "error", "redis": "error"}

    # Check DB
    try:
        await db.execute(text("SELECT 1"))
        health["database"] = "ok"
    except Exception:
        pass

    # Check Redis
    try:
        await redis_client.ping()
        health["redis"] = "ok"
    except Exception:
        pass

    return ApiResponse(data=health)


# ── Spending allocation & management ─────────────────────────


class AllocateRequest(BaseModel):
    minutes_delta: float = Field(default=0, description="Minutes to add (positive) or remove (negative)")
    dollars_delta: float = Field(default=0, description="Dollars to add (positive) or remove (negative)")
    note: str = Field(default="", max_length=500)


class ResetUsageRequest(BaseModel):
    note: str = Field(default="", max_length=500)


@router.post("/tenants/{tenant_id}/allocate", response_model=ApiResponse[TenantResponse])
async def admin_allocate_balance(
    tenant_id: UUID,
    body: AllocateRequest,
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Add or remove minutes/dollars from a tenant's allocation."""
    try:
        tenant = await admin_adjust_balance(
            db, tenant_id,
            minutes_delta=body.minutes_delta,
            dollars_delta=body.dollars_delta,
            note=body.note,
        )
        await db.commit()
        return ApiResponse(data=TenantResponse.from_tenant(tenant))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/tenants/{tenant_id}/reset-usage", response_model=ApiResponse[TenantResponse])
async def admin_reset_tenant_usage(
    tenant_id: UUID,
    body: ResetUsageRequest,
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Reset a tenant's used_minutes and used_dollars to zero."""
    try:
        tenant = await admin_reset_usage(db, tenant_id, note=body.note)
        await db.commit()
        return ApiResponse(data=TenantResponse.from_tenant(tenant))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/tenants/{tenant_id}/spending", response_model=ApiResponse)
async def admin_tenant_spending(
    tenant_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Get a tenant's spending ledger history."""
    total = (await db.execute(
        select(func.count()).select_from(SpendingLedger)
        .where(SpendingLedger.tenant_id == tenant_id)
    )).scalar() or 0

    result = await db.execute(
        select(SpendingLedger)
        .where(SpendingLedger.tenant_id == tenant_id)
        .order_by(SpendingLedger.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    entries = result.scalars().all()

    # Get tenant for context
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()

    return ApiResponse(data={
        "tenant_id": str(tenant_id),
        "used_minutes": tenant.used_minutes if tenant else 0,
        "used_dollars": tenant.used_dollars if tenant else 0,
        "allocated_minutes": tenant.allocated_minutes if tenant else 0,
        "allocated_dollars": tenant.allocated_dollars if tenant else 0,
        "entries": [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "minutes_delta": e.minutes_delta,
                "dollars_delta": e.dollars_delta,
                "balance_minutes_after": e.balance_minutes_after,
                "balance_dollars_after": e.balance_dollars_after,
                "call_id": str(e.call_id) if e.call_id else None,
                "campaign_id": str(e.campaign_id) if e.campaign_id else None,
                "note": e.note,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0,
    })


@router.get("/tenants/{tenant_id}/usage-detail", response_model=ApiResponse)
async def admin_tenant_usage_detail(
    tenant_id: UUID,
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed usage for a specific tenant including monthly breakdown."""
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get usage records (monthly)
    usage_result = await db.execute(
        select(UsageRecord)
        .where(UsageRecord.tenant_id == tenant_id)
        .order_by(UsageRecord.period_start.desc())
        .limit(12)
    )
    records = usage_result.scalars().all()

    # Current period stats from calls
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    calls_this_month = (await db.execute(
        select(func.count()).select_from(Call)
        .where(Call.tenant_id == tenant_id, Call.created_at >= month_start)
    )).scalar() or 0

    minutes_effective_limit = tenant.allocated_minutes if tenant.allocated_minutes > 0 else tenant.monthly_call_minutes_limit
    dollars_effective_limit = tenant.allocated_dollars if tenant.allocated_dollars > 0 else tenant.monthly_spend_limit_usd

    return ApiResponse(data={
        "tenant_id": str(tenant_id),
        "tenant_name": tenant.name,
        "plan": tenant.plan,
        "limits": {
            "minutes_limit": minutes_effective_limit,
            "dollars_limit": dollars_effective_limit,
            "max_agents": tenant.max_agents,
            "max_concurrent_calls": tenant.max_concurrent_calls,
        },
        "current_usage": {
            "used_minutes": round(tenant.used_minutes, 2),
            "used_dollars": round(tenant.used_dollars, 4),
            "remaining_minutes": max(0, minutes_effective_limit - tenant.used_minutes) if minutes_effective_limit > 0 else None,
            "remaining_dollars": max(0, dollars_effective_limit - tenant.used_dollars) if dollars_effective_limit > 0 else None,
            "calls_this_month": calls_this_month,
            "percent_minutes_used": round(tenant.used_minutes / minutes_effective_limit * 100, 1) if minutes_effective_limit > 0 else 0,
            "percent_dollars_used": round(tenant.used_dollars / dollars_effective_limit * 100, 1) if dollars_effective_limit > 0 else 0,
        },
        "monthly_history": [
            {
                "period_start": r.period_start.isoformat(),
                "period_end": r.period_end.isoformat(),
                "total_calls": r.total_calls,
                "total_minutes": round(r.total_call_minutes, 2),
                "total_cost_usd": round(r.total_cost_usd, 4),
                "breakdown": r.breakdown,
            }
            for r in records
        ],
    })


@router.get("/usage/all-tenants", response_model=ApiResponse)
async def admin_all_tenants_usage(
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Overview of all tenants' spending — for the admin dashboard."""
    result = await db.execute(
        select(Tenant).where(Tenant.is_active == True).order_by(Tenant.used_minutes.desc())
    )
    tenants = result.scalars().all()

    data = []
    for t in tenants:
        minutes_limit = t.allocated_minutes if t.allocated_minutes > 0 else t.monthly_call_minutes_limit
        dollars_limit = t.allocated_dollars if t.allocated_dollars > 0 else t.monthly_spend_limit_usd
        data.append({
            "id": str(t.id),
            "name": t.name,
            "slug": t.slug,
            "plan": t.plan,
            "used_minutes": round(t.used_minutes, 2),
            "used_dollars": round(t.used_dollars, 4),
            "minutes_limit": minutes_limit,
            "dollars_limit": dollars_limit,
            "percent_minutes": round(t.used_minutes / minutes_limit * 100, 1) if minutes_limit > 0 else 0,
            "percent_dollars": round(t.used_dollars / dollars_limit * 100, 1) if dollars_limit > 0 else 0,
            "spending_limit_action": t.spending_limit_action,
        })

    return ApiResponse(data=data)
