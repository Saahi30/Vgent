"""
LiveKit Agent Worker — Joins LiveKit rooms and runs the voice AI pipeline.

This is the real-time audio processor. When a call is initiated:
1. A LiveKit room is created (by the telephony provider)
2. This agent worker detects the new room and joins it
3. It listens for audio from the participant (phone user or browser)
4. Runs: Audio → STT → LLM → TTS → Audio back to participant
5. Handles interrupts, silence, end-call detection

Uses LiveKit Agents framework for robust audio handling.
"""

import asyncio
import logging
import re
from datetime import datetime, timezone

from livekit import rtc, api as livekit_api
from livekit.agents import (
    AgentSession,
    Agent,
    RoomInputOptions,
    RunContext,
    function_tool,
    get_job_context,
)

from app.core.config import get_settings
from app.core.database import async_session
from app.core.redis import publish_event, update_active_call, unregister_active_call
from app.models.call import Call, CallTurn, CallEvent
from app.models.agent import Agent as AgentModel
from app.services.llm.registry import get_llm_provider
from app.services.stt.registry import get_stt_provider
from app.services.tts.registry import get_tts_provider
from app.core.security import decrypt_credentials

logger = logging.getLogger("vgent.agent")
settings = get_settings()


def get_agent_config_from_room_name(room_name: str) -> str | None:
    """Extract call_id from room name (format: call-{uuid})."""
    if room_name.startswith("call-") or room_name.startswith("test-"):
        return room_name.split("-", 1)[1] if "-" in room_name else None
    return None


