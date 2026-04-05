from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from uuid import UUID
from datetime import datetime, timedelta, timezone
import math

from app.core.database import get_db
from app.core.auth import require_role, CurrentUser
from app.core.redis import redis_client
from app.models.tenant import Tenant
from app.models.call import Call
from app.models.usage import UsageRecord
from app.schemas.tenant import TenantResponse, TenantUpdate
from app.schemas.call import CallResponse
from app.schemas.common import ApiResponse, PaginatedResponse

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

    return PaginatedResponse(
        data=[TenantResponse.model_validate(t) for t in tenants],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


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
    return ApiResponse(data=TenantResponse.model_validate(tenant))


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
    return ApiResponse(data=TenantResponse.model_validate(tenant))


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
    return ApiResponse(data=TenantResponse.model_validate(tenant))


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
        "total_calls_today": total_calls_today,
        "active_calls_now": active_calls,
        "total_minutes_today": round(total_minutes_today / 60, 2),
    })


@router.get("/health", response_model=ApiResponse)
async def admin_health(
    user: CurrentUser = Depends(superadmin),
    db: AsyncSession = Depends(get_db),
):
    """System health check."""
    health = {"database": False, "redis": False}

    # Check DB
    try:
        await db.execute(text("SELECT 1"))
        health["database"] = True
    except Exception:
        pass

    # Check Redis
    try:
        await redis_client.ping()
        health["redis"] = True
    except Exception:
        pass

    return ApiResponse(data=health)
