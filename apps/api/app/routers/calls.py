from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
import math

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.core.redis import register_active_call, get_active_calls_for_tenant
from app.models.call import Call, CallTurn, CallEvent
from app.models.agent import Agent
from app.schemas.call import CallResponse, CallDetailResponse, CallTurnResponse, CallEventResponse, CallInitiate
from app.schemas.common import ApiResponse, PaginatedResponse

router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("", response_model=PaginatedResponse[CallResponse])
async def list_calls(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    agent_id: UUID | None = None,
    campaign_id: UUID | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Call).where(Call.tenant_id == user.tenant_id)
    count_query = select(func.count()).select_from(Call).where(Call.tenant_id == user.tenant_id)

    if status:
        query = query.where(Call.status == status)
        count_query = count_query.where(Call.status == status)
    if agent_id:
        query = query.where(Call.agent_id == agent_id)
        count_query = count_query.where(Call.agent_id == agent_id)
    if campaign_id:
        query = query.where(Call.campaign_id == campaign_id)
        count_query = count_query.where(Call.campaign_id == campaign_id)

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


@router.get("/{call_id}", response_model=ApiResponse[CallDetailResponse])
async def get_call_detail(
    call_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Call).where(Call.id == call_id, Call.tenant_id == user.tenant_id)
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Fetch turns and events
    turns_result = await db.execute(
        select(CallTurn).where(CallTurn.call_id == call_id).order_by(CallTurn.created_at)
    )
    turns = turns_result.scalars().all()

    events_result = await db.execute(
        select(CallEvent).where(CallEvent.call_id == call_id).order_by(CallEvent.created_at)
    )
    events = events_result.scalars().all()

    return ApiResponse(data=CallDetailResponse(
        call=CallResponse.model_validate(call),
        turns=[CallTurnResponse.model_validate(t) for t in turns],
        events=[CallEventResponse.model_validate(e) for e in events],
    ))


@router.get("/active", response_model=ApiResponse)
async def get_active_calls(
    user: CurrentUser = Depends(get_current_user),
):
    """Get all currently active calls for the user's tenant (from Redis)."""
    calls = await get_active_calls_for_tenant(str(user.tenant_id))
    return ApiResponse(data=calls)


