"""Tests for webhook dispatcher and Twilio webhook endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Webhook dispatcher — dispatch_webhook()
# ---------------------------------------------------------------------------


class TestDispatchWebhook:
    async def test_creates_delivery_record_on_success(self):
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "OK"

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.webhook_dispatcher.httpx.AsyncClient", return_value=mock_client):
            from app.services.webhook_dispatcher import dispatch_webhook
            await dispatch_webhook(
                db=mock_db,
                tenant_id="tenant-1",
                call_id="call-1",
                url="https://example.com/hook",
                event_type="call_ended",
                payload={"reason": "completed"},
            )

        # Should have added a WebhookDelivery
        mock_db.add.assert_called_once()
        delivery = mock_db.add.call_args[0][0]
        assert delivery.tenant_id == "tenant-1"
        assert delivery.call_id == "call-1"
        assert delivery.url == "https://example.com/hook"
        assert delivery.event_type == "call_ended"
        assert delivery.response_status == 200
        assert delivery.failed is False
        mock_db.flush.assert_called_once()

    async def test_marks_delivery_failed_on_4xx(self):
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Not Found"

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.webhook_dispatcher.httpx.AsyncClient", return_value=mock_client):
            from app.services.webhook_dispatcher import dispatch_webhook
            await dispatch_webhook(
                db=mock_db,
                tenant_id="tenant-1",
                call_id="call-1",
                url="https://example.com/hook",
                event_type="call_ended",
                payload={},
            )

        delivery = mock_db.add.call_args[0][0]
        assert delivery.failed is True
        assert delivery.response_status == 404

    async def test_marks_delivery_failed_on_exception(self):
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=Exception("Connection refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.webhook_dispatcher.httpx.AsyncClient", return_value=mock_client):
            from app.services.webhook_dispatcher import dispatch_webhook
            await dispatch_webhook(
                db=mock_db,
                tenant_id="tenant-1",
                call_id="call-1",
                url="https://unreachable.example.com/hook",
                event_type="call_ended",
                payload={},
            )

        delivery = mock_db.add.call_args[0][0]
        assert delivery.failed is True
        assert "Connection refused" in delivery.response_body

    async def test_posts_correct_json_payload(self):
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "OK"

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.webhook_dispatcher.httpx.AsyncClient", return_value=mock_client):
            from app.services.webhook_dispatcher import dispatch_webhook
            await dispatch_webhook(
                db=mock_db,
                tenant_id="tenant-1",
                call_id="call-1",
                url="https://example.com/hook",
                event_type="call_ended",
                payload={"duration": 120},
            )

        # Verify the JSON body structure
        post_call = mock_client.post.call_args
        json_body = post_call.kwargs["json"]
        assert json_body["event"] == "call_ended"
        assert json_body["call_id"] == "call-1"
        assert json_body["tenant_id"] == "tenant-1"
        assert json_body["data"]["duration"] == 120
        assert "timestamp" in json_body

        # Verify headers
        headers = post_call.kwargs["headers"]
        assert headers["Content-Type"] == "application/json"
        assert headers["User-Agent"] == "Vgent-Webhook/1.0"


# ---------------------------------------------------------------------------
# Twilio webhook endpoints
# ---------------------------------------------------------------------------


class TestTwilioVoiceWebhook:
    async def test_voice_webhook_returns_twiml(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/webhooks/twilio/voice",
            data={"CallSid": "CA123456", "From": "+1234567890"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert resp.status_code == 200
        assert "application/xml" in resp.headers["content-type"]
        body = resp.text
        assert "<Response>" in body
        assert "<Connect>" in body
        assert "<Stream" in body
        assert "CA123456" in body

    async def test_voice_webhook_handles_missing_callsid(self, client_no_auth):
        resp = await client_no_auth.post(
            "/api/webhooks/twilio/voice",
            data={},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        # Should still return 200 with TwiML (empty CallSid is handled gracefully)
        assert resp.status_code == 200
        assert "<Response>" in resp.text


class TestTwilioStatusWebhook:
    async def test_status_webhook_completed(self, client_no_auth):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # no matching call
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value = mock_db
        mock_ctx.__aexit__.return_value = False

        with patch("app.core.database.async_session", return_value=mock_ctx):
            resp = await client_no_auth.post(
                "/api/webhooks/twilio/status",
                data={
                    "CallSid": "CA123456",
                    "CallStatus": "completed",
                    "CallDuration": "60",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        assert resp.status_code == 200

    async def test_status_webhook_updates_call_record(self, client_no_auth):
        mock_call = MagicMock()
        mock_call.status = "ringing"

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_call
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value = mock_db
        mock_ctx.__aexit__.return_value = False

        with patch("app.core.database.async_session", return_value=mock_ctx):
            resp = await client_no_auth.post(
                "/api/webhooks/twilio/status",
                data={
                    "CallSid": "CA123456",
                    "CallStatus": "in-progress",
                    "CallDuration": "0",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        assert resp.status_code == 200
        assert mock_call.status == "in_progress"
