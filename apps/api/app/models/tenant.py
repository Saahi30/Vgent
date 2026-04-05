import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="free")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    max_agents: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    max_concurrent_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    monthly_call_minutes_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="tenant", lazy="selectin")
    agents = relationship("Agent", back_populates="tenant", lazy="selectin")
    provider_credentials = relationship("ProviderCredential", back_populates="tenant", lazy="selectin")
