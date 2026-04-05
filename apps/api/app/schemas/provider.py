from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class ProviderCredentialCreate(BaseModel):
    provider_type: str = Field(pattern=r"^(telephony|llm|stt|tts)$")
    provider_name: str = Field(min_length=1, max_length=50)
    credentials: dict  # Will be encrypted before storage
    is_default: bool = False
    label: str | None = None


class ProviderCredentialUpdate(BaseModel):
    credentials: dict | None = None
    is_default: bool | None = None
    label: str | None = None


class ProviderCredentialResponse(BaseModel):
    """Response schema — credentials are NEVER returned, only metadata."""
    id: UUID
    tenant_id: UUID
    provider_type: str
    provider_name: str
    is_default: bool
    label: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
