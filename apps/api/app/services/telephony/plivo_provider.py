from typing import AsyncGenerator
import asyncio
import plivo
from app.services.telephony.base import BaseTelephonyProvider, CallInfo, CallStatus


class PlivoProvider(BaseTelephonyProvider):
    """Plivo telephony provider — paid tier for outbound voice calls."""

    provider_name = "plivo"

    def __init__(
        self,
        auth_id: str = "",
        auth_token: str = "",
        phone_number: str = "",
        webhook_base_url: str = "",
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.auth_id = auth_id
        self.auth_token = auth_token
        self.phone_number = phone_number
        self.webhook_base_url = webhook_base_url
        self.client = plivo.RestClient(auth_id=auth_id, auth_token=auth_token) if auth_id and auth_token else None

    async def initiate_call(
        self,
        to: str,
        from_: str = "",
        webhook_url: str = "",
        **kwargs,
    ) -> CallInfo:
        """Initiate an outbound call via Plivo."""
        from_number = from_ or self.phone_number
        answer_url = webhook_url or f"{self.webhook_base_url}/api/webhooks/plivo/answer"
        hangup_url = f"{self.webhook_base_url}/api/webhooks/plivo/hangup"

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.calls.create(
                from_=from_number,
                to_=to,
                answer_url=answer_url,
                answer_method="POST",
                hangup_url=hangup_url,
                hangup_method="POST",
            ),
        )

        call_uuid = response[0].request_uuid if hasattr(response[0], "request_uuid") else str(response[0])

        return CallInfo(
            call_id=call_uuid,
            provider=self.provider_name,
            from_number=from_number,
            to_number=to,
            status="initiated",
        )

    async def hangup_call(self, call_id: str) -> bool:
        """Hang up an active Plivo call."""
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: self.client.calls.hangup(call_id),
            )
            return True
        except Exception:
            return False

    async def get_call_status(self, call_id: str) -> CallStatus:
        """Get call status from Plivo."""
        loop = asyncio.get_event_loop()
        call = await loop.run_in_executor(
            None,
            lambda: self.client.calls.get(call_id),
        )

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

        call_status = getattr(call, "call_status", "unknown")
        duration = int(getattr(call, "duration", 0) or 0)

        return CallStatus(
            call_id=call_id,
            status=status_map.get(call_status, call_status),
            duration_seconds=duration,
        )

    async def stream_audio_to_call(
        self,
        call_id: str,
        audio_stream: AsyncGenerator[bytes, None],
    ) -> None:
        """Stream audio to an active Plivo call.

        Plivo supports audio streaming via its Audio Stream API.
        The actual streaming is handled via the Plivo XML response
        and WebSocket connection in the webhook handler.
        """
        pass

    def validate_webhook(self, headers: dict, body: bytes, url: str = "") -> bool:
        """Validate Plivo webhook signature."""
        if not self.auth_token:
            return False

        signature = headers.get("X-Plivo-Signature-V3", "")
        nonce = headers.get("X-Plivo-Signature-V3-Nonce", "")

        if not signature or not nonce:
            return False

        try:
            return plivo.utils.validate_v3_signature(
                method="POST",
                uri=url,
                nonce=nonce,
                auth_token=self.auth_token,
                user_signature=signature,
                body=body.decode("utf-8") if body else "",
            )
        except Exception:
            return False
