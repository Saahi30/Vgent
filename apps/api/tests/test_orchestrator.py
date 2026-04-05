"""Tests for CallOrchestrator logic."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.call_orchestrator import CallOrchestrator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_agent(**overrides):
    """Create a mock Agent object."""
    agent = MagicMock()
    agent.tenant_id = "tenant-1"
    agent.id = "agent-1"
    agent.name = "Test Agent"
    agent.system_prompt = "You are a helpful sales assistant."
    agent.end_call_phrases = ["goodbye", "have a nice day", "talk to you later"]
    agent.knowledge_base_enabled = False
    agent.knowledge_base_id = None
    agent.webhook_url = None
    agent.webhook_events = []
    agent.telephony_provider = None
    agent.llm_provider = None
    agent.stt_provider = None
    agent.tts_provider = None
    for k, v in overrides.items():
        setattr(agent, k, v)
    return agent


def _make_orchestrator(agent=None, db=None):
    agent = agent or _make_agent()
    db = db or AsyncMock()
    return CallOrchestrator(call_id="call-123", agent=agent, db_session=db)


# ---------------------------------------------------------------------------
# _build_messages
# ---------------------------------------------------------------------------


class TestBuildMessages:
    def test_basic_messages_without_rag(self):
        orch = _make_orchestrator()
        msgs = orch._build_messages()

        assert len(msgs) == 1
        assert msgs[0]["role"] == "system"
        assert msgs[0]["content"] == "You are a helpful sales assistant."

    def test_messages_include_conversation_history(self):
        orch = _make_orchestrator()
        orch.conversation_history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]
        msgs = orch._build_messages()

        assert len(msgs) == 3
        assert msgs[0]["role"] == "system"
        assert msgs[1]["role"] == "user"
        assert msgs[1]["content"] == "Hello"
        assert msgs[2]["role"] == "assistant"
        assert msgs[2]["content"] == "Hi there!"

    def test_messages_with_rag_context(self):
        orch = _make_orchestrator()
        rag_context = "Product X costs $99. Product Y costs $49."
        msgs = orch._build_messages(rag_context=rag_context)

        assert len(msgs) == 1
        system_msg = msgs[0]["content"]
        assert "You are a helpful sales assistant." in system_msg
        assert "knowledge base information" in system_msg
        assert "Product X costs $99" in system_msg

    def test_rag_context_appended_after_system_prompt(self):
        orch = _make_orchestrator()
        orch.conversation_history = [{"role": "user", "content": "What does X cost?"}]
        rag_context = "X costs $100."
        msgs = orch._build_messages(rag_context=rag_context)

        assert len(msgs) == 2
        assert "X costs $100" in msgs[0]["content"]
        assert msgs[1]["role"] == "user"

    def test_empty_rag_context_not_appended(self):
        orch = _make_orchestrator()
        msgs = orch._build_messages(rag_context="")

        assert msgs[0]["content"] == "You are a helpful sales assistant."
        assert "knowledge base" not in msgs[0]["content"]


# ---------------------------------------------------------------------------
# _check_end_call_phrases
# ---------------------------------------------------------------------------


class TestCheckEndCallPhrases:
    def test_detects_end_call_phrase(self):
        orch = _make_orchestrator()
        assert orch._check_end_call_phrases("Okay, goodbye!") is True

    def test_detects_case_insensitive(self):
        orch = _make_orchestrator()
        assert orch._check_end_call_phrases("HAVE A NICE DAY") is True

    def test_no_match_returns_false(self):
        orch = _make_orchestrator()
        assert orch._check_end_call_phrases("Tell me more about pricing") is False

    def test_empty_phrases_returns_false(self):
        agent = _make_agent(end_call_phrases=[])
        orch = _make_orchestrator(agent=agent)
        assert orch._check_end_call_phrases("goodbye") is False

    def test_none_phrases_returns_false(self):
        agent = _make_agent(end_call_phrases=None)
        orch = _make_orchestrator(agent=agent)
        assert orch._check_end_call_phrases("goodbye") is False

    def test_partial_match(self):
        orch = _make_orchestrator()
        assert orch._check_end_call_phrases("Well, talk to you later then") is True

    def test_phrase_at_start(self):
        orch = _make_orchestrator()
        assert orch._check_end_call_phrases("Goodbye and thank you") is True


# ---------------------------------------------------------------------------
# end_call sets correct status
# ---------------------------------------------------------------------------


class TestEndCall:
    async def test_end_call_sets_completed_status(self):
        mock_db = AsyncMock()
        mock_call = MagicMock()
        mock_call.started_at = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        mock_call.duration_seconds = 0
        mock_db.get.return_value = mock_call

        agent = _make_agent()
        orch = _make_orchestrator(agent=agent, db=mock_db)
        orch.is_active = True

        with patch("app.services.call_orchestrator.publish_event", new_callable=AsyncMock):
            with patch("app.services.call_orchestrator.unregister_active_call", new_callable=AsyncMock):
                with patch("app.services.call_orchestrator.track_call_usage", new_callable=AsyncMock):
                    await orch.end_call(reason="completed")

        assert orch.is_active is False
        assert mock_call.status == "completed"
        assert mock_call.end_reason == "completed"
        assert mock_call.ended_at is not None

    async def test_end_call_computes_duration(self):
        mock_db = AsyncMock()
        mock_call = MagicMock()
        mock_call.started_at = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        mock_call.duration_seconds = 0
        mock_db.get.return_value = mock_call

        orch = _make_orchestrator(db=mock_db)
        orch.is_active = True

        with patch("app.services.call_orchestrator.publish_event", new_callable=AsyncMock):
            with patch("app.services.call_orchestrator.unregister_active_call", new_callable=AsyncMock):
                with patch("app.services.call_orchestrator.track_call_usage", new_callable=AsyncMock):
                    await orch.end_call()

        # duration_seconds should be set (it will be some positive int based on now - started_at)
        assert mock_call.duration_seconds is not None
        assert isinstance(mock_call.duration_seconds, int)

    async def test_end_call_fires_webhook_if_configured(self):
        mock_db = AsyncMock()
        mock_call = MagicMock()
        mock_call.started_at = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        mock_call.duration_seconds = 60
        mock_db.get.return_value = mock_call

        agent = _make_agent(
            webhook_url="https://example.com/webhook",
            webhook_events=["call_ended"],
        )
        orch = _make_orchestrator(agent=agent, db=mock_db)
        orch.is_active = True

        with patch("app.services.call_orchestrator.publish_event", new_callable=AsyncMock):
            with patch("app.services.call_orchestrator.unregister_active_call", new_callable=AsyncMock):
                with patch("app.services.call_orchestrator.track_call_usage", new_callable=AsyncMock):
                    with patch("app.services.call_orchestrator.dispatch_webhook", new_callable=AsyncMock) as mock_wh:
                        await orch.end_call(reason="completed")

        mock_wh.assert_called_once()
        call_kwargs = mock_wh.call_args.kwargs
        assert call_kwargs["url"] == "https://example.com/webhook"
        assert call_kwargs["event_type"] == "call_ended"

    async def test_end_call_no_webhook_when_not_configured(self):
        mock_db = AsyncMock()
        mock_call = MagicMock()
        mock_call.started_at = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        mock_call.duration_seconds = 0
        mock_db.get.return_value = mock_call

        agent = _make_agent(webhook_url=None, webhook_events=[])
        orch = _make_orchestrator(agent=agent, db=mock_db)
        orch.is_active = True

        with patch("app.services.call_orchestrator.publish_event", new_callable=AsyncMock):
            with patch("app.services.call_orchestrator.unregister_active_call", new_callable=AsyncMock):
                with patch("app.services.call_orchestrator.track_call_usage", new_callable=AsyncMock):
                    with patch("app.services.call_orchestrator.dispatch_webhook", new_callable=AsyncMock) as mock_wh:
                        await orch.end_call()

        mock_wh.assert_not_called()

    async def test_end_call_handles_missing_call_record(self):
        """If the call record doesn't exist in DB, end_call should not crash."""
        mock_db = AsyncMock()
        mock_db.get.return_value = None

        orch = _make_orchestrator(db=mock_db)
        orch.is_active = True

        with patch("app.services.call_orchestrator.publish_event", new_callable=AsyncMock):
            with patch("app.services.call_orchestrator.unregister_active_call", new_callable=AsyncMock):
                # Should not raise
                await orch.end_call()

        assert orch.is_active is False
