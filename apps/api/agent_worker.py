"""
Vgent LiveKit Agent Worker

Polls LiveKit for new call rooms and launches the voice AI pipeline.
Uses livekit-agents framework for STT/LLM/TTS but with manual room polling
(LiveKit Cloud agent dispatch requires project-level configuration).

Run with:
    cd apps/api && source .venv/bin/activate
    python agent_worker.py
"""

import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv("../../.env.local")

from livekit import api as livekit_api, rtc
from livekit.agents import (
    AgentSession,
    RoomInputOptions,
    TurnHandlingOptions,
    EndpointingOptions,
    InterruptionOptions,
)
from livekit.plugins import deepgram, silero, noise_cancellation

from app.core.config import get_settings
from app.services.livekit_agent import (
    VgentAgent,
    build_stt,
    build_llm,
    build_tts,
)
from app.models.call import Call, CallTurn
from app.models.agent import Agent as AgentModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("vgent.worker")

settings = get_settings()


# ── DB helpers (worker-local, fresh connections) ────────────

async def _get_db():
    """Create a fresh DB engine + session factory for the worker's event loop."""
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession as AS
    from sqlalchemy.orm import sessionmaker
    engine = create_async_engine(settings.database_url, pool_size=2)
    factory = sessionmaker(engine, class_=AS, expire_on_commit=False)
    return engine, factory


async def _get_call_and_agent(session_factory, call_id: str):
    from uuid import UUID
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select

    call_uuid = UUID(call_id)
    async with session_factory() as db:
        call = (await db.execute(select(Call).where(Call.id == call_uuid))).scalar_one_or_none()
        if not call:
            return None
        agent = (await db.execute(
            select(AgentModel).where(AgentModel.id == call.agent_id).options(
                selectinload(AgentModel.llm_provider),
                selectinload(AgentModel.stt_provider),
                selectinload(AgentModel.tts_provider),
            )
        )).scalar_one_or_none()
        if not agent:
            return None
    return call, agent


async def _update_call(session_factory, call_id: str, **kwargs):
    from uuid import UUID
    async with session_factory() as db:
        call = await db.get(Call, UUID(call_id))
        if call:
            for key, value in kwargs.items():
                if hasattr(call, key):
                    setattr(call, key, value)
            await db.commit()


async def _save_turn(session_factory, call_id: str, tenant_id: str, role: str, content: str, elapsed_ms: int):
    async with session_factory() as db:
        db.add(CallTurn(call_id=call_id, tenant_id=tenant_id, role=role, content=content, timestamp_ms=elapsed_ms))
        await db.commit()


# ── Agent runner ────────────────────────────────────────────

