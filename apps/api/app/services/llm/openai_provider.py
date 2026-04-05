from typing import AsyncGenerator
from openai import AsyncOpenAI
from app.services.llm.base import BaseLLMProvider, LLMModel


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM provider — paid, but included for completeness."""

    provider_name = "openai"

    MODELS = [
        LLMModel(id="gpt-4o", name="GPT-4o", context_window=128000),
        LLMModel(id="gpt-4o-mini", name="GPT-4o Mini", context_window=128000),
        LLMModel(id="gpt-3.5-turbo", name="GPT-3.5 Turbo", context_window=16385),
    ]

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = AsyncOpenAI(api_key=api_key)

    async def complete(
        self,
        messages: list[dict],
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
        max_tokens: int = 300,
        stream: bool = True,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
        )

        if stream:
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        else:
            yield response.choices[0].message.content or ""

    async def get_available_models(self) -> list[LLMModel]:
        return self.MODELS
