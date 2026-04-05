"""
Call Orchestrator — The heart of Vgent.

Manages the full lifecycle of an outbound AI voice call:
1. Initiate call via telephony provider (creates LiveKit room)
2. Agent joins the LiveKit room
3. Audio pipeline: STT → LLM → TTS runs in real-time
4. Tracks call events, turns, usage
5. Handles interrupts, silence timeouts, end-call phrases
6. On call end: save recording, compute cost, fire webhooks
"""

import uuid
import asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import async_session
from app.core.redis import publish_event, register_active_call, unregister_active_call, update_active_call
from app.models.call import Call, CallTurn, CallEvent
from app.models.agent import Agent
from app.services.telephony.registry import get_telephony_provider
from app.services.llm.registry import get_llm_provider
from app.services.stt.registry import get_stt_provider
from app.services.tts.registry import get_tts_provider
from app.services.usage_tracker import track_call_usage
from app.services.webhook_dispatcher import dispatch_webhook

settings = get_settings()


class CallOrchestrator:
    """Orchestrates a single outbound call."""

    def __init__(self, call_id: str, agent: Agent, db_session: AsyncSession):
        self.call_id = call_id
        self.agent = agent
        self.db = db_session
        self.conversation_history: list[dict] = []
        self.is_active = False
        self.call_start_time: datetime | None = None
        self.total_tokens = 0

    async def _emit_event(self, event_type: str, payload: dict = {}):
        """Save event to DB and publish to Redis for live monitoring."""
        event = CallEvent(
            call_id=self.call_id,
            tenant_id=self.agent.tenant_id,
            event_type=event_type,
            payload=payload,
        )
        self.db.add(event)
        await self.db.flush()

        await publish_event(f"call:{self.call_id}", {
            "event": event_type,
            "call_id": self.call_id,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def _save_turn(self, role: str, content: str, **kwargs):
        """Save a conversation turn to the database."""
        elapsed_ms = 0
        if self.call_start_time:
            elapsed_ms = int((datetime.now(timezone.utc) - self.call_start_time).total_seconds() * 1000)

        turn = CallTurn(
            call_id=self.call_id,
            tenant_id=self.agent.tenant_id,
            role=role,
            content=content,
            timestamp_ms=elapsed_ms,
            **kwargs,
        )
        self.db.add(turn)
        await self.db.flush()

        self.conversation_history.append({"role": role, "content": content})

        # Publish turn for live transcript
        await publish_event(f"call:{self.call_id}", {
            "event": "turn",
            "call_id": self.call_id,
            "role": role,
            "content": content,
            "timestamp_ms": elapsed_ms,
        })

    def _build_messages(self, rag_context: str = "") -> list[dict]:
        """Build the full message list for the LLM.

        If the agent has a knowledge base and rag_context is provided,
        it is appended to the system prompt so the LLM can reference it.
        """
        system_prompt = self.agent.system_prompt
        if rag_context:
            system_prompt += (
                "\n\nUse the following knowledge base information to answer questions. "
                "Only reference this information when relevant to the conversation.\n\n"
                + rag_context
            )

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(self.conversation_history)
        return messages

    async def get_rag_context(self, user_message: str) -> str:
        """Retrieve relevant KB context for a user message.

        Returns formatted context string, or empty string if KB not enabled.
        """
        if not self.agent.knowledge_base_enabled or not self.agent.knowledge_base_id:
            return ""

        try:
            from app.services.rag.retriever import retrieve_context, build_rag_context
            chunks = await retrieve_context(
                self.db, self.agent.knowledge_base_id, user_message
            )
            return build_rag_context(chunks)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("RAG retrieval failed: %s", e)
            return ""

    def _check_end_call_phrases(self, text: str) -> bool:
        """Check if the transcript contains any end-call phrases."""
        if not self.agent.end_call_phrases:
            return False
        text_lower = text.lower()
        return any(phrase.lower() in text_lower for phrase in self.agent.end_call_phrases)

    async def start_call(self, to_number: str, from_number: str = "") -> dict:
        """Initiate the outbound call and return call info.

        This creates the LiveKit room and dials out. The actual audio
        processing happens in the LiveKit agent worker.
        """
        self.is_active = True
        self.call_start_time = datetime.now(timezone.utc)

        # Get telephony provider from agent config
        provider_name = "webrtc"  # default
        provider_kwargs = {}

        if self.agent.telephony_provider:
            provider_name = self.agent.telephony_provider.provider_name
            # Credentials are decrypted in the service layer
            from app.core.security import decrypt_credentials
            creds = self.agent.telephony_provider.credentials
            if "encrypted" in creds:
                provider_kwargs = decrypt_credentials(creds["encrypted"])

        provider = get_telephony_provider(provider_name, **provider_kwargs)

        # Update call status
        call = await self.db.get(Call, self.call_id)
        if call:
            call.status = "ringing"
            call.started_at = self.call_start_time
            call.telephony_provider = provider_name
            call.from_number = from_number or settings.vobiz_outbound_number
            call.to_number = to_number
            await self.db.flush()

        await self._emit_event("call_started", {
            "to_number": to_number,
            "provider": provider_name,
        })

        # Register in Redis for live monitor
        await register_active_call(self.call_id, str(self.agent.tenant_id), {
            "to_number": to_number,
            "from_number": from_number or settings.vobiz_outbound_number,
            "agent_id": str(self.agent.id),
            "agent_name": self.agent.name,
            "provider": provider_name,
            "status": "ringing",
            "started_at": self.call_start_time.isoformat(),
        })

        # Initiate the call (creates LiveKit room + dials out)
        call_info = await provider.initiate_call(
            to=to_number,
            from_=from_number,
            room_name=f"call-{self.call_id}",
        )

        # Update call with provider's call ID
        if call:
            call.telephony_call_id = call_info.call_id
            await self.db.flush()

        return {
            "call_id": self.call_id,
            "room_name": f"call-{self.call_id}",
            "telephony_call_id": call_info.call_id,
            "provider": provider_name,
        }

    async def end_call(self, reason: str = "completed"):
        """End the call and clean up."""
        self.is_active = False
        end_time = datetime.now(timezone.utc)

        call = await self.db.get(Call, self.call_id)
        if call:
            call.status = "completed"
            call.ended_at = end_time
            call.end_reason = reason
            call.total_tokens_used = self.total_tokens

            if call.started_at:
                call.duration_seconds = int((end_time - call.started_at).total_seconds())

            await self.db.flush()

        await self._emit_event("call_ended", {
            "reason": reason,
            "duration_seconds": call.duration_seconds if call else 0,
            "total_tokens": self.total_tokens,
        })

        # Remove from active calls
        await unregister_active_call(self.call_id, str(self.agent.tenant_id))

        # Track usage
        if call:
            await track_call_usage(self.db, call)

        # Fire webhooks
        if self.agent.webhook_url and "call_ended" in (self.agent.webhook_events or []):
            await dispatch_webhook(
                db=self.db,
                tenant_id=str(self.agent.tenant_id),
                call_id=self.call_id,
                url=self.agent.webhook_url,
                event_type="call_ended",
                payload={
                    "call_id": self.call_id,
                    "reason": reason,
                    "duration_seconds": call.duration_seconds if call else 0,
                },
            )


async def create_call_and_orchestrator(
    agent_id: str,
    tenant_id: str,
    to_number: str,
    contact_id: str | None = None,
    campaign_id: str | None = None,
) -> tuple[str, CallOrchestrator]:
    """Create a call record and return an orchestrator instance.

    Used by the API endpoint and campaign dialer.
    """
    async with async_session() as db:
        # Fetch agent with providers
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        result = await db.execute(
            select(Agent)
            .where(Agent.id == agent_id)
            .options(
                selectinload(Agent.telephony_provider),
                selectinload(Agent.llm_provider),
                selectinload(Agent.stt_provider),
                selectinload(Agent.tts_provider),
            )
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        # Create call record
        call = Call(
            tenant_id=tenant_id,
            agent_id=agent_id,
            contact_id=contact_id,
            campaign_id=campaign_id,
            direction="outbound",
            status="initiated",
            to_number=to_number,
            llm_provider=agent.llm_provider.provider_name if agent.llm_provider else None,
            stt_provider=agent.stt_provider.provider_name if agent.stt_provider else None,
            tts_provider=agent.tts_provider.provider_name if agent.tts_provider else None,
        )
        db.add(call)
        await db.flush()

        call_id = str(call.id)
        orchestrator = CallOrchestrator(call_id, agent, db)

        await db.commit()

        return call_id, orchestrator
