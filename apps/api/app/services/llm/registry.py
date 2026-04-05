from app.services.llm.base import BaseLLMProvider
from app.services.llm.groq_provider import GroqProvider
from app.services.llm.gemini_provider import GeminiProvider
from app.services.llm.mistral_provider import MistralProvider
from app.services.llm.together_provider import TogetherProvider
from app.services.llm.openai_provider import OpenAIProvider
from app.services.llm.anthropic_provider import AnthropicProvider
from app.services.llm.cohere_provider import CohereProvider

LLM_PROVIDERS: dict[str, type[BaseLLMProvider]] = {
    "groq": GroqProvider,
    "google": GeminiProvider,
    "mistral": MistralProvider,
    "together": TogetherProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "cohere": CohereProvider,
}


def get_llm_provider(provider_name: str, api_key: str, **kwargs) -> BaseLLMProvider:
    """Get an LLM provider instance by name."""
    provider_class = LLM_PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f"Unknown LLM provider: {provider_name}. Available: {list(LLM_PROVIDERS.keys())}")
    return provider_class(api_key=api_key, **kwargs)
