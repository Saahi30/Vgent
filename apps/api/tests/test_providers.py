"""Tests for provider registries (LLM, STT, TTS, Telephony)."""

import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# LLM Registry
# ---------------------------------------------------------------------------


class TestLLMRegistry:
    def test_groq_provider(self):
        from app.services.llm.registry import LLM_PROVIDERS, get_llm_provider
        from app.services.llm.groq_provider import GroqProvider
        assert LLM_PROVIDERS["groq"] is GroqProvider

    def test_gemini_provider(self):
        from app.services.llm.registry import LLM_PROVIDERS
        from app.services.llm.gemini_provider import GeminiProvider
        assert LLM_PROVIDERS["google"] is GeminiProvider

    def test_mistral_provider(self):
        from app.services.llm.registry import LLM_PROVIDERS
        from app.services.llm.mistral_provider import MistralProvider
        assert LLM_PROVIDERS["mistral"] is MistralProvider

    def test_together_provider(self):
        from app.services.llm.registry import LLM_PROVIDERS
        from app.services.llm.together_provider import TogetherProvider
        assert LLM_PROVIDERS["together"] is TogetherProvider

    def test_openai_provider(self):
        from app.services.llm.registry import LLM_PROVIDERS
        from app.services.llm.openai_provider import OpenAIProvider
        assert LLM_PROVIDERS["openai"] is OpenAIProvider

    def test_anthropic_provider(self):
        from app.services.llm.registry import LLM_PROVIDERS
        from app.services.llm.anthropic_provider import AnthropicProvider
        assert LLM_PROVIDERS["anthropic"] is AnthropicProvider

    def test_cohere_provider(self):
        from app.services.llm.registry import LLM_PROVIDERS
        from app.services.llm.cohere_provider import CohereProvider
        assert LLM_PROVIDERS["cohere"] is CohereProvider

    def test_unknown_llm_raises_value_error(self):
        from app.services.llm.registry import get_llm_provider
        with pytest.raises(ValueError, match="Unknown LLM provider"):
            get_llm_provider("nonexistent", api_key="key")

    def test_get_llm_provider_returns_instance(self):
        from app.services.llm.registry import get_llm_provider, LLM_PROVIDERS
        from app.services.llm.base import BaseLLMProvider

        # Patch the actual provider class to avoid needing real API keys
        mock_cls = MagicMock(spec=BaseLLMProvider)
        with patch.dict(LLM_PROVIDERS, {"test_provider": mock_cls}):
            get_llm_provider("test_provider", api_key="fake-key")
            mock_cls.assert_called_once_with(api_key="fake-key")

    def test_all_providers_are_registered(self):
        from app.services.llm.registry import LLM_PROVIDERS
        expected = {"groq", "google", "mistral", "together", "openai", "anthropic", "cohere"}
        assert set(LLM_PROVIDERS.keys()) == expected


# ---------------------------------------------------------------------------
# STT Registry
# ---------------------------------------------------------------------------


class TestSTTRegistry:
    def test_deepgram_provider(self):
        from app.services.stt.registry import STT_PROVIDERS
        from app.services.stt.deepgram_provider import DeepgramProvider
        assert STT_PROVIDERS["deepgram"] is DeepgramProvider

    def test_google_stt_provider(self):
        from app.services.stt.registry import STT_PROVIDERS
        from app.services.stt.google_stt_provider import GoogleSTTProvider
        assert STT_PROVIDERS["google"] is GoogleSTTProvider

    def test_assemblyai_provider(self):
        from app.services.stt.registry import STT_PROVIDERS
        from app.services.stt.assemblyai_provider import AssemblyAIProvider
        assert STT_PROVIDERS["assemblyai"] is AssemblyAIProvider

    def test_unknown_stt_raises_value_error(self):
        from app.services.stt.registry import get_stt_provider
        with pytest.raises(ValueError, match="Unknown STT provider"):
            get_stt_provider("nonexistent", api_key="key")

    def test_all_stt_providers_are_registered(self):
        from app.services.stt.registry import STT_PROVIDERS
        expected = {"deepgram", "google", "assemblyai"}
        assert set(STT_PROVIDERS.keys()) == expected


