import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, Float, Text, DateTime, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Provider selection
    telephony_provider_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("provider_credentials.id", ondelete="SET NULL"))
    llm_provider_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("provider_credentials.id", ondelete="SET NULL"))
    stt_provider_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("provider_credentials.id", ondelete="SET NULL"))
    tts_provider_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("provider_credentials.id", ondelete="SET NULL"))

    # LLM config
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    llm_model: Mapped[str] = mapped_column(String(100), nullable=False)
    llm_temperature: Mapped[float] = mapped_column(Float, nullable=False, default=0.7)
    llm_max_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    llm_extra_params: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Voice config
    voice_id: Mapped[str | None] = mapped_column(Text)
    voice_speed: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    voice_stability: Mapped[float] = mapped_column(Float, nullable=False, default=0.75)

    # Engine config
    response_latency_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")  # fast, normal, relaxed
    endpointing_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=700)
    linear_delay_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=1200)
    interruption_words_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    user_online_detection: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    user_online_message: Mapped[str | None] = mapped_column(Text)
    user_online_timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=9)

    # Call behaviour
    first_message: Mapped[str | None] = mapped_column(Text)
    end_call_phrases: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    max_call_duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    silence_timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    interrupt_on_user_speech: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en-US")
    noise_cancellation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    voicemail_detection: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    keypad_input_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    final_call_message: Mapped[str | None] = mapped_column(Text)
    ambient_noise: Mapped[str] = mapped_column(String(50), nullable=False, default="none")

    # Knowledge base
    knowledge_base_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    knowledge_base_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="SET NULL"))

    # Bolna integration
    bolna_agent_id: Mapped[str | None] = mapped_column(Text)
    bolna_agent_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Webhooks
    webhook_url: Mapped[str | None] = mapped_column(Text)
    webhook_events: Mapped[list[str] | None] = mapped_column(ARRAY(Text))

    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    tenant = relationship("Tenant", back_populates="agents")
    telephony_provider = relationship("ProviderCredential", foreign_keys=[telephony_provider_id])
    llm_provider = relationship("ProviderCredential", foreign_keys=[llm_provider_id])
    stt_provider = relationship("ProviderCredential", foreign_keys=[stt_provider_id])
    tts_provider = relationship("ProviderCredential", foreign_keys=[tts_provider_id])
    knowledge_base = relationship("KnowledgeBase")