async def get_call_and_agent(call_id: str) -> tuple | None:
    """Fetch call record and associated agent from DB."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    async with async_session() as db:
        result = await db.execute(
            select(Call).where(Call.id == call_id)
        )
        call = result.scalar_one_or_none()
        if not call:
            return None

        result = await db.execute(
            select(AgentModel)
            .where(AgentModel.id == call.agent_id)
            .options(
                selectinload(AgentModel.llm_provider),
                selectinload(AgentModel.stt_provider),
                selectinload(AgentModel.tts_provider),
            )
        )
        agent = result.scalar_one_or_none()
        if not agent:
            return None

        return call, agent


async def save_turn(call_id: str, tenant_id: str, role: str, content: str, start_time: datetime):
    """Save a conversation turn to DB and publish to Redis."""
    elapsed_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)

    async with async_session() as db:
        turn = CallTurn(
            call_id=call_id,
            tenant_id=tenant_id,
            role=role,
            content=content,
            timestamp_ms=elapsed_ms,
        )
        db.add(turn)
        await db.commit()

    await publish_event(f"call:{call_id}", {
        "event": "turn",
        "call_id": call_id,
        "role": role,
        "content": content,
        "timestamp_ms": elapsed_ms,
    })


async def emit_call_event(call_id: str, tenant_id: str, event_type: str, payload: dict = {}):
    """Save call event and publish to Redis."""
    async with async_session() as db:
        event = CallEvent(
            call_id=call_id,
            tenant_id=tenant_id,
            event_type=event_type,
            payload=payload,
        )
        db.add(event)
        await db.commit()

    await publish_event(f"call:{call_id}", {
        "event": event_type,
        "call_id": call_id,
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def update_call_status(call_id: str, status: str, **kwargs):
    """Update call record in DB."""
    async with async_session() as db:
        call = await db.get(Call, call_id)
        if call:
            call.status = status
            for key, value in kwargs.items():
                if hasattr(call, key):
                    setattr(call, key, value)
            await db.commit()


class VgentVoiceAgent:
    """Voice AI agent that processes audio in a LiveKit room.

    This is a simplified pipeline that works with LiveKit's audio tracks:
    1. Receive audio frames from participant
    2. Send to STT (Deepgram streaming)
    3. When utterance complete → send to LLM
    4. Stream LLM response → TTS
    5. Play TTS audio back to room
    """

    def __init__(self, call_id: str, agent_config: AgentModel, call_start: datetime):
        self.call_id = call_id
        self.agent_config = agent_config
        self.call_start = call_start
        self.conversation_history: list[dict] = []
        self.is_processing = False
        self.total_tokens = 0

        # Initialize providers
        self.llm = self._init_llm()
        self.stt = self._init_stt()
        self.tts = self._init_tts()

    def _get_provider_key(self, provider) -> str:
        """Extract API key from an encrypted provider credential."""
        if not provider:
            return ""
        creds = provider.credentials
        if "encrypted" in creds:
            decrypted = decrypt_credentials(creds["encrypted"])
            return decrypted.get("api_key", "")
        return creds.get("api_key", "")

    def _init_llm(self):
        provider = self.agent_config.llm_provider
        if not provider:
            # Default to Groq if no provider configured
            return get_llm_provider("groq", api_key=settings.groq_api_key)
        return get_llm_provider(provider.provider_name, api_key=self._get_provider_key(provider))

    def _init_stt(self):
        provider = self.agent_config.stt_provider
        if not provider:
            return get_stt_provider("deepgram", api_key=settings.deepgram_api_key)
        return get_stt_provider(provider.provider_name, api_key=self._get_provider_key(provider))

    def _init_tts(self):
        provider = self.agent_config.tts_provider
        if not provider:
            return get_tts_provider("edge_tts")
        return get_tts_provider(provider.provider_name, api_key=self._get_provider_key(provider))

    async def process_user_speech(self, transcript: str):
        """Process a complete user utterance through the LLM → TTS pipeline."""
        if not transcript.strip():
            return

        self.is_processing = True
        tenant_id = str(self.agent_config.tenant_id)

        # Save user turn
        await save_turn(self.call_id, tenant_id, "user", transcript, self.call_start)
        await emit_call_event(self.call_id, tenant_id, "user_speech", {"text": transcript})

        # Check for end-call phrases
        if self.agent_config.end_call_phrases:
            text_lower = transcript.lower()
            for phrase in self.agent_config.end_call_phrases:
                if phrase.lower() in text_lower:
                    await emit_call_event(self.call_id, tenant_id, "end_call_phrase_detected", {"phrase": phrase})
                    self.is_processing = False
                    return None  # Signal to end the call

        # Build conversation and call LLM
        self.conversation_history.append({"role": "user", "content": transcript})
        messages = [{"role": "system", "content": self.agent_config.system_prompt}] + self.conversation_history

        await emit_call_event(self.call_id, tenant_id, "llm_started", {"model": self.agent_config.llm_model})

        # Collect LLM response (streaming)
        full_response = ""
        async for chunk in self.llm.complete(
            messages=messages,
            model=self.agent_config.llm_model,
            temperature=self.agent_config.llm_temperature,
            max_tokens=self.agent_config.llm_max_tokens,
            stream=True,
        ):
            full_response += chunk

        self.total_tokens += self.llm.estimate_tokens(transcript + full_response)

        await emit_call_event(self.call_id, tenant_id, "llm_completed", {
            "response_length": len(full_response),
        })

        # Save assistant turn
        self.conversation_history.append({"role": "assistant", "content": full_response})
        await save_turn(self.call_id, tenant_id, "assistant", full_response, self.call_start)

        self.is_processing = False
        return full_response

    async def generate_tts_audio(self, text: str) -> bytes:
        """Convert text to audio bytes via TTS provider."""
        tenant_id = str(self.agent_config.tenant_id)
        await emit_call_event(self.call_id, tenant_id, "tts_started", {"text_length": len(text)})

        audio_chunks = []
        voice_id = self.agent_config.voice_id or ""

        async for chunk in self.tts.synthesize_stream(
            text=text,
            voice_id=voice_id,
            speed=self.agent_config.voice_speed,
        ):
            audio_chunks.append(chunk)

        await emit_call_event(self.call_id, tenant_id, "tts_completed", {})

        return b"".join(audio_chunks)

    def split_into_sentences(self, text: str) -> list[str]:
        """Split text into sentences for chunked TTS."""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]


async def run_agent_for_room(room_name: str):
    """Main entry point: connect to a LiveKit room and run the voice agent.

    This is called when a new room is detected (via webhook or polling).
    """
    call_id = room_name.replace("call-", "").replace("test-", "")

    result = await get_call_and_agent(call_id)
    if not result:
        logger.error(f"No call/agent found for room {room_name}")
        return

    call, agent_config = result
    call_start = datetime.now(timezone.utc)

    # Update call status
    await update_call_status(call_id, "in_progress", answered_at=call_start)
    await update_active_call(call_id, {"status": "in_progress"})
    await emit_call_event(call_id, str(agent_config.tenant_id), "agent_joined", {
        "room": room_name,
    })

    # Create voice agent
    voice_agent = VgentVoiceAgent(call_id, agent_config, call_start)

    # Connect to LiveKit room as the agent
    lk_room = rtc.Room()

    token = livekit_api.AccessToken(
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    )
    token.with_identity(f"agent-{call_id}")
    token.with_name("Vgent Agent")
    token.with_grants(livekit_api.VideoGrants(
        room_join=True,
        room=room_name,
    ))

    await lk_room.connect(settings.livekit_url, token.to_jwt())
    logger.info(f"Agent connected to room {room_name}")

    # Send first message if configured
    if agent_config.first_message:
        first_audio = await voice_agent.generate_tts_audio(agent_config.first_message)
        if first_audio:
            # Publish TTS audio to the room
            source = rtc.AudioSource(sample_rate=24000, num_channels=1)
            track = rtc.LocalAudioTrack.create_audio_track("agent-voice", source)
            await lk_room.local_participant.publish_track(track)
            # Send audio frames
            frame = rtc.AudioFrame(
                data=first_audio,
                sample_rate=24000,
                num_channels=1,
                samples_per_channel=len(first_audio) // 2,
            )
            await source.capture_frame(frame)

        await save_turn(
            call_id, str(agent_config.tenant_id),
            "assistant", agent_config.first_message, call_start,
        )
        voice_agent.conversation_history.append({
            "role": "assistant",
            "content": agent_config.first_message,
        })

    # The actual real-time audio processing loop would use LiveKit's
    # audio track subscription. For now we set up the structure.
    # Full implementation uses livekit-agents framework in the worker.

    logger.info(f"Agent ready in room {room_name}, waiting for audio...")

    # Keep alive until call ends
    try:
        while voice_agent.is_processing or lk_room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
            await asyncio.sleep(0.5)
    except asyncio.CancelledError:
        pass
    finally:
        # Clean up
        await update_call_status(
            call_id, "completed",
            ended_at=datetime.now(timezone.utc),
            end_reason="completed",
            total_tokens_used=voice_agent.total_tokens,
        )
        await unregister_active_call(call_id, str(agent_config.tenant_id))
        await emit_call_event(call_id, str(agent_config.tenant_id), "call_ended", {
            "reason": "completed",
            "total_tokens": voice_agent.total_tokens,
        })
        await lk_room.disconnect()
        logger.info(f"Agent disconnected from room {room_name}")
