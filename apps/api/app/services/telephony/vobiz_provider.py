from typing import AsyncGenerator
from livekit import api as livekit_api
from app.services.telephony.base import BaseTelephonyProvider, CallInfo, CallStatus


class VobizProvider(BaseTelephonyProvider):
    """Vobiz telephony via SIP trunking through LiveKit.

    Flow:
    1. Create a LiveKit room for the call
    2. Use LiveKit SIP API to dial out via Vobiz SIP trunk
    3. Audio flows: Vobiz SIP <-> LiveKit Room <-> Our Agent
    """

    provider_name = "vobiz"

    def __init__(
        self,
        sip_trunk_id: str = "",
        sip_domain: str = "",
        username: str = "",
        password: str = "",
        outbound_number: str = "",
        livekit_url: str = "",
        livekit_api_key: str = "",
        livekit_api_secret: str = "",
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.sip_trunk_id = sip_trunk_id
        self.sip_domain = sip_domain
        self.username = username
        self.password = password
        self.outbound_number = outbound_number
        self.livekit_url = livekit_url
        self.livekit_api_key = livekit_api_key
        self.livekit_api_secret = livekit_api_secret

    def _get_lk_api(self) -> livekit_api.LiveKitAPI:
        return livekit_api.LiveKitAPI(
            url=self.livekit_url.replace("wss://", "https://"),
            api_key=self.livekit_api_key,
            api_secret=self.livekit_api_secret,
        )

    async def initiate_call(
        self,
        to: str,
        from_: str = "",
        webhook_url: str = "",
        room_name: str = "",
        **kwargs,
    ) -> CallInfo:
        """Initiate outbound call via Vobiz SIP trunk through LiveKit.

        1. Creates a LiveKit room
        2. Creates a SIP participant in that room that dials out via Vobiz
        """
        import uuid

        from_number = from_ or self.outbound_number
        room = room_name or f"call-{uuid.uuid4().hex[:12]}"

        lk = self._get_lk_api()

        # Create the room
        await lk.room.create_room(
            livekit_api.CreateRoomRequest(name=room)
        )

        # Create SIP participant that dials out
        # LiveKit SIP API expects a phone number, not a full SIP URI
        participant = await lk.sip.create_sip_participant(
            livekit_api.CreateSIPParticipantRequest(
                sip_trunk_id=self.sip_trunk_id,
                sip_call_to=to,
                room_name=room,
                participant_identity=f"phone-{to}",
                participant_name=f"Phone {to}",
            )
        )

        call_id = participant.sip_call_id or room

        return CallInfo(
            call_id=call_id,
            provider=self.provider_name,
            from_number=from_number,
            to_number=to,
            status="initiated",
        )

    async def hangup_call(self, call_id: str) -> bool:
        """Hang up by removing the SIP participant from the room."""
        try:
            lk = self._get_lk_api()
            # The call_id is the room name; remove all participants
            participants = await lk.room.list_participants(
                livekit_api.ListParticipantsRequest(room=call_id)
            )
            for p in participants.participants:
                await lk.room.remove_participant(
                    livekit_api.RoomParticipantIdentity(
                        room=call_id,
                        identity=p.identity,
                    )
                )
            # Delete the room
            await lk.room.delete_room(
                livekit_api.DeleteRoomRequest(room=call_id)
            )
            return True
        except Exception:
            return False

    async def get_call_status(self, call_id: str) -> CallStatus:
        """Get call status by checking room participants."""
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
        """Audio streaming is handled by LiveKit agents framework directly."""
        pass
