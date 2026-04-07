from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
import math
import csv
import io
import logging

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.models.call import Call
from app.models.campaign import Campaign, CampaignContact
from app.models.contact import Contact
from app.models.agent import Agent
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignResponse, CampaignContactResponse
from app.schemas.common import ApiResponse, PaginatedResponse
from app.services.spending_limiter import check_spending_limit
from app.services import bolna_client

logger = logging.getLogger(__name__)

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

    # ── Spending limit check ──
    spending = await check_spending_limit(db, user.tenant_id)
    if not spending.can_proceed:
        raise HTTPException(status_code=402, detail=spending.warning or "Spending limit exceeded")

    # ── Bolna batch execution (if agent has a bolna_agent_id) ──
    agent_result = await db.execute(select(Agent).where(Agent.id == campaign.agent_id))
    agent = agent_result.scalar_one_or_none()

    if agent and agent.bolna_agent_id and not campaign.bolna_batch_id:
        # Build CSV from campaign contacts
        contacts_result = await db.execute(
            select(CampaignContact, Contact).join(
                Contact, CampaignContact.contact_id == Contact.id
            ).where(
                CampaignContact.campaign_id == campaign.id,
                CampaignContact.status == "pending",
            )
        )
        rows = contacts_result.all()

        if rows:
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(["contact_number", "first_name", "last_name"])
            for cc, contact in rows:
                writer.writerow([
                    contact.phone_number,
                    contact.first_name or "",
                    contact.last_name or "",
                ])
            csv_bytes = buf.getvalue().encode("utf-8")

            try:
                # Create batch on Bolna
                batch = await bolna_client.create_batch(
                    agent_id=agent.bolna_agent_id,
                    csv_file=csv_bytes,
                    filename=f"campaign_{campaign.id}.csv",
                )
                batch_id = batch.get("batch_id") or batch.get("id")
                if batch_id:
                    campaign.bolna_batch_id = str(batch_id)
                    campaign.bolna_batch_status = "created"
                    await db.flush()

                    # Schedule it to run immediately
                    await bolna_client.schedule_batch(batch_id)
                    campaign.bolna_batch_status = "scheduled"
            except Exception as e:
                logger.error(f"Failed to create Bolna batch for campaign {campaign.id}: {e}")
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to start campaign via Bolna: {str(e)}"
                )

    campaign.status = "running"
    await db.flush()

    resp = CampaignResponse.model_validate(campaign)
    if spending.warning:
        resp_data = resp.model_dump()
        resp_data["spending_warning"] = spending.warning
        return ApiResponse(data=resp_data)

    return ApiResponse(data=resp)


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

    # Stop the Bolna batch if it exists
    if campaign.bolna_batch_id:
        try:
            await bolna_client.stop_batch(campaign.bolna_batch_id)
            campaign.bolna_batch_status = "stopped"
        except Exception as e:
            logger.warning(f"Failed to stop Bolna batch {campaign.bolna_batch_id}: {e}")

    campaign.status = "paused"
    await db.flush()
    return ApiResponse(data=CampaignResponse.model_validate(campaign))


@router.post("/{campaign_id}/contacts", response_model=ApiResponse, status_code=201)
async def add_contacts_to_campaign(
    campaign_id: UUID,
    contact_ids: list[UUID],
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add contacts to an existing campaign. Skips duplicates and DNC contacts."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot add contacts to a completed campaign")

    # Get existing contact IDs in this campaign
    existing = (await db.execute(
        select(CampaignContact.contact_id).where(CampaignContact.campaign_id == campaign_id)
    )).scalars().all()
    existing_set = set(existing)

    added = 0
    skipped = 0
    for contact_id in contact_ids:
        if contact_id in existing_set:
            skipped += 1
            continue

        contact = (await db.execute(
            select(Contact).where(Contact.id == contact_id, Contact.tenant_id == user.tenant_id)
        )).scalar_one_or_none()
        if not contact:
            skipped += 1
            continue

        cc = CampaignContact(
            campaign_id=campaign.id,
            contact_id=contact_id,
            tenant_id=user.tenant_id,
            status="do_not_call" if contact.do_not_call else "pending",
        )
        db.add(cc)
        added += 1
        existing_set.add(contact_id)

    campaign.total_contacts = (campaign.total_contacts or 0) + added
    await db.flush()

    return ApiResponse(data={"added": added, "skipped": skipped})


@router.get("/{campaign_id}/stats", response_model=ApiResponse)
async def get_campaign_stats(
    campaign_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed campaign statistics with contact status breakdown."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Contact status breakdown
    status_result = await db.execute(
        select(CampaignContact.status, func.count()).where(
            CampaignContact.campaign_id == campaign_id
        ).group_by(CampaignContact.status)
    )
    status_breakdown = {row[0]: row[1] for row in status_result.all()}

    total = sum(status_breakdown.values())
    completed = status_breakdown.get("completed", 0)

    # Call outcome breakdown (only for calls linked to this campaign)
    outcome_result = await db.execute(
        select(Call.outcome, func.count()).where(
            Call.campaign_id == campaign_id,
            Call.outcome.isnot(None),
        ).group_by(Call.outcome)
    )
    outcome_breakdown = {row[0]: row[1] for row in outcome_result.all()}

    return ApiResponse(data={
        "campaign_id": str(campaign.id),
        "status": campaign.status,
        "total_contacts": total,
        "contact_status_breakdown": status_breakdown,
        "outcome_breakdown": outcome_breakdown,
        "completed_calls": campaign.completed_calls or 0,
        "failed_calls": campaign.failed_calls or 0,
        "success_rate": round(completed / total * 100, 1) if total > 0 else 0,
    })


@router.get("/{campaign_id}/contacts", response_model=PaginatedResponse[CampaignContactResponse])
async def list_campaign_contacts(
    campaign_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    outcome: str | None = None,
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
    if outcome:
        query = query.join(Call, CampaignContact.call_id == Call.id).where(Call.outcome == outcome)
        count_query = count_query.join(Call, CampaignContact.call_id == Call.id).where(Call.outcome == outcome)

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
