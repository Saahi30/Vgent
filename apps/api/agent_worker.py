"""
Vgent LiveKit Agent Worker

This runs as a separate process alongside the FastAPI server.
It connects to LiveKit and automatically joins rooms when calls are created.

Run with:
    cd apps/api && source .venv/bin/activate
    python agent_worker.py
"""

import asyncio
import logging
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv("../../.env.local")

from livekit import api as livekit_api, rtc
from app.core.config import get_settings
from app.services.livekit_agent import run_agent_for_room

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("vgent.worker")

settings = get_settings()


async def monitor_rooms():
    """Poll LiveKit for active rooms and join ones that need an agent.

    In production, this would use LiveKit webhooks instead of polling.
    For local dev, polling every 2 seconds works fine.
    """
    lk = livekit_api.LiveKitAPI(
        url=settings.livekit_url.replace("wss://", "https://"),
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    )

    active_agents: dict[str, asyncio.Task] = {}

    logger.info(f"Agent worker started. Monitoring LiveKit at {settings.livekit_url}")
    logger.info("Waiting for calls...")

    while True:
        try:
            rooms = await lk.room.list_rooms(livekit_api.ListRoomsRequest())

            for room in rooms.rooms:
                room_name = room.name

                # Only handle call rooms
                if not room_name.startswith("call-") and not room_name.startswith("test-"):
                    continue

                # Skip if we already have an agent in this room
                if room_name in active_agents:
                    task = active_agents[room_name]
                    if not task.done():
                        continue
                    else:
                        # Clean up finished task
                        del active_agents[room_name]

                # Check if there's already an agent participant
                participants = await lk.room.list_participants(
                    livekit_api.ListParticipantsRequest(room=room_name)
                )
                has_agent = any(
                    p.identity.startswith("agent-")
                    for p in participants.participants
                )

                if not has_agent:
                    logger.info(f"New room detected: {room_name} — launching agent")
                    task = asyncio.create_task(run_agent_for_room(room_name))
                    active_agents[room_name] = task

            # Clean up finished tasks
            finished = [name for name, task in active_agents.items() if task.done()]
            for name in finished:
                task = active_agents.pop(name)
                if task.exception():
                    logger.error(f"Agent for {name} failed: {task.exception()}")
                else:
                    logger.info(f"Agent for {name} finished")

        except Exception as e:
            logger.error(f"Error monitoring rooms: {e}")

        await asyncio.sleep(2)


if __name__ == "__main__":
    if not settings.livekit_url or not settings.livekit_api_key:
        logger.error("LIVEKIT_URL and LIVEKIT_API_KEY must be set in .env.local")
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
