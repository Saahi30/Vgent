from pydantic_settings import BaseSettings
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    # Accept NEXT_PUBLIC_ prefixed variants (used by frontend .env.local)
    next_public_supabase_url: str = ""
    next_public_supabase_anon_key: str = ""

    @model_validator(mode="after")
    def _fill_supabase_from_next_public(self):
        if not self.supabase_url and self.next_public_supabase_url:
            self.supabase_url = self.next_public_supabase_url
        if not self.supabase_anon_key and self.next_public_supabase_anon_key:
            self.supabase_anon_key = self.next_public_supabase_anon_key
        return self
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Storage (R2/S3)
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "vgent-recordings"
    r2_public_url: str = ""

    # LiveKit (real-time audio infrastructure)
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # Telephony
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    twilio_webhook_base_url: str = ""

    # Vobiz (SIP Trunking via LiveKit)
    vobiz_sip_trunk_id: str = ""
    vobiz_sip_domain: str = ""
    vobiz_username: str = ""
    vobiz_password: str = ""
    vobiz_outbound_number: str = ""
    default_transfer_number: str = ""

    plivo_auth_id: str = ""
    plivo_auth_token: str = ""
    plivo_phone_number: str = ""
    plivo_webhook_base_url: str = ""

    # LLM Providers
    groq_api_key: str = ""
    google_api_key: str = ""
    mistral_api_key: str = ""
    together_api_key: str = ""
    cohere_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # STT Providers
    deepgram_api_key: str = ""
    google_cloud_credentials_json: str = ""
    assemblyai_api_key: str = ""
    azure_speech_key: str = ""
    azure_speech_region: str = ""

    # TTS Providers
    sarvam_api_key: str = ""
    elevenlabs_api_key: str = ""
    cartesia_api_key: str = ""

    # Bolna
    bolna_api_key: str = ""
    bolna_base_url: str = "https://api.bolna.ai"

    # App
    api_url: str = "http://localhost:8000"
    app_url: str = "http://localhost:3000"
    cors_origins: str = ""  # Comma-separated extra origins (e.g. "https://vgent-web-tau.vercel.app,https://custom.domain")
    api_secret_key: str = "dev-secret-change-me"
    fernet_encryption_key: str = ""
    supabase_jwt_secret: str = ""

    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"

    class Config:
        env_file = "../../.env.local"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
