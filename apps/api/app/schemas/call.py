from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import datetime

from app.schemas.contact import normalize_phone_number


class CallInitiate(BaseModel):
    agent_id: UUID
    to_number: str = Field(min_length=1)
    contact_id: UUID | None = None
    campaign_id: UUID | None = None
    metadata: dict = Field(default_factory=dict)

    @field_validator("to_number")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return normalize_phone_number(v)


class CallResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    agent_id: UUID
    campaign_id: UUID | None
    contact_id: UUID | None
    direction: str
    status: str
    telephony_provider: str | None
    telephony_call_id: str | None
    from_number: str | None
    to_number: str | None
    started_at: datetime | None
    answered_at: datetime | None
    ended_at: datetime | None
    duration_seconds: int | None
    recording_url: str | None
    llm_provider: str | None
    stt_provider: str | None
    tts_provider: str | None
    total_tokens_used: int
    cost_usd: float
    end_reason: str | None
    error_message: str | None
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class CallTurnResponse(BaseModel):
    id: UUID
    call_id: UUID
    role: str
    content: str
    timestamp_ms: int | None
    duration_ms: int | None
    confidence: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CallEventResponse(BaseModel):
    id: UUID
    call_id: UUID
    event_type: str
    payload: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class CallDetailResponse(BaseModel):
    call: CallResponse
    turns: list[CallTurnResponse]
    events: list[CallEventResponse]
