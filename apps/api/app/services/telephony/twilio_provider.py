from typing import AsyncGenerator
from twilio.rest import Client
from twilio.request_validator import RequestValidator
from app.services.telephony.base import BaseTelephonyProvider, CallInfo, CallStatus


class TwilioProvider(BaseTelephonyProvider):
    """Twilio telephony provider — $15 free trial credit."""

    provider_name = "twilio"

    def __init__(self, account_sid: str = "", auth_token: str = "", phone_number: str = "", webhook_base_url: str = "", **kwargs):
        super().__init__(**kwargs)
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.phone_number = phone_number
        self.webhook_base_url = webhook_base_url
        self.client = Client(account_sid, auth_token) if account_sid and auth_token else None
        self.validator = RequestValidator(auth_token) if auth_token else None

    async def initiate_call(
        self,
        to: str,
        from_: str = "",
        webhook_url: str = "",
        **kwargs,
    ) -> CallInfo:
        """Initiate an outbound call via Twilio.

        The webhook_url should point to our TwiML endpoint that sets up
        a Media Stream for real-time audio.
        """
        from_number = from_ or self.phone_number
        url = webhook_url or f"{self.webhook_base_url}/api/webhooks/twilio/voice"
        status_callback = f"{self.webhook_base_url}/api/webhooks/twilio/status"

        call = self.client.calls.create(
            to=to,
            from_=from_number,
            url=url,
            status_callback=status_callback,
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            record=True,
        )

        return CallInfo(
            call_id=call.sid,
            provider=self.provider_name,
            from_number=from_number,
            to_number=to,
            status="initiated",
        )

    async def hangup_call(self, call_id: str) -> bool:
        """Hang up an active Twilio call."""
        try:
            self.client.calls(call_id).update(status="completed")
            return True
        except Exception:
            return False

    async def get_call_status(self, call_id: str) -> CallStatus:
        """Get call status from Twilio."""
        call = self.client.calls(call_id).fetch()

        status_map = {
            "queued": "initiated",
            "ringing": "ringing",
            "in-progress": "in_progress",
            "completed": "completed",
            "failed": "failed",
            "busy": "busy",
            "no-answer": "no_answer",
            "canceled": "failed",
        }

        return CallStatus(
            call_id=call_id,
            status=status_map.get(call.status, call.status),
            duration_seconds=int(call.duration or 0),
        )

    async def stream_audio_to_call(
        self,
        call_id: str,
        audio_stream: AsyncGenerator[bytes, None],
    ) -> None:
        """Stream audio to call via Twilio Media Streams.
        This is handled via the WebSocket connection, not this method directly.
        The actual streaming happens in the Twilio webhook handler.
        """
        pass

    def validate_webhook(self, headers: dict, body: bytes, url: str = "") -> bool:
        """Validate Twilio webhook signature."""
        if not self.validator:
            return False

        signature = headers.get("X-Twilio-Signature", "")
        # Twilio sends form-encoded data
        try:
            params = dict(pair.split("=", 1) for pair in body.decode().split("&")) if body else {}
        except Exception:
            params = {}

        return self.validator.validate(url, params, signature)
