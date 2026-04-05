from typing import AsyncGenerator
import edge_tts
from app.services.tts.base import BaseTTSProvider, VoiceInfo


class EdgeTTSProvider(BaseTTSProvider):
    """Microsoft Edge TTS — completely free, no API key needed, good quality."""

    provider_name = "edge_tts"

    def __init__(self, api_key: str = "", **kwargs):
        super().__init__(api_key, **kwargs)

    async def synthesize_stream(
        self,
        text: str,
        voice_id: str = "en-US-JennyNeural",
        speed: float = 1.0,
        **kwargs,
    ) -> AsyncGenerator[bytes, None]:
        """Stream audio from Edge TTS. Yields MP3 audio chunks."""
        rate = f"+{int((speed - 1) * 100)}%" if speed >= 1 else f"{int((speed - 1) * 100)}%"

        communicate = edge_tts.Communicate(text, voice_id, rate=rate)

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    async def get_voices(self) -> list[VoiceInfo]:
        """Fetch all available Edge TTS voices."""
        voices = await edge_tts.list_voices()
        return [
            VoiceInfo(
                voice_id=v["ShortName"],
                name=v["FriendlyName"],
                language=v.get("Locale", ""),
                gender=v.get("Gender", ""),
                provider=self.provider_name,
            )
            for v in voices
        ]
