from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class ContactCreate(BaseModel):
    phone_number: str = Field(min_length=1, max_length=20)
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    email: str | None = None
    metadata: dict = Field(default_factory=dict)
    do_not_call: bool = False


class ContactUpdate(BaseModel):
    phone_number: str | None = Field(None, min_length=1, max_length=20)
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
    metadata: dict
    do_not_call: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContactImportRow(BaseModel):
    phone_number: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    metadata: dict = Field(default_factory=dict)
