from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, time


class CampaignCreate(BaseModel):
    agent_id: UUID
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    scheduled_at: datetime | None = None
    timezone: str = Field(default="UTC", max_length=50)
    calling_hours_start: time = Field(default=time(9, 0))
    calling_hours_end: time = Field(default=time(18, 0))
    calling_days: list[int] = Field(default=[1, 2, 3, 4, 5])
    max_retries: int = Field(default=2, ge=0, le=10)
    retry_delay_minutes: int = Field(default=60, ge=1, le=1440)
    max_concurrent_calls: int = Field(default=1, ge=1, le=50)
    contact_ids: list[UUID] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class CampaignUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    status: str | None = Field(None, pattern=r"^(draft|scheduled|running|paused|completed|failed)$")
    scheduled_at: datetime | None = None
    timezone: str | None = None
    calling_hours_start: time | None = None
    calling_hours_end: time | None = None
    calling_days: list[int] | None = None
    max_retries: int | None = Field(None, ge=0, le=10)
    retry_delay_minutes: int | None = Field(None, ge=1, le=1440)
    max_concurrent_calls: int | None = Field(None, ge=1, le=50)
    metadata: dict | None = None


class CampaignResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    agent_id: UUID
    name: str
    description: str | None
    status: str
    scheduled_at: datetime | None
    timezone: str
    calling_hours_start: time
    calling_hours_end: time
    calling_days: list[int]
    max_retries: int
    retry_delay_minutes: int
    max_concurrent_calls: int
    total_contacts: int
    completed_calls: int
    failed_calls: int
    bolna_batch_id: str | None = None
    bolna_batch_status: str | None = None
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class CampaignContactResponse(BaseModel):
    id: UUID
    campaign_id: UUID
    contact_id: UUID
    status: str
    attempts: int
    last_attempted_at: datetime | None
    call_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
