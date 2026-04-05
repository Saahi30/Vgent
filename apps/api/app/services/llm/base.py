from abc import ABC, abstractmethod
from typing import AsyncGenerator
from dataclasses import dataclass


@dataclass
class LLMModel:
    id: str
    name: str
    context_window: int = 0
    is_free: bool = False


class BaseLLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    provider_name: str = ""

    def __init__(self, api_key: str, **kwargs):
        self.api_key = api_key

    @abstractmethod
    async def complete(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 300,
        stream: bool = True,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """Stream or return a completion from the LLM.
        Yields text chunks when streaming, or yields the full response as a single chunk.
        """
        ...

    @abstractmethod
    async def get_available_models(self) -> list[LLMModel]:
        """Return list of models available with this provider."""
        ...

    def estimate_tokens(self, text: str) -> int:
        """Rough token estimate (~4 chars per token for English)."""
        return len(text) // 4
