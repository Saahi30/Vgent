from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    plan: str = Field(default="free", pattern=r"^(free|starter|pro|enterprise)$")


class TenantUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    slug: str | None = Field(None, min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    plan: str | None = Field(None, pattern=r"^(free|starter|pro|enterprise)$")
    is_active: bool | None = None
    max_agents: int | None = Field(None, ge=1)
    max_concurrent_calls: int | None = Field(None, ge=1)
    monthly_call_minutes_limit: int | None = Field(None, ge=0)


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str
    is_active: bool
    max_agents: int
    max_concurrent_calls: int
    monthly_call_minutes_limit: int
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}
