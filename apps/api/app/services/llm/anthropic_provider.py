from typing import AsyncGenerator
from anthropic import AsyncAnthropic
from app.services.llm.base import BaseLLMProvider, LLMModel


class AnthropicProvider(BaseLLMProvider):
    """Anthropic LLM provider — paid."""

    provider_name = "anthropic"

    MODELS = [
        LLMModel(id="claude-sonnet-4-6", name="Claude Sonnet 4.6", context_window=200000),
        LLMModel(id="claude-haiku-4-5-20251001", name="Claude Haiku 4.5", context_window=200000),
    ]

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        self.client = AsyncAnthropic(api_key=api_key)

    async def complete(
        self,
        messages: list[dict],
        model: str = "claude-sonnet-4-6",
        temperature: float = 0.7,
        max_tokens: int = 300,
        stream: bool = True,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        # Extract system message
        system = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system = msg["content"]
            else:
                chat_messages.append(msg)

        if stream:
            async with self.client.messages.stream(
                model=model,
                messages=chat_messages,
                system=system,
                temperature=temperature,
                max_tokens=max_tokens,
            ) as response:
                async for text in response.text_stream:
                    yield text
        else:
            response = await self.client.messages.create(
                model=model,
                messages=chat_messages,
                system=system,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            yield response.content[0].text if response.content else ""

    async def get_available_models(self) -> list[LLMModel]:
        return self.MODELS
