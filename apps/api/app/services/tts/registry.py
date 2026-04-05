from app.services.tts.base import BaseTTSProvider
from app.services.tts.edge_tts_provider import EdgeTTSProvider
from app.services.tts.gtts_provider import GTTSProvider
from app.services.tts.sarvam_provider import SarvamProvider
from app.services.tts.google_tts_provider import GoogleCloudTTSProvider
from app.services.tts.elevenlabs_provider import ElevenLabsProvider

TTS_PROVIDERS: dict[str, type[BaseTTSProvider]] = {
    "edge_tts": EdgeTTSProvider,
    "gtts": GTTSProvider,
    "sarvam": SarvamProvider,
    "google_tts": GoogleCloudTTSProvider,
    "elevenlabs": ElevenLabsProvider,
}

# Providers that need no API key
FREE_TTS_PROVIDERS = {"edge_tts", "gtts"}


def get_tts_provider(provider_name: str, api_key: str = "", **kwargs) -> BaseTTSProvider:
    """Get a TTS provider instance by name."""
    provider_class = TTS_PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f"Unknown TTS provider: {provider_name}. Available: {list(TTS_PROVIDERS.keys())}")
    return provider_class(api_key=api_key, **kwargs)
