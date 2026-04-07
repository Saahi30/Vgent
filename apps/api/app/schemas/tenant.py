from pydantic import BaseModel, Field, EmailStr
from uuid import UUID
from datetime import datetime


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    plan: str = Field(default="free", pattern=r"^(free|starter|pro|enterprise)$")


class AdminTenantCreate(BaseModel):
    """Admin creates a tenant + owner user in one go."""
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    plan: str = Field(default="free", pattern=r"^(free|starter|pro|enterprise)$")
    max_agents: int = Field(default=3, ge=1)
    max_concurrent_calls: int = Field(default=2, ge=1)
    monthly_call_minutes_limit: int = Field(default=100, ge=0)
    allocated_minutes: int = Field(default=0, ge=0)
    allocated_dollars: float = Field(default=0, ge=0)
    monthly_spend_limit_usd: float = Field(default=0, ge=0)
    spending_limit_action: str = Field(default="pause", pattern=r"^(pause|block|warn)$")
    # Owner user details
    owner_email: EmailStr
    owner_password: str = Field(min_length=8)
    owner_name: str = Field(min_length=1, max_length=200)


class TenantUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    slug: str | None = Field(None, min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    plan: str | None = Field(None, pattern=r"^(free|starter|pro|enterprise)$")
    is_active: bool | None = None
    max_agents: int | None = Field(None, ge=1)
    max_concurrent_calls: int | None = Field(None, ge=1)
    monthly_call_minutes_limit: int | None = Field(None, ge=0)
    allocated_minutes: int | None = Field(None, ge=0)
    allocated_dollars: float | None = Field(None, ge=0)
    monthly_spend_limit_usd: float | None = Field(None, ge=0)
    spending_limit_action: str | None = Field(None, pattern=r"^(pause|block|warn)$")


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str
    is_active: bool
    status: str = "active"
    max_agents: int
    max_concurrent_calls: int
    monthly_call_minutes_limit: int
    monthly_spend_limit_usd: float = 0
    allocated_minutes: int = 0
    allocated_dollars: float = 0
    used_minutes: float = 0
    used_dollars: float = 0
    spending_limit_action: str = "pause"
    agents_count: int = 0
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}

    @classmethod
    def from_tenant(cls, tenant, agents_count: int = 0) -> "TenantResponse":
        resp = cls.model_validate(tenant)
        resp.status = "active" if tenant.is_active else "suspended"
        resp.agents_count = agents_count
        return resp
