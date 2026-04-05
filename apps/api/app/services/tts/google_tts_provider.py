from typing import AsyncGenerator
import base64
import httpx
from app.services.tts.base import BaseTTSProvider, VoiceInfo


class GoogleCloudTTSProvider(BaseTTSProvider):
    """Google Cloud Text-to-Speech provider — paid tier via REST API."""

    provider_name = "google_tts"

    API_URL = "https://texttospeech.googleapis.com/v1"

    DEFAULT_VOICES = [
        VoiceInfo(voice_id="en-US-Neural2-A", name="English US Neural2 A", language="en-US", gender="male", provider="google_tts"),
        VoiceInfo(voice_id="en-US-Neural2-C", name="English US Neural2 C", language="en-US", gender="female", provider="google_tts"),
        VoiceInfo(voice_id="en-US-Neural2-D", name="English US Neural2 D", language="en-US", gender="male", provider="google_tts"),
        VoiceInfo(voice_id="en-US-Neural2-F", name="English US Neural2 F", language="en-US", gender="female", provider="google_tts"),
        VoiceInfo(voice_id="en-GB-Neural2-A", name="English GB Neural2 A", language="en-GB", gender="female", provider="google_tts"),
        VoiceInfo(voice_id="en-GB-Neural2-B", name="English GB Neural2 B", language="en-GB", gender="male", provider="google_tts"),
        VoiceInfo(voice_id="hi-IN-Neural2-A", name="Hindi Neural2 A", language="hi-IN", gender="female", provider="google_tts"),
        VoiceInfo(voice_id="hi-IN-Neural2-B", name="Hindi Neural2 B", language="hi-IN", gender="male", provider="google_tts"),
    ]

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)

    async def synthesize_stream(
        self,
        text: str,
        voice_id: str = "en-US-Neural2-C",
        speed: float = 1.0,
        **kwargs,
    ) -> AsyncGenerator[bytes, None]:
        """Synthesize text via Google Cloud TTS REST API.
        Yields audio bytes as a single chunk (API is not natively streaming).
        """
        # Parse language from voice_id (e.g. "en-US-Neural2-C" -> "en-US")
        parts = voice_id.split("-")
        language_code = f"{parts[0]}-{parts[1]}" if len(parts) >= 2 else "en-US"

        payload = {
            "input": {"text": text},
            "voice": {
                "languageCode": language_code,
                "name": voice_id,
            },
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": speed,
            },
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.API_URL}/text:synthesize",
                params={"key": self.api_key},
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()

        audio_content = data.get("audioContent", "")
        if audio_content:
            yield base64.b64decode(audio_content)

    async def get_voices(self) -> list[VoiceInfo]:
        """Fetch available voices from Google Cloud TTS API, falling back to defaults."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.API_URL}/voices",
                    params={"key": self.api_key},
                    timeout=15.0,
                )
                response.raise_for_status()
                data = response.json()

            voices = []
            for v in data.get("voices", []):
                name = v.get("name", "")
                language_codes = v.get("languageCodes", [])
                gender = v.get("ssmlGender", "").lower()

                # Only include Neural2 and WaveNet voices for quality
                if "Neural2" in name or "Wavenet" in name:
                    voices.append(
                        VoiceInfo(
                            voice_id=name,
                            name=name,
                            language=language_codes[0] if language_codes else "",
                            gender=gender,
                            provider=self.provider_name,
                        )
                    )

            return voices if voices else self.DEFAULT_VOICES

        except Exception:
            return self.DEFAULT_VOICES
