"""
Sarvam TTS wrapped as a livekit-agents TTS plugin.

Sarvam's API is REST-based (not streaming), so this plugin:
1. Calls the Sarvam API with the full text
2. Decodes the base64 audio response
3. Pushes audio frames to the AudioEmitter

Use with StreamAdapter for streaming compatibility in the AgentSession pipeline:
    from livekit.agents.tts import StreamAdapter
    tts = StreamAdapter(tts=SarvamLKTTS(api_key="...", voice="anushka"), ...)
"""

import base64
import logging

import aiohttp
from livekit.agents import tts, utils, DEFAULT_API_CONNECT_OPTIONS

logger = logging.getLogger("vgent.tts.sarvam")

SARVAM_API_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_MODEL = "bulbul:v2"

# Available Sarvam voices (as of 2026-04)
# Female: anushka, manisha, vidya, arya, ritu, priya, neha, pooja, simran, kavya,
#         ishita, shreya, roopa, amelia, sophia, tanya, shruti, suhani, kavitha, rupali
# Male: abhilash, karun, hitesh, aditya, rahul, rohan, amit, dev, ratan, varun,
#       manan, sumit, kabir, aayan, shubh, ashutosh, advait, anand, tarun, sunny,
#       mani, gokul, vijay, mohit, rehan, soham


class SarvamLKTTS(tts.TTS):
    """Sarvam AI TTS as a livekit-agents plugin (non-streaming)."""

    def __init__(self, *, api_key: str, voice: str = "anushka", language: str = "hi-IN"):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=22050,
            num_channels=1,
        )
        self._api_key = api_key
        self._voice = voice
        self._language = language

    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS):
        return _SarvamChunkedStream(
            tts=self,
            input_text=text,
            conn_options=conn_options,
            api_key=self._api_key,
            voice=self._voice,
            language=self._language,
        )


class _SarvamChunkedStream(tts.ChunkedStream):
    def __init__(self, *, tts, input_text, conn_options, api_key, voice, language):
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._api_key = api_key
        self._voice = voice
        self._language = language

    async def _run(self, output_emitter: tts.AudioEmitter):
        # Auto-detect: if text is mostly ASCII, use en-IN; otherwise use configured language
        ascii_ratio = sum(1 for c in self.input_text if ord(c) < 128) / max(len(self.input_text), 1)
        lang = "en-IN" if ascii_ratio > 0.9 else self._language

        payload = {
            "inputs": [self.input_text],
            "target_language_code": lang,
            "speaker": self._voice,
            "model": SARVAM_MODEL,
            "enable_preprocessing": True,
        }

        try:
            async with utils.http_context.http_session().post(
                SARVAM_API_URL,
                json=payload,
                headers={
                    "API-Subscription-Key": self._api_key,
                    "Content-Type": "application/json",
                },
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

            audios = data.get("audios", [])
            if audios:
                audio_bytes = base64.b64decode(audios[0])
                output_emitter.push(audio_bytes)

        except Exception as e:
            logger.error(f"Sarvam TTS error: {e}")
            raise tts.TTSError(f"Sarvam TTS failed: {e}") from e
