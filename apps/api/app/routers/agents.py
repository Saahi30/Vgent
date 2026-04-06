from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
import math

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.models.agent import Agent
from app.models.tenant import Tenant
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse
from app.schemas.common import ApiResponse, PaginatedResponse

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=PaginatedResponse[AgentResponse])
async def list_agents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: bool | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Agent).where(Agent.tenant_id == user.tenant_id)
    count_query = select(func.count()).select_from(Agent).where(Agent.tenant_id == user.tenant_id)

    if is_active is not None:
        query = query.where(Agent.is_active == is_active)
        count_query = count_query.where(Agent.is_active == is_active)

    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Agent.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    agents = result.scalars().all()

    return PaginatedResponse(
        data=[AgentResponse.model_validate(a) for a in agents],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("", response_model=ApiResponse[AgentResponse], status_code=201)
async def create_agent(
    body: AgentCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check agent limit
    count = (await db.execute(
        select(func.count()).select_from(Agent).where(Agent.tenant_id == user.tenant_id)
    )).scalar() or 0

    tenant = (await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))).scalar_one()
    if count >= tenant.max_agents:
        raise HTTPException(status_code=403, detail=f"Agent limit reached ({tenant.max_agents})")

    agent = Agent(
        tenant_id=user.tenant_id,
        **body.model_dump(),
    )
    db.add(agent)
    await db.flush()

    return ApiResponse(data=AgentResponse.model_validate(agent))


@router.get("/{agent_id}", response_model=ApiResponse[AgentResponse])
async def get_agent(
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.tenant_id == user.tenant_id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return ApiResponse(data=AgentResponse.model_validate(agent))


@router.patch("/{agent_id}", response_model=ApiResponse[AgentResponse])
async def update_agent(
    agent_id: UUID,
    body: AgentUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.tenant_id == user.tenant_id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(agent, key, value)

    await db.flush()
    return ApiResponse(data=AgentResponse.model_validate(agent))


@router.post("/{agent_id}/duplicate", response_model=ApiResponse[AgentResponse], status_code=201)
async def duplicate_agent(
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Duplicate an agent with all its configuration. The copy is named '{original} (Copy)'."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.tenant_id == user.tenant_id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Check agent limit
    count = (await db.execute(
        select(func.count()).select_from(Agent).where(Agent.tenant_id == user.tenant_id)
    )).scalar() or 0
    tenant = (await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))).scalar_one()
    if count >= tenant.max_agents:
        raise HTTPException(status_code=403, detail=f"Agent limit reached ({tenant.max_agents})")

    # Copy all fields except id, created_at, updated_at
    clone = Agent(
        tenant_id=user.tenant_id,
        name=f"{agent.name} (Copy)",
        description=agent.description,
        is_active=True,
        telephony_provider_id=agent.telephony_provider_id,
        llm_provider_id=agent.llm_provider_id,
        stt_provider_id=agent.stt_provider_id,
        tts_provider_id=agent.tts_provider_id,
        system_prompt=agent.system_prompt,
        llm_model=agent.llm_model,
        llm_temperature=agent.llm_temperature,
        llm_max_tokens=agent.llm_max_tokens,
        llm_extra_params=agent.llm_extra_params or {},
        voice_id=agent.voice_id,
        voice_speed=agent.voice_speed,
        voice_stability=agent.voice_stability,
        first_message=agent.first_message,
        end_call_phrases=agent.end_call_phrases,
        max_call_duration_seconds=agent.max_call_duration_seconds,
        silence_timeout_seconds=agent.silence_timeout_seconds,
        interrupt_on_user_speech=agent.interrupt_on_user_speech,
        language=agent.language,
        knowledge_base_enabled=agent.knowledge_base_enabled,
        knowledge_base_id=agent.knowledge_base_id,
        webhook_url=agent.webhook_url,
        webhook_events=agent.webhook_events,
        metadata_=agent.metadata_ or {},
    )
    db.add(clone)
    await db.flush()

    return ApiResponse(data=AgentResponse.model_validate(clone))


@router.delete("/{agent_id}", response_model=ApiResponse)
async def delete_agent(
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.tenant_id == user.tenant_id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await db.delete(agent)
    await db.flush()
    return ApiResponse(data={"deleted": True})
