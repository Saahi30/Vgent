from typing import AsyncGenerator
import uuid
from livekit import api as livekit_api
from app.services.telephony.base import BaseTelephonyProvider, CallInfo, CallStatus


class WebRTCProvider(BaseTelephonyProvider):
    """LiveKit WebRTC-based telephony — free, browser-based, for testing agents.

    Flow:
    1. Create a LiveKit room
    2. Generate a participant token for the browser user
    3. Browser connects via LiveKit JS SDK
    4. Our agent joins the same room and processes audio
    """

    provider_name = "webrtc"

    def __init__(
        self,
        livekit_url: str = "",
        livekit_api_key: str = "",
        livekit_api_secret: str = "",
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.livekit_url = livekit_url
        self.livekit_api_key = livekit_api_key
        self.livekit_api_secret = livekit_api_secret

    def _get_lk_api(self) -> livekit_api.LiveKitAPI:
        return livekit_api.LiveKitAPI(
            url=self.livekit_url.replace("wss://", "https://"),
            api_key=self.livekit_api_key,
            api_secret=self.livekit_api_secret,
        )

    def generate_token(self, room_name: str, participant_identity: str) -> str:
        """Generate a LiveKit access token for a browser participant."""
        token = livekit_api.AccessToken(
            api_key=self.livekit_api_key,
            api_secret=self.livekit_api_secret,
        )
        token.with_identity(participant_identity)
        token.with_name(participant_identity)
        token.with_grants(
            livekit_api.VideoGrants(
                room_join=True,
                room=room_name,
            )
        )
        return token.to_jwt()

    async def initiate_call(
        self,
        to: str = "",
        from_: str = "",
        webhook_url: str = "",
        **kwargs,
    ) -> CallInfo:
        """Create a LiveKit room for a WebRTC test call."""
        room_name = f"test-{uuid.uuid4().hex[:12]}"

        lk = self._get_lk_api()
        await lk.room.create_room(
            livekit_api.CreateRoomRequest(name=room_name)
        )

        return CallInfo(
            call_id=room_name,
            provider=self.provider_name,
            from_number="browser",
            to_number="agent",
            status="initiated",
        )

    async def hangup_call(self, call_id: str) -> bool:
        """End a WebRTC session by deleting the LiveKit room."""
        try:
            lk = self._get_lk_api()
            await lk.room.delete_room(
                livekit_api.DeleteRoomRequest(room=call_id)
            )
            return True
        except Exception:
            return False

    async def get_call_status(self, call_id: str) -> CallStatus:
        """Check room status."""
        try:
            lk = self._get_lk_api()
            participants = await lk.room.list_participants(
                livekit_api.ListParticipantsRequest(room=call_id)
            )
            if participants.participants:
                return CallStatus(call_id=call_id, status="in_progress")
            return CallStatus(call_id=call_id, status="completed")
        except Exception:
            return CallStatus(call_id=call_id, status="unknown")

    async def stream_audio_to_call(
        self,
        call_id: str,
        audio_stream: AsyncGenerator[bytes, None],
    ) -> None:
        """Audio streaming handled by LiveKit agents framework."""
        pass
