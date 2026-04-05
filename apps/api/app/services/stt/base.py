from abc import ABC, abstractmethod
from typing import AsyncGenerator
from dataclasses import dataclass


@dataclass
class TranscriptChunk:
    text: str
    is_final: bool = False
    confidence: float = 0.0
    language: str = ""


class BaseSTTProvider(ABC):
    """Abstract base class for all Speech-to-Text providers."""

    provider_name: str = ""

    def __init__(self, api_key: str, **kwargs):
        self.api_key = api_key

    @abstractmethod
    async def transcribe_stream(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        language: str = "en-US",
        sample_rate: int = 16000,
        **kwargs,
    ) -> AsyncGenerator[TranscriptChunk, None]:
        """Transcribe a stream of audio chunks in real-time.
        Yields TranscriptChunk objects with partial and final results.
        """
        ...

    @abstractmethod
    async def transcribe_file(
        self,
        audio_bytes: bytes,
        language: str = "en-US",
        **kwargs,
    ) -> str:
        """Transcribe a complete audio file. Returns full transcript text."""
        ...
