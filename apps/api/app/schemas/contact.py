import re
from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import datetime


def normalize_phone_number(phone: str) -> str:
    """Normalize phone number to E.164 format, defaulting to +91 (India)."""
    phone = re.sub(r"[\s\-\(\)]+", "", phone.strip())
    if phone.startswith("+"):
        return phone
    # Strip leading 0 (local format)
    phone = phone.lstrip("0")
    return f"+91{phone}"


class ContactCreate(BaseModel):
    phone_number: str = Field(min_length=1, max_length=20)
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    email: str | None = None
    metadata: dict = Field(default_factory=dict)
    do_not_call: bool = False

    @field_validator("phone_number")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return normalize_phone_number(v)


class ContactUpdate(BaseModel):
    phone_number: str | None = Field(None, min_length=1, max_length=20)

    @field_validator("phone_number")
    @classmethod
    def normalize_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return normalize_phone_number(v)
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    metadata: dict | None = None
    do_not_call: bool | None = None


class ContactResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    phone_number: str
    first_name: str | None
    last_name: str | None
    email: str | None
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    do_not_call: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class ContactImportRow(BaseModel):
    phone_number: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    metadata: dict = Field(default_factory=dict)
