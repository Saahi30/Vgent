"""
Bolna API client — wraps Bolna's REST API for agent management,
call initiation, batch operations, execution monitoring, phone numbers,
voices, providers, inbound setup, SIP trunks, extractions, and user info.

Docs: https://www.bolna.ai/docs/api-reference
"""

import httpx
from typing import Any
from app.core.config import get_settings

TIMEOUT = 30.0


def _headers(api_key: str | None = None) -> dict[str, str]:
    key = api_key or get_settings().bolna_api_key
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _base_url() -> str:
    return get_settings().bolna_base_url.rstrip("/")


# ── Agents ────────────────────────────────────────────────────

async def create_agent(agent_config: dict, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/v2/agent",
            headers=_headers(api_key),
            json={"agent_config": agent_config},
        )
        r.raise_for_status()
        return r.json()


async def get_agent(agent_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/v2/agent/{agent_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def update_agent(agent_id: str, agent_config: dict, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.put(
            f"{_base_url()}/v2/agent/{agent_id}",
            headers=_headers(api_key),
            json={"agent_config": agent_config},
        )
        r.raise_for_status()
        return r.json()


async def patch_agent(agent_id: str, updates: dict, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.patch(
            f"{_base_url()}/v2/agent/{agent_id}",
            headers=_headers(api_key),
            json=updates,
        )
        r.raise_for_status()
        return r.json()


async def delete_agent(agent_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.delete(
            f"{_base_url()}/v2/agent/{agent_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def list_agents(api_key: str | None = None) -> list[dict]:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/v2/agent/all",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def stop_agent_calls(agent_id: str, api_key: str | None = None) -> dict:
    """Stop all queued/scheduled calls for an agent."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/v2/agent/{agent_id}/stop",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── Calls ─────────────────────────────────────────────────────

async def make_call(
    agent_id: str,
    recipient_phone_number: str,
    *,
    user_data: dict | None = None,
    retry_config: dict | None = None,
    api_key: str | None = None,
) -> dict:
    payload: dict[str, Any] = {
        "agent_id": agent_id,
        "recipient_phone_number": recipient_phone_number,
    }
    if user_data:
        payload["user_data"] = user_data
    if retry_config:
        payload["retry_config"] = retry_config

    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/call",
            headers=_headers(api_key),
            json=payload,
        )
        r.raise_for_status()
        return r.json()


async def stop_call(execution_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/call/{execution_id}/stop",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── Executions ────────────────────────────────────────────────

async def list_all_executions(
    *,
    page_number: int = 1,
    page_size: int = 20,
    api_key: str | None = None,
) -> dict:
    """List all executions across all agents."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/executions",
            headers=_headers(api_key),
            params={"page_number": page_number, "page_size": page_size},
        )
        r.raise_for_status()
        return r.json()


async def get_execution(execution_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/executions/{execution_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def list_executions(
    agent_id: str,
    *,
    page_number: int = 1,
    page_size: int = 20,
    api_key: str | None = None,
) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/v2/agent/{agent_id}/executions",
            headers=_headers(api_key),
            params={"page_number": page_number, "page_size": page_size},
        )
        r.raise_for_status()
        return r.json()


async def get_execution_log(execution_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/executions/{execution_id}/log",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── Batches ───────────────────────────────────────────────────

async def create_batch(
    agent_id: str,
    csv_file: bytes,
    filename: str = "contacts.csv",
    api_key: str | None = None,
) -> dict:
    headers = _headers(api_key)
    del headers["Content-Type"]  # let httpx set multipart boundary
    async with httpx.AsyncClient(timeout=60.0) as c:
        r = await c.post(
            f"{_base_url()}/batches",
            headers=headers,
            data={"agent_id": agent_id},
            files={"file": (filename, csv_file, "text/csv")},
        )
        r.raise_for_status()
        return r.json()


async def schedule_batch(batch_id: str, scheduled_at: str | None = None, api_key: str | None = None) -> dict:
    payload: dict[str, Any] = {}
    if scheduled_at:
        payload["scheduled_at"] = scheduled_at
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/batches/{batch_id}/schedule",
            headers=_headers(api_key),
            json=payload,
        )
        r.raise_for_status()
        return r.json()


async def stop_batch(batch_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/batches/{batch_id}/stop",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def get_batch(batch_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/batches/{batch_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def delete_batch(batch_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.delete(
            f"{_base_url()}/batches/{batch_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def list_batches(agent_id: str, api_key: str | None = None) -> list:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/batches/{agent_id}/all",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def list_batch_executions(batch_id: str, api_key: str | None = None) -> dict:
    """Get all call results for a batch."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/batches/{batch_id}/executions",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── Knowledge Bases ───────────────────────────────────────────

async def create_knowledgebase(
    file: bytes | None = None,
    url: str | None = None,
    filename: str = "doc.pdf",
    api_key: str | None = None,
) -> dict:
    headers = _headers(api_key)
    del headers["Content-Type"]
    async with httpx.AsyncClient(timeout=60.0) as c:
        if file:
            r = await c.post(
                f"{_base_url()}/knowledgebase",
                headers=headers,
                files={"file": (filename, file, "application/pdf")},
            )
        else:
            headers["Content-Type"] = "application/json"
            r = await c.post(
                f"{_base_url()}/knowledgebase",
                headers=headers,
                json={"url": url},
            )
        r.raise_for_status()
        return r.json()


async def get_knowledgebase(rag_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/knowledgebase/{rag_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def list_knowledgebases(api_key: str | None = None) -> list:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/knowledgebase/all",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def delete_knowledgebase(rag_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.delete(
            f"{_base_url()}/knowledgebase/{rag_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── Phone Numbers ─────────────────────────────────────────────

async def list_phone_numbers(api_key: str | None = None) -> list:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/phone-numbers/all",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def search_phone_numbers(
    *,
    country_iso: str = "US",
    area_code: str | None = None,
    api_key: str | None = None,
) -> list:
    """Search available phone numbers to buy."""
    params: dict[str, str] = {"country_iso": country_iso}
    if area_code:
        params["area_code"] = area_code
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/phone-numbers/search",
            headers=_headers(api_key),
            params=params,
        )
        r.raise_for_status()
        return r.json()


async def buy_phone_number(phone_number: str, api_key: str | None = None) -> dict:
    """Purchase a phone number."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/phone-numbers/buy",
            headers=_headers(api_key),
            json={"phone_number": phone_number},
        )
        r.raise_for_status()
        return r.json()


async def delete_phone_number(phone_number_id: str, api_key: str | None = None) -> dict:
    """Release/delete a purchased phone number."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.delete(
            f"{_base_url()}/phone-numbers/{phone_number_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── Inbound Call Setup ────────────────────────────────────────

async def setup_inbound(agent_id: str, phone_number: str, api_key: str | None = None) -> dict:
    """Assign an agent to a phone number for inbound calls."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/inbound/setup",
            headers=_headers(api_key),
            json={"agent_id": agent_id, "phone_number": phone_number},
        )
        r.raise_for_status()
        return r.json()


async def unlink_inbound(phone_number: str, api_key: str | None = None) -> dict:
    """Remove agent from a phone number (stop inbound handling)."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/inbound/unlink",
            headers=_headers(api_key),
            json={"phone_number": phone_number},
        )
        r.raise_for_status()
        return r.json()


async def delete_inbound_agent(phone_number: str, api_key: str | None = None) -> dict:
    """Disable automated answering for a number."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.delete(
            f"{_base_url()}/inbound/agent/{phone_number}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── Voices ────────────────────────────────────────────────────

async def list_voices(api_key: str | None = None) -> list:
    """List all available voices (including cloned voices)."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/me/voices",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── Providers ─────────────────────────────────────────────────

async def list_providers(api_key: str | None = None) -> list:
    """List configured providers (LLM, telephony, voice)."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/providers",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def add_provider(provider_config: dict, api_key: str | None = None) -> dict:
    """Add a new provider (LLM, telephony, voice)."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/providers",
            headers=_headers(api_key),
            json=provider_config,
        )
        r.raise_for_status()
        return r.json()


async def delete_provider(provider_key_name: str, api_key: str | None = None) -> dict:
    """Remove a provider."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.delete(
            f"{_base_url()}/providers/{provider_key_name}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── Extractions ───────────────────────────────────────────────

async def list_extractions(api_key: str | None = None) -> list:
    """List extraction templates."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/extractions",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def get_extraction(template_id: str, api_key: str | None = None) -> dict:
    """Get a specific extraction template."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/extractions/{template_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── SIP Trunks ────────────────────────────────────────────────

async def create_sip_trunk(trunk_config: dict, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/sip-trunks/trunks",
            headers=_headers(api_key),
            json=trunk_config,
        )
        r.raise_for_status()
        return r.json()


async def list_sip_trunks(api_key: str | None = None) -> list:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/sip-trunks/trunks",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def get_sip_trunk(trunk_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/sip-trunks/trunks/{trunk_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def update_sip_trunk(trunk_id: str, updates: dict, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.patch(
            f"{_base_url()}/sip-trunks/trunks/{trunk_id}",
            headers=_headers(api_key),
            json=updates,
        )
        r.raise_for_status()
        return r.json()


async def delete_sip_trunk(trunk_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.delete(
            f"{_base_url()}/sip-trunks/trunks/{trunk_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def add_sip_trunk_number(trunk_id: str, phone_number: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(
            f"{_base_url()}/sip-trunks/trunks/{trunk_id}/numbers",
            headers=_headers(api_key),
            json={"phone_number": phone_number},
        )
        r.raise_for_status()
        return r.json()


async def list_sip_trunk_numbers(trunk_id: str, api_key: str | None = None) -> list:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/sip-trunks/trunks/{trunk_id}/numbers",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def delete_sip_trunk_number(trunk_id: str, phone_number_id: str, api_key: str | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.delete(
            f"{_base_url()}/sip-trunks/trunks/{trunk_id}/numbers/{phone_number_id}",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── User / Account ────────────────────────────────────────────

async def get_user_me(api_key: str | None = None) -> dict:
    """Get user account info and wallet balance."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/user/me",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


async def get_user_info(api_key: str | None = None) -> dict:
    """Get user account details."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(
            f"{_base_url()}/user/info",
            headers=_headers(api_key),
        )
        r.raise_for_status()
        return r.json()


# ── Validation ────────────────────────────────────────────────

async def validate_api_key(api_key: str) -> bool:
    """Check if a Bolna API key is valid by fetching user profile."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(
                f"{_base_url()}/user/me",
                headers=_headers(api_key),
            )
            return r.status_code == 200
    except Exception:
        return False