# ---------------------------------------------------------------------------
# TTS Registry
# ---------------------------------------------------------------------------


class TestTTSRegistry:
    def test_edge_tts_provider(self):
        from app.services.tts.registry import TTS_PROVIDERS
        from app.services.tts.edge_tts_provider import EdgeTTSProvider
        assert TTS_PROVIDERS["edge_tts"] is EdgeTTSProvider

    def test_gtts_provider(self):
        from app.services.tts.registry import TTS_PROVIDERS
        from app.services.tts.gtts_provider import GTTSProvider
        assert TTS_PROVIDERS["gtts"] is GTTSProvider

    def test_sarvam_provider(self):
        from app.services.tts.registry import TTS_PROVIDERS
        from app.services.tts.sarvam_provider import SarvamProvider
        assert TTS_PROVIDERS["sarvam"] is SarvamProvider

    def test_elevenlabs_provider(self):
        from app.services.tts.registry import TTS_PROVIDERS
        from app.services.tts.elevenlabs_provider import ElevenLabsProvider
        assert TTS_PROVIDERS["elevenlabs"] is ElevenLabsProvider

    def test_google_cloud_tts_provider(self):
        from app.services.tts.registry import TTS_PROVIDERS
        from app.services.tts.google_tts_provider import GoogleCloudTTSProvider
        assert TTS_PROVIDERS["google_tts"] is GoogleCloudTTSProvider

    def test_unknown_tts_raises_value_error(self):
        from app.services.tts.registry import get_tts_provider
        with pytest.raises(ValueError, match="Unknown TTS provider"):
            get_tts_provider("nonexistent")

    def test_free_tts_providers(self):
        from app.services.tts.registry import FREE_TTS_PROVIDERS
        assert "edge_tts" in FREE_TTS_PROVIDERS
        assert "gtts" in FREE_TTS_PROVIDERS
        assert "elevenlabs" not in FREE_TTS_PROVIDERS

    def test_all_tts_providers_are_registered(self):
        from app.services.tts.registry import TTS_PROVIDERS
        expected = {"edge_tts", "gtts", "sarvam", "google_tts", "elevenlabs"}
        assert set(TTS_PROVIDERS.keys()) == expected


# ---------------------------------------------------------------------------
# Telephony Registry
# ---------------------------------------------------------------------------


class TestTelephonyRegistry:
    def test_twilio_provider(self):
        from app.services.telephony.registry import TELEPHONY_PROVIDERS
        from app.services.telephony.twilio_provider import TwilioProvider
        assert TELEPHONY_PROVIDERS["twilio"] is TwilioProvider

    def test_vobiz_provider(self):
        from app.services.telephony.registry import TELEPHONY_PROVIDERS
        from app.services.telephony.vobiz_provider import VobizProvider
        assert TELEPHONY_PROVIDERS["vobiz"] is VobizProvider

    def test_webrtc_provider(self):
        from app.services.telephony.registry import TELEPHONY_PROVIDERS
        from app.services.telephony.webrtc_provider import WebRTCProvider
        assert TELEPHONY_PROVIDERS["webrtc"] is WebRTCProvider

    def test_plivo_provider(self):
        from app.services.telephony.registry import TELEPHONY_PROVIDERS
        from app.services.telephony.plivo_provider import PlivoProvider
        assert TELEPHONY_PROVIDERS["plivo"] is PlivoProvider

    def test_unknown_telephony_raises_value_error(self):
        from app.services.telephony.registry import get_telephony_provider
        with pytest.raises(ValueError, match="Unknown telephony provider"):
            get_telephony_provider("nonexistent")

    def test_all_telephony_providers_are_registered(self):
        from app.services.telephony.registry import TELEPHONY_PROVIDERS
        expected = {"twilio", "vobiz", "webrtc", "plivo"}
        assert set(TELEPHONY_PROVIDERS.keys()) == expected
