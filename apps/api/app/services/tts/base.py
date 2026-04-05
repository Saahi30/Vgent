from abc import ABC, abstractmethod
from typing import AsyncGenerator
from dataclasses import dataclass


@dataclass
class VoiceInfo:
    voice_id: str
    name: str
    language: str = ""
    gender: str = ""
    preview_url: str = ""
    provider: str = ""


class BaseTTSProvider(ABC):
    """Abstract base class for all Text-to-Speech providers."""

    provider_name: str = ""

    def __init__(self, api_key: str = "", **kwargs):
        self.api_key = api_key

    @abstractmethod
    async def synthesize_stream(
        self,
        text: str,
        voice_id: str = "",
        speed: float = 1.0,
        **kwargs,
    ) -> AsyncGenerator[bytes, None]:
        """Synthesize text to audio, streaming chunks of audio bytes (PCM/MP3)."""
        ...

    @abstractmethod
    async def get_voices(self) -> list[VoiceInfo]:
        """Return list of available voices for this provider."""
        ...