@router.post("/initiate", response_model=ApiResponse[CallResponse], status_code=201)
async def initiate_call(
    body: CallInitiate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate an outbound call.

    Creates a call record, then triggers the telephony provider to dial out
    via LiveKit. The agent worker will automatically join the room and
    start the STT → LLM → TTS pipeline.
    """
    from sqlalchemy.orm import selectinload

    # Fetch agent with provider relationships
    result = await db.execute(
        select(Agent).where(
            Agent.id == body.agent_id,
            Agent.tenant_id == user.tenant_id,
        ).options(
            selectinload(Agent.telephony_provider),
            selectinload(Agent.llm_provider),
            selectinload(Agent.stt_provider),
            selectinload(Agent.tts_provider),
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not agent.is_active:
        raise HTTPException(status_code=400, detail="Agent is deactivated")

    # Check DNC list
    if body.contact_id:
        from app.models.contact import Contact as ContactModel
        contact = (await db.execute(
            select(ContactModel).where(ContactModel.id == body.contact_id)
        )).scalar_one_or_none()
        if contact and contact.do_not_call:
            raise HTTPException(status_code=400, detail="Contact is on Do Not Call list")

    # Create call record
    call = Call(
        tenant_id=user.tenant_id,
        agent_id=body.agent_id,
        contact_id=body.contact_id,
        campaign_id=body.campaign_id,
        direction="outbound",
        status="initiated",
        to_number=body.to_number,
        llm_provider=agent.llm_provider.provider_name if agent.llm_provider else "groq",
        stt_provider=agent.stt_provider.provider_name if agent.stt_provider else "deepgram",
        tts_provider=agent.tts_provider.provider_name if agent.tts_provider else "edge_tts",
    )
    db.add(call)
    await db.flush()

    call_id = str(call.id)

    # Determine telephony provider and initiate
    from app.services.telephony.registry import get_telephony_provider
    provider_name = agent.telephony_provider.provider_name if agent.telephony_provider else "vobiz"

    try:
        provider = get_telephony_provider(provider_name)
        call_info = await provider.initiate_call(
            to=body.to_number,
            room_name=f"call-{call_id}",
        )

        call.telephony_provider = provider_name
        call.telephony_call_id = call_info.call_id
        call.status = "ringing"
        await db.flush()

        await register_active_call(call_id, str(user.tenant_id), {
            "to_number": body.to_number,
            "agent_id": str(body.agent_id),
            "agent_name": agent.name,
            "provider": provider_name,
            "status": "ringing",
        })

    except Exception as e:
        call.status = "failed"
        call.error_message = str(e)
        call.end_reason = "error"
        await db.flush()
        raise HTTPException(status_code=502, detail=f"Failed to initiate call: {str(e)}")

    # The LiveKit agent worker will detect the new room and join automatically

    return ApiResponse(data=CallResponse.model_validate(call))


@router.post("/{call_id}/hangup", response_model=ApiResponse)
async def hangup_call(
    call_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hang up an active call."""
    from app.services.telephony.registry import get_telephony_provider

    result = await db.execute(
        select(Call).where(Call.id == call_id, Call.tenant_id == user.tenant_id)
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    if call.status not in ("initiated", "ringing", "in_progress"):
        raise HTTPException(status_code=400, detail=f"Call is already {call.status}")

    try:
        provider = get_telephony_provider(call.telephony_provider or "vobiz")
        hung_up = await provider.hangup_call(call.telephony_call_id or str(call_id))

        from datetime import datetime, timezone
        call.status = "completed"
        call.ended_at = datetime.now(timezone.utc)
        call.end_reason = "hangup"
        if call.started_at:
            call.duration_seconds = int((call.ended_at - call.started_at).total_seconds())
        await db.flush()

        return ApiResponse(data={"hung_up": hung_up, "call_id": str(call_id)})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to hang up: {str(e)}")


@router.post("/test-call", response_model=ApiResponse)
async def test_call_webrtc(
    body: CallInitiate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a WebRTC test call — returns a LiveKit token for the browser to join.

    The browser connects to LiveKit using this token and speaks directly
    to the AI agent. No real phone call is made.
    """
    from app.services.telephony.webrtc_provider import WebRTCProvider
    from app.core.config import get_settings

    settings = get_settings()

    # Create call record
    call = Call(
        tenant_id=user.tenant_id,
        agent_id=body.agent_id,
        direction="outbound",
        status="initiated",
        to_number="webrtc-test",
        telephony_provider="webrtc",
    )
    db.add(call)
    await db.flush()

    call_id = str(call.id)
    room_name = f"call-{call_id}"

    # Create WebRTC provider and initiate (creates LiveKit room)
    provider = WebRTCProvider(
        livekit_url=settings.livekit_url,
        livekit_api_key=settings.livekit_api_key,
        livekit_api_secret=settings.livekit_api_secret,
    )
    await provider.initiate_call(room_name=room_name)

    # Generate token for the browser user
    browser_token = provider.generate_token(room_name, f"user-{user.id}")

    call.telephony_call_id = room_name
    call.status = "ringing"
    await db.flush()

    await register_active_call(call_id, str(user.tenant_id), {
        "to_number": "webrtc-test",
        "agent_id": str(body.agent_id),
        "agent_name": "Test Call",
        "provider": "webrtc",
        "status": "ringing",
        "room_name": room_name,
    })

    return ApiResponse(data={
        "call_id": call_id,
        "room_name": room_name,
        "livekit_url": settings.livekit_url,
        "token": browser_token,
    })
