"""Post-call analysis: generate summary and sentiment from call transcript."""

import json
import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.call import Call, CallTurn
from app.models.contact import Contact
from app.models.provider_credential import ProviderCredential
from app.services.llm.registry import get_llm_provider

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """\
You are a call analysis assistant. Analyze the following phone call transcript and produce a JSON object with exactly three keys:

1. "summary": A concise 2-4 sentence summary of the call covering the purpose, key points discussed, outcome, and any follow-up actions.
2. "sentiment": An object with:
   - "score": A float from -1.0 (very negative) to 1.0 (very positive). 0.0 is neutral.
   - "label": One of "positive", "negative", "neutral", or "mixed".
3. "outcome": One of the following classifications for the call result:
   - "converted" — the customer agreed, signed up, purchased, or otherwise completed the desired action.
   - "callback-needed" — the customer showed interest but requested a callback or needs follow-up.
   - "not-interested" — the customer explicitly declined or showed no interest.
   - "no-answer" — the call was not answered by a human (rang out, line busy, disconnected early).
   - "voicemail" — the call reached a voicemail or answering machine.

Respond with ONLY valid JSON, no markdown fences or extra text.

Transcript:
{transcript}
"""

VALID_OUTCOMES = {"converted", "callback-needed", "not-interested", "no-answer", "voicemail"}


@dataclass
class AnalysisResult:
    summary: str
    sentiment_score: float
    sentiment_label: str
    outcome: str


async def _get_llm_provider_for_tenant(db: AsyncSession, tenant_id: str):
    """Find the tenant's default LLM credential, falling back to env config."""
    result = await db.execute(
        select(ProviderCredential).where(
            ProviderCredential.tenant_id == tenant_id,
            ProviderCredential.provider_type == "llm",
            ProviderCredential.is_default == True,
        )
    )
    cred = result.scalar_one_or_none()

    if cred:
        api_key = cred.credentials.get("api_key", "")
        return get_llm_provider(cred.provider_name, api_key), cred.provider_name

    # Fallback: use env-level keys, prefer groq (free)
    from app.core.config import get_settings
    settings = get_settings()

    for provider_name, key_attr in [
        ("groq", "groq_api_key"),
        ("openai", "openai_api_key"),
        ("anthropic", "anthropic_api_key"),
        ("google", "google_api_key"),
    ]:
        api_key = getattr(settings, key_attr, "")
        if api_key:
            return get_llm_provider(provider_name, api_key), provider_name

    return None, None


# Default models per provider for analysis (prefer cheap/fast)
_ANALYSIS_MODELS = {
    "groq": "llama-3.1-70b-versatile",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5-20251001",
    "google": "gemini-2.0-flash",
    "mistral": "mistral-small-latest",
    "together": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    "cohere": "command-r",
}


def _build_transcript_text(turns: list[CallTurn]) -> str:
    lines = []
    for turn in turns:
        role = "Customer" if turn.role == "user" else "Agent"
        lines.append(f"{role}: {turn.content}")
    return "\n".join(lines)


def _parse_analysis_response(text: str) -> AnalysisResult:
    """Parse LLM JSON response into AnalysisResult."""
    # Strip markdown fences if present
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    data = json.loads(cleaned)

    summary = data.get("summary", "")
    sentiment = data.get("sentiment", {})
    score = float(sentiment.get("score", 0.0))
    label = sentiment.get("label", "neutral")

    # Clamp score
    score = max(-1.0, min(1.0, score))
    if label not in ("positive", "negative", "neutral", "mixed"):
        label = "neutral"

    outcome = data.get("outcome", "no-answer")
    if outcome not in VALID_OUTCOMES:
        outcome = "no-answer"

    return AnalysisResult(summary=summary, sentiment_score=score, sentiment_label=label, outcome=outcome)


async def analyze_call(db: AsyncSession, call_id: str) -> AnalysisResult | None:
    """Run post-call analysis on a completed call. Returns result or None on failure."""
    # Load call and turns
    call_result = await db.execute(select(Call).where(Call.id == call_id))
    call = call_result.scalar_one_or_none()
    if not call:
        logger.warning("analyze_call: call %s not found", call_id)
        return None

    turns_result = await db.execute(
        select(CallTurn).where(CallTurn.call_id == call_id).order_by(CallTurn.created_at)
    )
    turns = turns_result.scalars().all()

    if not turns:
        logger.info("analyze_call: call %s has no transcript turns, skipping", call_id)
        return None

    transcript = _build_transcript_text(turns)
    if len(transcript) < 20:
        logger.info("analyze_call: transcript too short for call %s, skipping", call_id)
        return None

    # Get LLM provider
    provider, provider_name = await _get_llm_provider_for_tenant(db, str(call.tenant_id))
    if not provider:
        logger.error("analyze_call: no LLM provider available for tenant %s", call.tenant_id)
        return None

    model = _ANALYSIS_MODELS.get(provider_name, "llama-3.1-70b-versatile")

    messages = [
        {"role": "user", "content": ANALYSIS_PROMPT.format(transcript=transcript)}
    ]

    try:
        # Collect streamed response
        full_response = ""
        async for chunk in provider.complete(
            messages=messages,
            model=model,
            temperature=0.3,
            max_tokens=500,
            stream=True,
        ):
            full_response += chunk

        result = _parse_analysis_response(full_response)

        # Persist to DB
        call.summary = result.summary
        call.sentiment_score = result.sentiment_score
        call.sentiment_label = result.sentiment_label
        call.outcome = result.outcome
        await db.flush()

        # Auto-tag contact with latest outcome
        if call.contact_id:
            contact_result = await db.execute(
                select(Contact).where(Contact.id == call.contact_id)
            )
            contact = contact_result.scalar_one_or_none()
            if contact:
                meta = dict(contact.metadata_) if contact.metadata_ else {}
                meta["last_call_outcome"] = result.outcome
                contact.metadata_ = meta
                await db.flush()

        logger.info(
            "analyze_call: call %s analyzed — sentiment=%s (%.2f), outcome=%s",
            call_id, result.sentiment_label, result.sentiment_score, result.outcome,
        )
        return result

    except Exception:
        logger.exception("analyze_call: failed to analyze call %s", call_id)
        return None
