from typing import AsyncGenerator
import json
import httpx
from app.services.stt.base import BaseSTTProvider, TranscriptChunk


class GoogleSTTProvider(BaseSTTProvider):
    """Google Cloud Speech-to-Text provider — paid tier via REST API."""

    provider_name = "google"

    API_URL = "https://speech.googleapis.com/v1/speech"

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)

    async def transcribe_stream(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        language: str = "en-US",
        sample_rate: int = 16000,
        encoding: str = "LINEAR16",
        **kwargs,
    ) -> AsyncGenerator[TranscriptChunk, None]:
        """Stream audio to Google Cloud STT via chunked REST requests.

        Google Cloud STT streaming normally requires gRPC. For simplicity,
        we buffer small chunks and send sequential recognize requests,
        yielding interim results to approximate streaming behavior.
        """
        CHUNK_DURATION_MS = 2000  # 2-second chunks
        bytes_per_chunk = int(sample_rate * 2 * (CHUNK_DURATION_MS / 1000))  # 16-bit audio = 2 bytes/sample

        buffer = bytearray()

        async for audio_data in audio_stream:
            buffer.extend(audio_data)

            while len(buffer) >= bytes_per_chunk:
                chunk = bytes(buffer[:bytes_per_chunk])
                buffer = buffer[bytes_per_chunk:]

                result = await self._recognize_chunk(chunk, language, sample_rate, encoding)
                if result:
                    yield TranscriptChunk(
                        text=result["text"],
                        is_final=False,
                        confidence=result["confidence"],
                        language=language,
                    )

        # Process remaining buffer
        if buffer:
            result = await self._recognize_chunk(bytes(buffer), language, sample_rate, encoding)
            if result:
                yield TranscriptChunk(
                    text=result["text"],
                    is_final=True,
                    confidence=result["confidence"],
                    language=language,
                )

    async def _recognize_chunk(
        self,
        audio_bytes: bytes,
        language: str,
        sample_rate: int,
        encoding: str,
    ) -> dict | None:
        """Send a single audio chunk to the Google recognize endpoint."""
        import base64

        payload = {
            "config": {
                "encoding": encoding,
                "sampleRateHertz": sample_rate,
                "languageCode": language,
                "enableAutomaticPunctuation": True,
                "model": "latest_long",
            },
            "audio": {
                "content": base64.b64encode(audio_bytes).decode("utf-8"),
            },
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.API_URL}:recognize",
                params={"key": self.api_key},
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()

        results = data.get("results", [])
        if results:
            alternatives = results[0].get("alternatives", [])
            if alternatives:
                return {
                    "text": alternatives[0].get("transcript", ""),
                    "confidence": alternatives[0].get("confidence", 0.0),
                }

        return None

    async def transcribe_file(
        self,
        audio_bytes: bytes,
        language: str = "en-US",
        **kwargs,
    ) -> str:
        """Transcribe a complete audio file via Google Cloud STT REST API."""
        import base64

        payload = {
            "config": {
                "encoding": "LINEAR16",
                "sampleRateHertz": 16000,
                "languageCode": language,
                "enableAutomaticPunctuation": True,
                "model": "latest_long",
            },
            "audio": {
                "content": base64.b64encode(audio_bytes).decode("utf-8"),
            },
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.API_URL}:recognize",
                params={"key": self.api_key},
                json=payload,
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()

        results = data.get("results", [])
        transcript_parts = []
        for result in results:
            alternatives = result.get("alternatives", [])
            if alternatives:
                transcript_parts.append(alternatives[0].get("transcript", ""))

        return " ".join(transcript_parts)
