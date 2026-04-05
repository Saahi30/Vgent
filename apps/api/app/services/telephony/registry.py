from app.services.telephony.base import BaseTelephonyProvider
from app.services.telephony.twilio_provider import TwilioProvider
from app.services.telephony.vobiz_provider import VobizProvider
from app.services.telephony.webrtc_provider import WebRTCProvider
from app.services.telephony.plivo_provider import PlivoProvider
from app.core.config import get_settings

TELEPHONY_PROVIDERS: dict[str, type[BaseTelephonyProvider]] = {
    "twilio": TwilioProvider,
    "vobiz": VobizProvider,
    "webrtc": WebRTCProvider,
    "plivo": PlivoProvider,
}


def get_telephony_provider(provider_name: str, **kwargs) -> BaseTelephonyProvider:
    """Get a telephony provider instance by name.

    For vobiz and webrtc, LiveKit credentials are injected from settings
    if not provided in kwargs.
    """
    settings = get_settings()

    # Inject LiveKit creds for providers that need them
    if provider_name in ("vobiz", "webrtc"):
        kwargs.setdefault("livekit_url", settings.livekit_url)
        kwargs.setdefault("livekit_api_key", settings.livekit_api_key)
        kwargs.setdefault("livekit_api_secret", settings.livekit_api_secret)

    if provider_name == "vobiz":
        kwargs.setdefault("sip_trunk_id", settings.vobiz_sip_trunk_id)
        kwargs.setdefault("sip_domain", settings.vobiz_sip_domain)
        kwargs.setdefault("username", settings.vobiz_username)
        kwargs.setdefault("password", settings.vobiz_password)
        kwargs.setdefault("outbound_number", settings.vobiz_outbound_number)

    if provider_name == "twilio":
        kwargs.setdefault("account_sid", settings.twilio_account_sid)
        kwargs.setdefault("auth_token", settings.twilio_auth_token)
        kwargs.setdefault("phone_number", settings.twilio_phone_number)
        kwargs.setdefault("webhook_base_url", settings.twilio_webhook_base_url)

    if provider_name == "plivo":
        kwargs.setdefault("auth_id", settings.plivo_auth_id)
        kwargs.setdefault("auth_token", settings.plivo_auth_token)
        kwargs.setdefault("phone_number", settings.plivo_phone_number)
        kwargs.setdefault("webhook_base_url", settings.plivo_webhook_base_url)

    provider_class = TELEPHONY_PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f"Unknown telephony provider: {provider_name}. Available: {list(TELEPHONY_PROVIDERS.keys())}")
    return provider_class(**kwargs)
