"""
LiveKit Agent — Voice AI pipeline components.

Provides the Agent class and provider builders used by agent_worker.py.
The worker handles room connection; this module handles the AI logic.
"""

import logging
from datetime import datetime, timezone

from livekit.agents import Agent
from livekit.plugins import deepgram, openai as lk_openai

from app.core.config import get_settings
from app.core.database import async_session
from app.core.redis import publish_event, update_active_call, unregister_active_call
from app.models.call import Call, CallTurn, CallEvent
from app.models.agent import Agent as AgentModel
from app.core.security import decrypt_credentials

logger = logging.getLogger("vgent.agent")
settings = get_settings()


# ── DB helpers ──────────────────────────────────────────────

async def get_call_and_agent(call_id: str) -> tuple | None:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    async with async_session() as db:
        call = (await db.execute(
            select(Call).where(Call.id == call_id)
        )).scalar_one_or_none()
        if not call:
            return None

        agent = (await db.execute(
            select(AgentModel)
            .where(AgentModel.id == call.agent_id)
            .options(
                selectinload(AgentModel.llm_provider),
                selectinload(AgentModel.stt_provider),
                selectinload(AgentModel.tts_provider),
            )
        )).scalar_one_or_none()
        if not agent:
            return None

        return call, agent


async def save_turn(call_id: str, tenant_id: str, role: str, content: str, start_time: datetime):
    elapsed_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
    async with async_session() as db:
        db.add(CallTurn(
            call_id=call_id, tenant_id=tenant_id,
            role=role, content=content, timestamp_ms=elapsed_ms,
        ))
        await db.commit()
    await publish_event(f"call:{call_id}", {
        "event": "turn", "call_id": call_id,
        "role": role, "content": content, "timestamp_ms": elapsed_ms,
    })


async def emit_call_event(call_id: str, tenant_id: str, event_type: str, payload: dict = {}):
    async with async_session() as db:
        db.add(CallEvent(
            call_id=call_id, tenant_id=tenant_id,
            event_type=event_type, payload=payload,
        ))
        await db.commit()
    await publish_event(f"call:{call_id}", {
        "event": event_type, "call_id": call_id,
        "payload": payload, "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def update_call_status(call_id: str, status: str, **kwargs):
    async with async_session() as db:
        call = await db.get(Call, call_id)
        if call:
            call.status = status
            for key, value in kwargs.items():
                if hasattr(call, key):
                    setattr(call, key, value)
            await db.commit()


# ── Provider helpers ────────────────────────────────────────

def _get_provider_key(provider) -> str:
    if not provider:
        return ""
    creds = provider.credentials
    if "encrypted" in creds:
        decrypted = decrypt_credentials(creds["encrypted"])
        return decrypted.get("api_key", "")
    return creds.get("api_key", "")


def build_stt(agent_config: AgentModel):
    """Build a Deepgram STT instance."""
    provider = agent_config.stt_provider
    api_key = _get_provider_key(provider) if provider else settings.deepgram_api_key
    return deepgram.STT(
        api_key=api_key,
        language=agent_config.language or "en-US",
        model="nova-3",
        interim_results=True,
        punctuate=True,
    )


def build_llm(agent_config: AgentModel):
    """Build an LLM instance via openai-compatible plugin (works with Groq, etc.)."""
    provider = agent_config.llm_provider
    provider_name = provider.provider_name if provider else "groq"
    api_key = _get_provider_key(provider) if provider else settings.groq_api_key

    base_urls = {
        "groq": "https://api.groq.com/openai/v1",
        "google": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "mistral": "https://api.mistral.ai/v1",
        "together": "https://api.together.xyz/v1",
        "openai": None,
    }
    base_url = base_urls.get(provider_name, "https://api.groq.com/openai/v1")

    return lk_openai.LLM(
        model=agent_config.llm_model,
        api_key=api_key,
        base_url=base_url,
        temperature=agent_config.llm_temperature,
    )


def build_tts(agent_config: AgentModel):
    """Build a TTS instance. Uses Deepgram Aura (fast, streaming, reliable)."""
    return deepgram.TTS(
        api_key=settings.deepgram_api_key,
        model="aura-2-andromeda-en",
    )


# ── The Agent ───────────────────────────────────────────────

class VgentAgent(Agent):
    """Voice AI agent that runs inside a LiveKit AgentSession."""

    def __init__(self, call_id: str, agent_config: AgentModel, call_start: datetime,
                 session_factory=None):
        super().__init__(
            instructions=agent_config.system_prompt,
        )
        self.call_id = call_id
        self.agent_config = agent_config
        self.call_start = call_start
        self.tenant_id = str(agent_config.tenant_id)
        self._session_factory = session_factory

    async def on_enter(self):
        """Called when the agent session starts. Send the first message."""
        if self.agent_config.first_message:
            await self.session.say(self.agent_config.first_message)
            # Save turn using worker-local DB session if available
            if self._session_factory:
                from app.models.call import CallTurn
                elapsed_ms = int((datetime.now(timezone.utc) - self.call_start).total_seconds() * 1000)
                async with self._session_factory() as db:
                    db.add(CallTurn(
                        call_id=self.call_id, tenant_id=self.tenant_id,
                        role="assistant", content=self.agent_config.first_message,
                        timestamp_ms=elapsed_ms,
                    ))
                    await db.commit()
