from typing import AsyncGenerator
import httpx
import base64
from app.services.tts.base import BaseTTSProvider, VoiceInfo


class SarvamProvider(BaseTTSProvider):
    """Sarvam AI TTS — free tier, excellent Indian language support."""

    provider_name = "sarvam"

    API_URL = "https://api.sarvam.ai/text-to-speech"

    VOICES = [
        VoiceInfo(voice_id="meera", name="Meera (Hindi Female)", language="hi-IN", gender="female", provider="sarvam"),
        VoiceInfo(voice_id="arvind", name="Arvind (Hindi Male)", language="hi-IN", gender="male", provider="sarvam"),
        VoiceInfo(voice_id="amol", name="Amol (Marathi Male)", language="mr-IN", gender="male", provider="sarvam"),
        VoiceInfo(voice_id="amruta", name="Amruta (Marathi Female)", language="mr-IN", gender="female", provider="sarvam"),
        VoiceInfo(voice_id="diya", name="Diya (Bengali Female)", language="bn-IN", gender="female", provider="sarvam"),
        VoiceInfo(voice_id="neel", name="Neel (Bengali Male)", language="bn-IN", gender="male", provider="sarvam"),
        VoiceInfo(voice_id="maitreyi", name="Maitreyi (Kannada Female)", language="kn-IN", gender="female", provider="sarvam"),
        VoiceInfo(voice_id="pavithra", name="Pavithra (Tamil Female)", language="ta-IN", gender="female", provider="sarvam"),
        VoiceInfo(voice_id="karthik", name="Karthik (Tamil Male)", language="ta-IN", gender="male", provider="sarvam"),
        VoiceInfo(voice_id="pushpak", name="Pushpak (Telugu Male)", language="te-IN", gender="male", provider="sarvam"),
        VoiceInfo(voice_id="lakshmi", name="Lakshmi (Telugu Female)", language="te-IN", gender="female", provider="sarvam"),
    ]

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)

    async def synthesize_stream(
        self,
        text: str,
        voice_id: str = "meera",
        speed: float = 1.0,
        **kwargs,
    ) -> AsyncGenerator[bytes, None]:
        """Call Sarvam TTS API. Yields audio bytes (single chunk — API is not streaming)."""
        # Determine language from voice
        target_language = "hi-IN"
        for v in self.VOICES:
            if v.voice_id == voice_id:
                target_language = v.language
                break

        payload = {
            "inputs": [text],
            "target_language_code": target_language,
            "speaker": voice_id,
            "model": "bulbul:v1",
            "enable_preprocessing": True,
        }

        if speed != 1.0:
            payload["pace"] = speed

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.API_URL,
                json=payload,
                headers={
                    "API-Subscription-Key": self.api_key,
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()

        # Sarvam returns base64-encoded audio
        audios = data.get("audios", [])
        if audios:
            audio_bytes = base64.b64decode(audios[0])
            yield audio_bytes

    async def get_voices(self) -> list[VoiceInfo]:
        return self.VOICES
