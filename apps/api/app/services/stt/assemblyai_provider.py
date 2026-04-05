from typing import AsyncGenerator
import asyncio
import assemblyai
from app.services.stt.base import BaseSTTProvider, TranscriptChunk


class AssemblyAIProvider(BaseSTTProvider):
    """AssemblyAI STT provider — paid tier with excellent real-time transcription."""

    provider_name = "assemblyai"

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        assemblyai.settings.api_key = api_key

    async def transcribe_stream(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        language: str = "en-US",
        sample_rate: int = 16000,
        **kwargs,
    ) -> AsyncGenerator[TranscriptChunk, None]:
        """Stream audio to AssemblyAI real-time transcriber and yield transcript chunks."""
        chunk_queue: asyncio.Queue[TranscriptChunk | None] = asyncio.Queue()

        def on_data(transcript: assemblyai.RealtimeTranscript):
            text = transcript.text
            if not text:
                return

            is_final = isinstance(transcript, assemblyai.RealtimeFinalTranscript)
            confidence = transcript.confidence if hasattr(transcript, "confidence") else 0.0

            chunk_queue.put_nowait(
                TranscriptChunk(
                    text=text,
                    is_final=is_final,
                    confidence=confidence,
                    language=language,
                )
            )

        def on_error(error: assemblyai.RealtimeError):
            chunk_queue.put_nowait(None)

        def on_close():
            chunk_queue.put_nowait(None)

        transcriber = assemblyai.RealtimeTranscriber(
            sample_rate=sample_rate,
            on_data=on_data,
            on_error=on_error,
            on_close=on_close,
        )

        transcriber.connect()

        async def send_audio():
            try:
                async for audio_data in audio_stream:
                    transcriber.stream(audio_data)
            finally:
                transcriber.close()

        send_task = asyncio.create_task(send_audio())

        try:
            while True:
                chunk = await chunk_queue.get()
                if chunk is None:
                    break
                yield chunk
        finally:
            send_task.cancel()

    async def transcribe_file(
        self,
        audio_bytes: bytes,
        language: str = "en-US",
        **kwargs,
    ) -> str:
        """Transcribe a complete audio file via AssemblyAI."""
        import tempfile
        import os

        # AssemblyAI SDK expects a file path; write to temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            config = assemblyai.TranscriptionConfig(language_code=language)
            transcriber = assemblyai.Transcriber(config=config)

            # Run the synchronous transcription in a thread pool
            transcript = await asyncio.get_event_loop().run_in_executor(
                None, transcriber.transcribe, tmp_path
            )

            if transcript.status == assemblyai.TranscriptStatus.error:
                raise RuntimeError(f"AssemblyAI transcription failed: {transcript.error}")

            return transcript.text or ""
        finally:
            os.unlink(tmp_path)
