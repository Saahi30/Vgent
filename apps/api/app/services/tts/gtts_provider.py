from typing import AsyncGenerator
import io
import asyncio
from gtts import gTTS
from app.services.tts.base import BaseTTSProvider, VoiceInfo


class GTTSProvider(BaseTTSProvider):
    """Google TTS (gTTS) — completely free, no API key, lower quality than Edge TTS."""

    provider_name = "gtts"

    LANGUAGES = [
        ("en", "English"), ("hi", "Hindi"), ("ta", "Tamil"), ("te", "Telugu"),
        ("bn", "Bengali"), ("kn", "Kannada"), ("ml", "Malayalam"), ("mr", "Marathi"),
        ("gu", "Gujarati"), ("pa", "Punjabi"), ("es", "Spanish"), ("fr", "French"),
        ("de", "German"), ("ja", "Japanese"), ("ko", "Korean"), ("zh-CN", "Chinese"),
        ("ar", "Arabic"), ("pt", "Portuguese"), ("ru", "Russian"), ("it", "Italian"),
    ]

    def __init__(self, api_key: str = "", **kwargs):
        super().__init__(api_key, **kwargs)

    async def synthesize_stream(
        self,
        text: str,
        voice_id: str = "en",
        speed: float = 1.0,
        **kwargs,
    ) -> AsyncGenerator[bytes, None]:
        """Generate audio using gTTS. Yields MP3 bytes in a single chunk
        (gTTS doesn't support true streaming)."""
        slow = speed < 0.8

        def _generate():
            tts = gTTS(text=text, lang=voice_id, slow=slow)
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            return buf.getvalue()

        # Run in thread pool since gTTS is synchronous
        audio_bytes = await asyncio.get_event_loop().run_in_executor(None, _generate)
        yield audio_bytes

    async def get_voices(self) -> list[VoiceInfo]:
        return [
            VoiceInfo(
                voice_id=code,
                name=f"gTTS {name}",
                language=code,
                gender="neutral",
                provider=self.provider_name,
            )
            for code, name in self.LANGUAGES
        ]
