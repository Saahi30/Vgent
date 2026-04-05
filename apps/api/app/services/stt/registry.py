from app.services.stt.base import BaseSTTProvider
from app.services.stt.deepgram_provider import DeepgramProvider
from app.services.stt.google_stt_provider import GoogleSTTProvider
from app.services.stt.assemblyai_provider import AssemblyAIProvider

STT_PROVIDERS: dict[str, type[BaseSTTProvider]] = {
    "deepgram": DeepgramProvider,
    "google": GoogleSTTProvider,
    "assemblyai": AssemblyAIProvider,
}


def get_stt_provider(provider_name: str, api_key: str, **kwargs) -> BaseSTTProvider:
    """Get an STT provider instance by name."""
    provider_class = STT_PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f"Unknown STT provider: {provider_name}. Available: {list(STT_PROVIDERS.keys())}")
    return provider_class(api_key=api_key, **kwargs)
