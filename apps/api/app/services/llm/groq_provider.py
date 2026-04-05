from typing import AsyncGenerator
from groq import AsyncGroq
from app.services.llm.base import BaseLLMProvider, LLMModel


class GroqProvider(BaseLLMProvider):
    """Groq LLM provider — free tier with fast inference."""

    provider_name = "groq"

    MODELS = [
        LLMModel(id="llama-3.1-70b-versatile", name="Llama 3.1 70B", context_window=131072, is_free=True),
        LLMModel(id="llama-3.1-8b-instant", name="Llama 3.1 8B", context_window=131072, is_free=True),
        LLMModel(id="llama3-70b-8192", name="Llama 3 70B", context_window=8192, is_free=True),
        LLMModel(id="llama3-8b-8192", name="Llama 3 8B", context_window=8192, is_free=True),
        LLMModel(id="mixtral-8x7b-32768", name="Mixtral 8x7B", context_window=32768, is_free=True),
        LLMModel(id="gemma2-9b-it", name="Gemma 2 9B", context_window=8192, is_free=True),
    ]

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = AsyncGroq(api_key=api_key)

    async def complete(
        self,
        messages: list[dict],
        model: str = "llama-3.1-70b-versatile",
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
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield delta.content
        else:
            yield response.choices[0].message.content or ""

    async def get_available_models(self) -> list[LLMModel]:
        return self.MODELS
