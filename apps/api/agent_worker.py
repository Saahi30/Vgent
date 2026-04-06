"""
Vgent LiveKit Agent Worker

Uses the livekit-agents framework properly via WorkerOptions/AgentServer.
This ensures HTTP sessions, VAD, STT, LLM, TTS all run in the correct context.

Run with:
    cd apps/api && source .venv/bin/activate
    python agent_worker.py dev
"""

import logging
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv("../../.env.local")

from livekit.agents import (
    AgentSession,
    Agent,
    JobContext,
    JobRequest,
    WorkerOptions,
    cli,
)
from livekit.plugins import deepgram, openai as lk_openai, silero

from app.core.config import get_settings
from app.services.livekit_agent import (
    VgentAgent,
    build_stt,
    build_llm,
    build_tts,
)
from app.models.call import Call, CallTurn, CallEvent
from app.models.agent import Agent as AgentModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("vgent.worker")

settings = get_settings()


async def _get_call_and_agent(call_id: str):
    """Fetch call + agent from DB using a fresh session (worker runs in its own event loop)."""
    from uuid import UUID
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession as AS
    from sqlalchemy.orm import sessionmaker, selectinload
    from sqlalchemy import select

    engine = create_async_engine(settings.database_url, pool_size=2)
    session_factory = sessionmaker(engine, class_=AS, expire_on_commit=False)

    call_uuid = UUID(call_id)
    async with session_factory() as db:
        call = (await db.execute(select(Call).where(Call.id == call_uuid))).scalar_one_or_none()
        if not call:
            await engine.dispose()
            return None
        agent = (await db.execute(
            select(AgentModel).where(AgentModel.id == call.agent_id).options(
                selectinload(AgentModel.llm_provider),
                selectinload(AgentModel.stt_provider),
                selectinload(AgentModel.tts_provider),
            )
        )).scalar_one_or_none()
        if not agent:
            await engine.dispose()
            return None

    return call, agent, engine, session_factory


async def _update_call(session_factory, call_id: str, **kwargs):
    """Update call record using a worker-local DB session."""
    from uuid import UUID
    async with session_factory() as db:
        call = await db.get(Call, UUID(call_id))
        if call:
            for key, value in kwargs.items():
                if hasattr(call, key):
                    setattr(call, key, value)
            await db.commit()


async def _save_turn(session_factory, call_id: str, tenant_id: str, role: str, content: str, elapsed_ms: int):
    from sqlalchemy.ext.asyncio import AsyncSession as AS
    async with session_factory() as db:
        db.add(CallTurn(call_id=call_id, tenant_id=tenant_id, role=role, content=content, timestamp_ms=elapsed_ms))
        await db.commit()


async def entrypoint(ctx: JobContext):
    """Called by the livekit-agents framework when a new room needs an agent."""
    room_name = ctx.room.name
    call_id = room_name.replace("call-", "").replace("test-", "")

    logger.info(f"Agent entrypoint for room {room_name} (call_id={call_id})")

    result = await _get_call_and_agent(call_id)
    if not result:
        logger.error(f"No call/agent found for room {room_name}")
        return

    call, agent_config, engine, session_factory = result

    from datetime import datetime, timezone
    call_start = datetime.now(timezone.utc)

    await _update_call(session_factory, call_id, status="in_progress", answered_at=call_start)

    # Build pipeline components
    stt_instance = build_stt(agent_config)
    llm_instance = build_llm(agent_config)
    tts_instance = build_tts(agent_config)
    vad_instance = silero.VAD.load()

    # Create session
    session = AgentSession(
        stt=stt_instance,
        llm=llm_instance,
        tts=tts_instance,
        vad=vad_instance,
    )

    # Log user speech to DB
    @session.on("user_input_transcribed")
    def on_user_speech(event):
        import asyncio
        if event.is_final and event.transcript.strip():
            elapsed_ms = int((datetime.now(timezone.utc) - call_start).total_seconds() * 1000)
            asyncio.create_task(_save_turn(
                session_factory, call_id, str(agent_config.tenant_id),
                "user", event.transcript, elapsed_ms,
            ))

    # Create the agent
    agent = VgentAgent(call_id, agent_config, call_start, session_factory=session_factory)

    # Wait for the SIP participant to connect before starting the agent
    await ctx.connect()
    logger.info(f"Agent connected to room {room_name}, waiting for participant...")

    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}")

    # Start the agent session with the room from JobContext
    await session.start(agent, room=ctx.room)

    logger.info(f"Agent session started in room {room_name}")

    # Register shutdown cleanup
    @ctx.add_shutdown_callback
    async def on_shutdown():
        end_time = datetime.now(timezone.utc)
        duration = int((end_time - call_start).total_seconds())
        await _update_call(
            session_factory, call_id,
            status="completed",
            ended_at=end_time,
            end_reason="completed",
            duration_seconds=duration,
        )
        await engine.dispose()
        logger.info(f"Agent cleanup for {room_name} (duration: {duration}s)")


async def request_fnc(req: JobRequest):
    """Accept all jobs for rooms starting with 'call-' or 'test-'."""
    room_name = req.room.name
    if room_name.startswith("call-") or room_name.startswith("test-"):
        await req.accept()
    else:
        await req.reject()


if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("  Vgent Agent Worker")
    logger.info("=" * 50)
    logger.info(f"  LiveKit: {settings.livekit_url}")
    logger.info(f"  Groq: {'configured' if settings.groq_api_key else 'NOT SET'}")
    logger.info(f"  Deepgram: {'configured' if settings.deepgram_api_key else 'NOT SET'}")
    logger.info(f"  ElevenLabs: {'configured' if settings.elevenlabs_api_key else 'NOT SET'}")
    logger.info(f"  Vobiz SIP: {'configured' if settings.vobiz_sip_trunk_id else 'NOT SET'}")
    logger.info("=" * 50)

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,
            ws_url=settings.livekit_url,
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
            num_idle_processes=0,
        )
    )
