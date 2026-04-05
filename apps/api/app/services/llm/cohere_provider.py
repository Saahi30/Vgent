from typing import AsyncGenerator
import cohere
from app.services.llm.base import BaseLLMProvider, LLMModel


class CohereProvider(BaseLLMProvider):
    """Cohere LLM provider — paid tier with powerful command models."""

    provider_name = "cohere"

    MODELS = [
        LLMModel(id="command-r-plus", name="Command R+", context_window=128000, is_free=False),
        LLMModel(id="command-r", name="Command R", context_window=128000, is_free=False),
        LLMModel(id="command", name="Command", context_window=4096, is_free=False),
    ]

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = cohere.AsyncClientV2(api_key=api_key)

    async def complete(
        self,
        messages: list[dict],
        model: str = "command-r-plus",
        temperature: float = 0.7,
        max_tokens: int = 300,
        stream: bool = True,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        if stream:
            async for event in self.client.chat_stream(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            ):
                if event.type == "content-delta":
                    text = event.delta.message.content.text
                    if text:
                        yield text
        else:
            response = await self.client.chat(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = response.message.content
            if content:
                yield content[0].text

    async def get_available_models(self) -> list[LLMModel]:
        return self.MODELS
