from typing import AsyncGenerator
from elevenlabs import AsyncElevenLabs
from app.services.tts.base import BaseTTSProvider, VoiceInfo


class ElevenLabsProvider(BaseTTSProvider):
    """ElevenLabs TTS provider — paid tier with premium voice quality."""

    provider_name = "elevenlabs"

    DEFAULT_VOICES = [
        VoiceInfo(voice_id="21m00Tcm4TlvDq8ikWAM", name="Rachel", language="en", gender="female", provider="elevenlabs"),
        VoiceInfo(voice_id="AZnzlk1XvdvUeBnXmlld", name="Domi", language="en", gender="female", provider="elevenlabs"),
        VoiceInfo(voice_id="EXAVITQu4vr4xnSDxMaL", name="Bella", language="en", gender="female", provider="elevenlabs"),
        VoiceInfo(voice_id="ErXwobaYiN019PkySvjV", name="Antoni", language="en", gender="male", provider="elevenlabs"),
        VoiceInfo(voice_id="MF3mGyEYCl7XYWbV9V6O", name="Elli", language="en", gender="female", provider="elevenlabs"),
        VoiceInfo(voice_id="TxGEqnHWrfWFTfGW9XjX", name="Josh", language="en", gender="male", provider="elevenlabs"),
        VoiceInfo(voice_id="VR6AewLTigWG4xSOukaG", name="Arnold", language="en", gender="male", provider="elevenlabs"),
        VoiceInfo(voice_id="pNInz6obpgDQGcFmaJgB", name="Adam", language="en", gender="male", provider="elevenlabs"),
        VoiceInfo(voice_id="yoZ06aMxZJJ28mfd3POQ", name="Sam", language="en", gender="male", provider="elevenlabs"),
    ]

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = AsyncElevenLabs(api_key=api_key)

    async def synthesize_stream(
        self,
        text: str,
        voice_id: str = "21m00Tcm4TlvDq8ikWAM",
        speed: float = 1.0,
        **kwargs,
    ) -> AsyncGenerator[bytes, None]:
        """Stream audio from ElevenLabs TTS. Yields MP3 audio chunks."""
        model_id = kwargs.get("model_id", "eleven_monolingual_v1")

        audio_generator = await self.client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id=model_id,
            output_format="mp3_44100_128",
        )

        async for chunk in audio_generator:
            if chunk:
                yield chunk

    async def get_voices(self) -> list[VoiceInfo]:
        """Fetch available voices from ElevenLabs API, falling back to defaults."""
        try:
            response = await self.client.voices.get_all()

            voices = []
            for v in response.voices:
                labels = v.labels or {}
                voices.append(
                    VoiceInfo(
                        voice_id=v.voice_id,
                        name=v.name or v.voice_id,
                        language=labels.get("language", "en"),
                        gender=labels.get("gender", ""),
                        preview_url=v.preview_url or "",
                        provider=self.provider_name,
                    )
                )

            return voices if voices else self.DEFAULT_VOICES

        except Exception:
            return self.DEFAULT_VOICES
