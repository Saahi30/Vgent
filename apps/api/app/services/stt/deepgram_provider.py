from typing import AsyncGenerator
import json
import websockets
from app.services.stt.base import BaseSTTProvider, TranscriptChunk


class DeepgramProvider(BaseSTTProvider):
    """Deepgram STT provider — $200 free credits, excellent streaming support."""

    provider_name = "deepgram"

    DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)

    async def transcribe_stream(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        language: str = "en-US",
        sample_rate: int = 16000,
        encoding: str = "linear16",
        **kwargs,
    ) -> AsyncGenerator[TranscriptChunk, None]:
        """Stream audio to Deepgram and yield transcript chunks in real-time."""
        params = (
            f"?model=nova-2"
            f"&language={language}"
            f"&encoding={encoding}"
            f"&sample_rate={sample_rate}"
            f"&channels=1"
            f"&punctuate=true"
            f"&interim_results=true"
            f"&endpointing=300"
            f"&vad_events=true"
        )

        url = f"{self.DEEPGRAM_WS_URL}{params}"
        headers = {"Authorization": f"Token {self.api_key}"}

        async with websockets.connect(url, extra_headers=headers) as ws:
            import asyncio

            async def send_audio():
                async for chunk in audio_stream:
                    await ws.send(chunk)
                # Signal end of audio
                await ws.send(json.dumps({"type": "CloseStream"}))

            send_task = asyncio.create_task(send_audio())

            try:
                async for msg in ws:
                    data = json.loads(msg)
                    msg_type = data.get("type", "")

                    if msg_type == "Results":
                        channel = data.get("channel", {})
                        alternatives = channel.get("alternatives", [])
                        if alternatives:
                            alt = alternatives[0]
                            transcript = alt.get("transcript", "")
                            if transcript:
                                yield TranscriptChunk(
                                    text=transcript,
                                    is_final=data.get("is_final", False),
                                    confidence=alt.get("confidence", 0.0),
                                    language=data.get("channel_index", [0, 1])[0] if isinstance(data.get("channel_index"), list) else "",
                                )
            finally:
                send_task.cancel()

    async def transcribe_file(
        self,
        audio_bytes: bytes,
        language: str = "en-US",
        **kwargs,
    ) -> str:
        """Transcribe a complete audio file via Deepgram REST API."""
        import httpx

        url = "https://api.deepgram.com/v1/listen"
        params = {
            "model": "nova-2",
            "language": language,
            "punctuate": "true",
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                params=params,
                content=audio_bytes,
                headers={
                    "Authorization": f"Token {self.api_key}",
                    "Content-Type": "audio/wav",
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()

        results = data.get("results", {})
        channels = results.get("channels", [])
        if channels:
            alternatives = channels[0].get("alternatives", [])
            if alternatives:
                return alternatives[0].get("transcript", "")

        return ""
