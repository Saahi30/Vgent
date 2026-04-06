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

# Cartesia voice defaults
CARTESIA_HINGLISH_VOICE = "95d51f79-c397-46f9-b49a-23763d3eaa2d"  # Arushi - Hinglish Speaker
CARTESIA_HINDI_VOICE = "faf0731e-dfb9-4cfc-8119-259a79b27e12"      # Riya - College Roommate (Hindi)
CARTESIA_ENGLISH_VOICE = "f786b574-daa5-4673-aa0c-cbe3e8534c02"    # Katie - Friendly Fixer (English)

# Injected at runtime into every agent session — not stored in DB
VOICE_INSTRUCTIONS = (
    "\n\nIMPORTANT voice call rules:"
    "\n- Keep responses under 2 sentences. Be concise."
    "\n- Match the caller's language — if they speak Hindi, reply in Hindi. If Hinglish, use Hinglish."
    "\n- Use natural Indian conversational markers (haan, accha, ji, theek hai)."
    "\n- Never use markdown, bullet points, or formatting — this is a voice call."
)


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
    """Build Deepgram STT with multilingual Hinglish support."""
    provider = agent_config.stt_provider
    api_key = _get_provider_key(provider) if provider else settings.deepgram_api_key

    return deepgram.STT(
        api_key=api_key,
        language="en",
        model="nova-3",
        interim_results=True,
        punctuate=True,
        smart_format=True,
        filler_words=True,
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
    """Build TTS: Sarvam (explicit) → Cartesia (always, human-sounding) → Deepgram (last resort)."""

    # 1. Explicit Sarvam provider configured on the agent
    if agent_config.tts_provider and agent_config.tts_provider.provider_name == "sarvam":
        from livekit.agents.tts import StreamAdapter
        from livekit.agents import tokenize
        from app.services.tts.sarvam_lk_plugin import SarvamLKTTS
        sarvam = SarvamLKTTS(
            api_key=_get_provider_key(agent_config.tts_provider) or settings.sarvam_api_key,
            voice=agent_config.voice_id or "meera",
        )
        return StreamAdapter(tts=sarvam, sentence_tokenizer=tokenize.basic.SentenceTokenizer())

    # 2. Sarvam TTS — natural Indian voices for Hindi/Hinglish callers
    if settings.sarvam_api_key:
        from livekit.agents.tts import StreamAdapter
        from livekit.agents import tokenize
        from app.services.tts.sarvam_lk_plugin import SarvamLKTTS
        voice = agent_config.voice_id or "anushka"  # Natural Hindi female voice
        sarvam = SarvamLKTTS(api_key=settings.sarvam_api_key, voice=voice)
        return StreamAdapter(tts=sarvam, sentence_tokenizer=tokenize.basic.SentenceTokenizer())

    # 3. Deepgram Aura — fallback if Sarvam not configured
    logger.warning("Sarvam not configured, falling back to Deepgram Aura TTS")
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
            instructions=agent_config.system_prompt + VOICE_INSTRUCTIONS,
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
