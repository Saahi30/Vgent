from typing import AsyncGenerator
from together import AsyncTogether
from app.services.llm.base import BaseLLMProvider, LLMModel


class TogetherProvider(BaseLLMProvider):
    """Together AI LLM provider — $5 free signup credits."""

    provider_name = "together"

    MODELS = [
        LLMModel(id="meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", name="Llama 3.1 70B Turbo", context_window=131072, is_free=False),
        LLMModel(id="meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", name="Llama 3.1 8B Turbo", context_window=131072, is_free=False),
        LLMModel(id="mistralai/Mixtral-8x7B-Instruct-v0.1", name="Mixtral 8x7B", context_window=32768, is_free=False),
        LLMModel(id="Qwen/Qwen2-72B-Instruct", name="Qwen2 72B", context_window=32768, is_free=False),
    ]

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = AsyncTogether(api_key=api_key)

    async def complete(
        self,
        messages: list[dict],
        model: str = "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
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