async def run_agent_for_room(room_name: str, engine, session_factory):
    """Connect to a LiveKit room and run the full voice AI pipeline."""
    call_id = room_name.replace("call-", "").replace("test-", "")

    result = await _get_call_and_agent(session_factory, call_id)
    if not result:
        logger.error(f"No call/agent found for room {room_name}")
        return

    call, agent_config = result
    from datetime import datetime, timezone
    call_start = datetime.now(timezone.utc)

    await _update_call(session_factory, call_id, status="in_progress", answered_at=call_start)

    # Shared HTTP session for plugins (needed outside livekit-agents worker context)
    import aiohttp
    http_session = aiohttp.ClientSession()

    # Build pipeline
    stt_instance = build_stt(agent_config, http_session=http_session)
    llm_instance = build_llm(agent_config)
    tts_instance = build_tts(agent_config, http_session=http_session)

    vad_instance = silero.VAD.load(
        min_speech_duration=0.15,
        min_silence_duration=0.35,
        prefix_padding_duration=0.3,
        activation_threshold=0.55,
        sample_rate=16000,
    )

    session = AgentSession(
        stt=stt_instance,
        llm=llm_instance,
        tts=tts_instance,
        vad=vad_instance,
        turn_handling=TurnHandlingOptions(
            endpointing=EndpointingOptions(
                mode="dynamic",
                min_delay=0.3,
                max_delay=1.5,
            ),
            interruption=InterruptionOptions(
                enabled=True,
                mode="adaptive",
                min_duration=0.4,
                min_words=1,
                resume_false_interruption=True,
                false_interruption_timeout=1.5,
            ),
        ),
        preemptive_generation=True,
        aec_warmup_duration=0.0,
    )

    # Log user speech
    @session.on("user_input_transcribed")
    def on_user_speech(event):
        if event.is_final and event.transcript.strip():
            elapsed_ms = int((datetime.now(timezone.utc) - call_start).total_seconds() * 1000)
            asyncio.create_task(_save_turn(
                session_factory, call_id, str(agent_config.tenant_id),
                "user", event.transcript, elapsed_ms,
            ))

    agent = VgentAgent(call_id, agent_config, call_start, session_factory=session_factory)

    # Connect to room
    lk_room = rtc.Room()
    token = livekit_api.AccessToken(
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    )
    import uuid
    token.with_identity(f"agent-{uuid.uuid4().hex[:8]}")
    token.with_name("Vgent Agent")
    token.with_grants(livekit_api.VideoGrants(room_join=True, room=room_name))

    await lk_room.connect(settings.livekit_url, token.to_jwt())
    logger.info(f"Agent connected to room {room_name}")

    try:
        nc = noise_cancellation.BVCTelephony()
        await session.start(
            agent, room=lk_room,
            room_input_options=RoomInputOptions(noise_cancellation=nc),
        )
        logger.info(f"Agent session started in room {room_name}")

        # Wait for disconnect
        disconnect_event = asyncio.Event()

        @lk_room.on("disconnected")
        def on_disconnect(*args):
            disconnect_event.set()

        try:
            await asyncio.wait_for(
                disconnect_event.wait(),
                timeout=agent_config.max_call_duration_seconds,
            )
        except asyncio.TimeoutError:
            logger.info(f"Max duration reached for {room_name}")

    except Exception as e:
        logger.error(f"Agent error in {room_name}: {e}")
    finally:
        end_time = datetime.now(timezone.utc)
        duration = int((end_time - call_start).total_seconds())
        await _update_call(
            session_factory, call_id,
            status="completed", ended_at=end_time,
            end_reason="completed", duration_seconds=duration,
        )
        await session.aclose()
        await lk_room.disconnect()
        await http_session.close()
        logger.info(f"Agent finished {room_name} (duration: {duration}s)")


# ── Room polling monitor ────────────────────────────────────

async def monitor_rooms():
    """Poll LiveKit for active rooms and join ones that need an agent."""
    lk = livekit_api.LiveKitAPI(
        url=settings.livekit_url.replace("wss://", "https://"),
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    )

    engine, session_factory = await _get_db()
    active_agents: dict[str, asyncio.Task] = {}

    logger.info("Monitoring LiveKit for new call rooms...")

    while True:
        try:
            rooms = await lk.room.list_rooms(livekit_api.ListRoomsRequest())

            for room in rooms.rooms:
                name = room.name
                if not name.startswith("call-") and not name.startswith("test-"):
                    continue

                # Skip if already handling
                if name in active_agents:
                    task = active_agents[name]
                    if not task.done():
                        continue
                    del active_agents[name]

                # Skip if agent already in room
                participants = await lk.room.list_participants(
                    livekit_api.ListParticipantsRequest(room=name)
                )
                has_agent = any(p.identity.startswith("agent-") for p in participants.participants)
                if has_agent:
                    continue

                logger.info(f"New room: {name} — launching agent")
                task = asyncio.create_task(run_agent_for_room(name, engine, session_factory))
                active_agents[name] = task

            # Clean finished tasks
            finished = [n for n, t in active_agents.items() if t.done()]
            for n in finished:
                task = active_agents.pop(n)
                if task.exception():
                    logger.error(f"Agent {n} crashed: {task.exception()}")

        except Exception as e:
            logger.error(f"Monitor error: {e}")

        await asyncio.sleep(2)


if __name__ == "__main__":
    if not settings.livekit_url or not settings.livekit_api_key:
        logger.error("LIVEKIT_URL and LIVEKIT_API_KEY must be set")
        sys.exit(1)

    logger.info("=" * 50)
    logger.info("  Vgent Agent Worker")
    logger.info("=" * 50)
    logger.info(f"  LiveKit: {settings.livekit_url}")
    logger.info(f"  Groq: {'configured' if settings.groq_api_key else 'NOT SET'}")
    logger.info(f"  Deepgram: {'configured' if settings.deepgram_api_key else 'NOT SET'}")
    logger.info(f"  Sarvam: {'configured' if settings.sarvam_api_key else 'NOT SET'}")
    logger.info(f"  Vobiz SIP: {'configured' if settings.vobiz_sip_trunk_id else 'NOT SET'}")
    logger.info("=" * 50)

    asyncio.run(monitor_rooms())
