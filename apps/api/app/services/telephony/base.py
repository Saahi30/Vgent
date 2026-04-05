from abc import ABC, abstractmethod
from typing import AsyncGenerator
from dataclasses import dataclass


@dataclass
class CallInfo:
    call_id: str
    provider: str
    from_number: str = ""
    to_number: str = ""
    status: str = "initiated"


@dataclass
class CallStatus:
    call_id: str
    status: str  # initiated | ringing | in_progress | completed | failed | busy | no_answer
    duration_seconds: int = 0


class BaseTelephonyProvider(ABC):
    """Abstract base class for all telephony providers."""

    provider_name: str = ""

    def __init__(self, **kwargs):
        pass

    @abstractmethod
    async def initiate_call(
        self,
        to: str,
        from_: str,
        webhook_url: str,
        **kwargs,
    ) -> CallInfo:
        """Initiate an outbound call. Returns call info with provider's call ID."""
        ...

    @abstractmethod
    async def hangup_call(self, call_id: str) -> bool:
        """Hang up an active call. Returns True on success."""
        ...

    @abstractmethod
    async def get_call_status(self, call_id: str) -> CallStatus:
        """Get the current status of a call."""
        ...

    @abstractmethod
    async def stream_audio_to_call(
        self,
        call_id: str,
        audio_stream: AsyncGenerator[bytes, None],
    ) -> None:
        """Stream audio bytes to an active call."""
        ...

    def validate_webhook(self, headers: dict, body: bytes) -> bool:
        """Validate an incoming webhook signature. Override per provider."""
        return True
