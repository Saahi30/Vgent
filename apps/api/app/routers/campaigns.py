from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
import math

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.models.campaign import Campaign, CampaignContact
from app.models.contact import Contact
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignResponse, CampaignContactResponse
from app.schemas.common import ApiResponse, PaginatedResponse

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=PaginatedResponse[CampaignResponse])
async def list_campaigns(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Campaign).where(Campaign.tenant_id == user.tenant_id)
    count_query = select(func.count()).select_from(Campaign).where(Campaign.tenant_id == user.tenant_id)

    if status:
        query = query.where(Campaign.status == status)
        count_query = count_query.where(Campaign.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Campaign.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    campaigns = result.scalars().all()

    return PaginatedResponse(
        data=[CampaignResponse.model_validate(c) for c in campaigns],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("", response_model=ApiResponse[CampaignResponse], status_code=201)
async def create_campaign(
    body: CampaignCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Create campaign
    campaign_data = body.model_dump(exclude={"contact_ids"})
    campaign = Campaign(tenant_id=user.tenant_id, **campaign_data)
    db.add(campaign)
    await db.flush()

    # Add contacts to campaign
    if body.contact_ids:
        for contact_id in body.contact_ids:
            # Verify contact belongs to tenant
            contact = (await db.execute(
                select(Contact).where(Contact.id == contact_id, Contact.tenant_id == user.tenant_id)
            )).scalar_one_or_none()

            if contact:
                cc_status = "do_not_call" if contact.do_not_call else "pending"
                cc = CampaignContact(
                    campaign_id=campaign.id,
                    contact_id=contact_id,
                    tenant_id=user.tenant_id,
                    status=cc_status,
                )
                db.add(cc)

        campaign.total_contacts = len(body.contact_ids)
        await db.flush()

    return ApiResponse(data=CampaignResponse.model_validate(campaign))


@router.get("/{campaign_id}", response_model=ApiResponse[CampaignResponse])
async def get_campaign(
    campaign_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return ApiResponse(data=CampaignResponse.model_validate(campaign))


@router.patch("/{campaign_id}", response_model=ApiResponse[CampaignResponse])
async def update_campaign(
    campaign_id: UUID,
    body: CampaignUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)

    await db.flush()
    return ApiResponse(data=CampaignResponse.model_validate(campaign))


@router.delete("/{campaign_id}", response_model=ApiResponse)
async def delete_campaign(
    campaign_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status == "running":
        raise HTTPException(status_code=400, detail="Cannot delete a running campaign. Pause it first.")

    await db.delete(campaign)
    await db.flush()
    return ApiResponse(data={"deleted": True})


@router.post("/{campaign_id}/start", response_model=ApiResponse[CampaignResponse])
async def start_campaign(
    campaign_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status not in ("draft", "scheduled", "paused"):
        raise HTTPException(status_code=400, detail=f"Cannot start campaign in '{campaign.status}' status")

    campaign.status = "running"
    await db.flush()
    return ApiResponse(data=CampaignResponse.model_validate(campaign))


@router.post("/{campaign_id}/pause", response_model=ApiResponse[CampaignResponse])
async def pause_campaign(
    campaign_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status != "running":
        raise HTTPException(status_code=400, detail="Can only pause a running campaign")

    campaign.status = "paused"
    await db.flush()
    return ApiResponse(data=CampaignResponse.model_validate(campaign))


@router.get("/{campaign_id}/contacts", response_model=PaginatedResponse[CampaignContactResponse])
async def list_campaign_contacts(
    campaign_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(CampaignContact).where(
        CampaignContact.campaign_id == campaign_id,
        CampaignContact.tenant_id == user.tenant_id,
    )
    count_query = select(func.count()).select_from(CampaignContact).where(
        CampaignContact.campaign_id == campaign_id,
        CampaignContact.tenant_id == user.tenant_id,
    )

    if status:
        query = query.where(CampaignContact.status == status)
        count_query = count_query.where(CampaignContact.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(CampaignContact.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    contacts = result.scalars().all()

    return PaginatedResponse(
        data=[CampaignContactResponse.model_validate(c) for c in contacts],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )
