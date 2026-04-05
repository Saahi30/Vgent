from typing import AsyncGenerator
import google.generativeai as genai
from app.services.llm.base import BaseLLMProvider, LLMModel


class GeminiProvider(BaseLLMProvider):
    """Google Gemini LLM provider — free tier available."""

    provider_name = "google"

    MODELS = [
        LLMModel(id="gemini-1.5-flash", name="Gemini 1.5 Flash", context_window=1048576, is_free=True),
        LLMModel(id="gemini-1.5-pro", name="Gemini 1.5 Pro", context_window=2097152, is_free=True),
        LLMModel(id="gemini-2.0-flash", name="Gemini 2.0 Flash", context_window=1048576, is_free=True),
    ]

    def __init__(self, api_key: str, **kwargs):
        super().__init__(api_key, **kwargs)
        genai.configure(api_key=api_key)

    async def complete(
        self,
        messages: list[dict],
        model: str = "gemini-1.5-flash",
        temperature: float = 0.7,
        max_tokens: int = 300,
        stream: bool = True,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        # Convert OpenAI-style messages to Gemini format
        gemini_messages = []
        system_instruction = None

        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            if role == "system":
                system_instruction = content
                continue

            gemini_role = "user" if role == "user" else "model"
            gemini_messages.append({"role": gemini_role, "parts": [content]})

        gen_model = genai.GenerativeModel(
            model_name=model,
            system_instruction=system_instruction,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )

        if stream:
            response = await gen_model.generate_content_async(
                gemini_messages,
                stream=True,
            )
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
        else:
            response = await gen_model.generate_content_async(gemini_messages)
            yield response.text or ""

    async def get_available_models(self) -> list[LLMModel]:
        return self.MODELS
