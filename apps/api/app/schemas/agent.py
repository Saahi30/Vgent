from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None

    # Provider selection
    telephony_provider_id: UUID | None = None
    llm_provider_id: UUID | None = None
    stt_provider_id: UUID | None = None
    tts_provider_id: UUID | None = None

    # LLM config
    system_prompt: str = Field(min_length=1)
    llm_model: str = Field(min_length=1, max_length=100)
    llm_temperature: float = Field(default=0.7, ge=0, le=2)
    llm_max_tokens: int = Field(default=300, ge=1, le=4096)
    llm_extra_params: dict = Field(default_factory=dict)

    # Voice config
    voice_id: str | None = None
    voice_speed: float = Field(default=1.0, ge=0.25, le=4.0)
    voice_stability: float = Field(default=0.75, ge=0, le=1)

    # Call behaviour
    first_message: str | None = None
    end_call_phrases: list[str] = Field(default_factory=list)
    max_call_duration_seconds: int = Field(default=300, ge=30, le=3600)
    silence_timeout_seconds: int = Field(default=10, ge=3, le=60)
    interrupt_on_user_speech: bool = True
    language: str = Field(default="en-US", max_length=10)

    # Knowledge base
    knowledge_base_enabled: bool = False
    knowledge_base_id: UUID | None = None

    # Webhooks
    webhook_url: str | None = None
    webhook_events: list[str] = Field(default_factory=list)

    metadata: dict = Field(default_factory=dict)


class AgentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    is_active: bool | None = None

    telephony_provider_id: UUID | None = None
    llm_provider_id: UUID | None = None
    stt_provider_id: UUID | None = None
    tts_provider_id: UUID | None = None

    system_prompt: str | None = None
    llm_model: str | None = None
    llm_temperature: float | None = Field(None, ge=0, le=2)
    llm_max_tokens: int | None = Field(None, ge=1, le=4096)
    llm_extra_params: dict | None = None

    voice_id: str | None = None
    voice_speed: float | None = Field(None, ge=0.25, le=4.0)
    voice_stability: float | None = Field(None, ge=0, le=1)

    first_message: str | None = None
    end_call_phrases: list[str] | None = None
    max_call_duration_seconds: int | None = Field(None, ge=30, le=3600)
    silence_timeout_seconds: int | None = Field(None, ge=3, le=60)
    interrupt_on_user_speech: bool | None = None
    language: str | None = None

    knowledge_base_enabled: bool | None = None
    knowledge_base_id: UUID | None = None

    webhook_url: str | None = None
    webhook_events: list[str] | None = None
    metadata: dict | None = None


class AgentResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: str | None
    is_active: bool

    telephony_provider_id: UUID | None
    llm_provider_id: UUID | None
    stt_provider_id: UUID | None
    tts_provider_id: UUID | None

    system_prompt: str
    llm_model: str
    llm_temperature: float
    llm_max_tokens: int
    llm_extra_params: dict

    voice_id: str | None
    voice_speed: float
    voice_stability: float

    first_message: str | None
    end_call_phrases: list[str] | None
    max_call_duration_seconds: int
    silence_timeout_seconds: int
    interrupt_on_user_speech: bool
    language: str

    knowledge_base_enabled: bool
    knowledge_base_id: UUID | None

    webhook_url: str | None
    webhook_events: list[str] | None
    metadata: dict

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
