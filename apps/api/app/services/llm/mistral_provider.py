from typing import AsyncGenerator
from mistralai import Mistral
from app.services.llm.base import BaseLLMProvider, LLMModel


class MistralProvider(BaseLLMProvider):
    """Mistral AI LLM provider — free tier available."""

    provider_name = "mistral"

    MODELS = [
        LLMModel(id="mistral-small-latest", name="Mistral Small", context_window=32768, is_free=True),
        LLMModel(id="open-mistral-7b", name="Mistral 7B", context_window=32768, is_free=True),
        LLMModel(id="open-mixtral-8x7b", name="Mixtral 8x7B", context_window=32768, is_free=True),
        LLMModel(id="open-mixtral-8x22b", name="Mixtral 8x22B", context_window=65536, is_free=False),
    ]

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = Mistral(api_key=api_key)

    async def complete(
        self,
        messages: list[dict],
        model: str = "mistral-small-latest",
        temperature: float = 0.7,
        max_tokens: int = 300,
        stream: bool = True,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        if stream:
            response = await self.client.chat.stream_async(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            async for event in response:
                if event.data and event.data.choices:
                    delta = event.data.choices[0].delta
                    if delta and delta.content:
                        yield delta.content
        else:
            response = await self.client.chat.complete_async(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            if response and response.choices:
                yield response.choices[0].message.content or ""

    async def get_available_models(self) -> list[LLMModel]:
        return self.MODELS
