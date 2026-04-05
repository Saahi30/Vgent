from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class KnowledgeBaseUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None


class KnowledgeBaseResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KBDocumentResponse(BaseModel):
    id: UUID
    knowledge_base_id: UUID
    file_name: str | None
    content_type: str | None
    status: str
    chunk_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KBChunkResponse(BaseModel):
    id: UUID
    content: str
    chunk_index: int | None
    similarity: float | None = None

    model_config = {"from_attributes": True}
