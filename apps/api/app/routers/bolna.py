"""
Bolna-mode API routes.

These proxy to the Bolna cloud API using the tenant's stored Bolna API key
(or the global BOLNA_API_KEY from env).  The frontend hits these when the
user toggles to "Bolna" mode.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from typing import Any
import httpx

from app.core.auth import get_current_user, CurrentUser
from app.core.config import get_settings
from app.services import bolna_client

router = APIRouter(prefix="/bolna", tags=["bolna"])


# ── Helpers ───────────────────────────────────────────────────

def _get_api_key() -> str:
    """Return Bolna API key, raising 400 if not configured."""
    key = get_settings().bolna_api_key
    if not key:
        raise HTTPException(status_code=400, detail="Bolna API key not configured. Set BOLNA_API_KEY in env or settings.")
    return key


def _handle_bolna_error(exc: httpx.HTTPStatusError) -> None:
    """Re-raise Bolna API errors as FastAPI HTTP exceptions."""
    try:
        detail = exc.response.json()
    except Exception:
        detail = exc.response.text
    raise HTTPException(status_code=exc.response.status_code, detail=detail)


# ── Validate Key ──────────────────────────────────────────────

@router.get("/validate-key")
async def validate_key():
    key = get_settings().bolna_api_key
    if not key:
        return {"valid": False, "message": "No Bolna API key configured"}
    valid = await bolna_client.validate_api_key(key)
    return {"valid": valid}


# ── User / Account ────────────────────────────────────────────

@router.get("/user/me")
async def get_user_me(user: CurrentUser = Depends(get_current_user)):
    """Get Bolna account info and wallet balance."""
    try:
        result = await bolna_client.get_user_me(api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/user/info")
async def get_user_info(user: CurrentUser = Depends(get_current_user)):
    """Get Bolna account details."""
    try:
        result = await bolna_client.get_user_info(api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── Agent Endpoints ───────────────────────────────────────────

class BolnaAgentCreate(BaseModel):
    agent_config: dict[str, Any]

class BolnaAgentUpdate(BaseModel):
    agent_config: dict[str, Any]


@router.get("/agents")
async def list_agents(user: CurrentUser = Depends(get_current_user)):
    try:
        agents = await bolna_client.list_agents(api_key=_get_api_key())
        return {"data": agents}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.post("/agents", status_code=201)
async def create_agent(
    body: BolnaAgentCreate,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await bolna_client.create_agent(body.agent_config, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.get_agent(agent_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.put("/agents/{agent_id}")
async def update_agent(
    agent_id: str,
    body: BolnaAgentUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await bolna_client.update_agent(agent_id, body.agent_config, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.patch("/agents/{agent_id}")
async def patch_agent(
    agent_id: str,
    body: dict[str, Any],
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await bolna_client.patch_agent(agent_id, body, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.delete_agent(agent_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.post("/agents/{agent_id}/stop")
async def stop_agent_calls(agent_id: str, user: CurrentUser = Depends(get_current_user)):
    """Stop all queued/scheduled calls for an agent."""
    try:
        result = await bolna_client.stop_agent_calls(agent_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── Call Endpoints ────────────────────────────────────────────

class BolnaCallInitiate(BaseModel):
    agent_id: str
    recipient_phone_number: str
    user_data: dict[str, Any] | None = None
    retry_config: dict[str, Any] | None = None


@router.post("/calls", status_code=201)
async def make_call(
    body: BolnaCallInitiate,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await bolna_client.make_call(
            agent_id=body.agent_id,
            recipient_phone_number=body.recipient_phone_number,
            user_data=body.user_data,
            retry_config=body.retry_config,
            api_key=_get_api_key(),
        )
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.post("/calls/{execution_id}/stop")
async def stop_call(execution_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.stop_call(execution_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── Execution Endpoints ──────────────────────────────────────

@router.get("/executions")
async def list_all_executions(
    page_number: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    user: CurrentUser = Depends(get_current_user),
):
    """List all executions across all agents."""
    try:
        result = await bolna_client.list_all_executions(
            page_number=page_number, page_size=page_size, api_key=_get_api_key(),
        )
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/executions/{execution_id}")
async def get_execution(execution_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.get_execution(execution_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/executions/{execution_id}/log")
async def get_execution_log(execution_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.get_execution_log(execution_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/agents/{agent_id}/executions")
async def list_executions(
    agent_id: str,
    page_number: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await bolna_client.list_executions(
            agent_id, page_number=page_number, page_size=page_size, api_key=_get_api_key(),
        )
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── Batch Endpoints ───────────────────────────────────────────

@router.post("/batches", status_code=201)
async def create_batch(
    agent_id: str = Form(...),
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    try:
        content = await file.read()
        result = await bolna_client.create_batch(
            agent_id, content, filename=file.filename or "contacts.csv", api_key=_get_api_key(),
        )
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


class BolnaScheduleBatch(BaseModel):
    scheduled_at: str | None = None


@router.post("/batches/{batch_id}/schedule")
async def schedule_batch(
    batch_id: str,
    body: BolnaScheduleBatch = BolnaScheduleBatch(),
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await bolna_client.schedule_batch(batch_id, body.scheduled_at, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.post("/batches/{batch_id}/stop")
async def stop_batch(batch_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.stop_batch(batch_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/batches/{batch_id}")
async def get_batch(batch_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.get_batch(batch_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.delete("/batches/{batch_id}")
async def delete_batch(batch_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.delete_batch(batch_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/agents/{agent_id}/batches")
async def list_batches(agent_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.list_batches(agent_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/batches/{batch_id}/executions")
async def list_batch_executions(batch_id: str, user: CurrentUser = Depends(get_current_user)):
    """Get all call results for a batch."""
    try:
        result = await bolna_client.list_batch_executions(batch_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── Knowledge Bases ───────────────────────────────────────────

@router.post("/knowledgebases", status_code=201)
async def create_knowledgebase_file(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Create a knowledge base from a file upload (PDF, TXT, etc.)."""
    try:
        content = await file.read()
        result = await bolna_client.create_knowledgebase(
            file=content, filename=file.filename or "doc.pdf", api_key=_get_api_key(),
        )
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


class BolnaKBFromURL(BaseModel):
    url: str


@router.post("/knowledgebases/url", status_code=201)
async def create_knowledgebase_url(
    body: BolnaKBFromURL,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a knowledge base from a URL."""
    try:
        result = await bolna_client.create_knowledgebase(url=body.url, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/knowledgebases")
async def list_knowledgebases(user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.list_knowledgebases(api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/knowledgebases/{rag_id}")
async def get_knowledgebase(rag_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.get_knowledgebase(rag_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.delete("/knowledgebases/{rag_id}")
async def delete_knowledgebase(rag_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.delete_knowledgebase(rag_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── Phone Numbers ─────────────────────────────────────────────

@router.get("/phone-numbers")
async def list_phone_numbers(user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.list_phone_numbers(api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/phone-numbers/search")
async def search_phone_numbers(
    country_iso: str = Query("US"),
    area_code: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    """Search available phone numbers to purchase."""
    try:
        result = await bolna_client.search_phone_numbers(
            country_iso=country_iso, area_code=area_code, api_key=_get_api_key(),
        )
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


class BolnaBuyPhone(BaseModel):
    phone_number: str


@router.post("/phone-numbers/buy", status_code=201)
async def buy_phone_number(
    body: BolnaBuyPhone,
    user: CurrentUser = Depends(get_current_user),
):
    """Purchase a phone number."""
    try:
        result = await bolna_client.buy_phone_number(body.phone_number, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.delete("/phone-numbers/{phone_number_id}")
async def delete_phone_number(phone_number_id: str, user: CurrentUser = Depends(get_current_user)):
    """Release/delete a purchased phone number."""
    try:
        result = await bolna_client.delete_phone_number(phone_number_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── Inbound Call Setup ────────────────────────────────────────

class BolnaInboundSetup(BaseModel):
    agent_id: str
    phone_number: str


@router.post("/inbound/setup", status_code=201)
async def setup_inbound(
    body: BolnaInboundSetup,
    user: CurrentUser = Depends(get_current_user),
):
    """Assign an agent to handle inbound calls on a phone number."""
    try:
        result = await bolna_client.setup_inbound(body.agent_id, body.phone_number, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


class BolnaInboundUnlink(BaseModel):
    phone_number: str


@router.post("/inbound/unlink")
async def unlink_inbound(
    body: BolnaInboundUnlink,
    user: CurrentUser = Depends(get_current_user),
):
    """Remove agent from a phone number."""
    try:
        result = await bolna_client.unlink_inbound(body.phone_number, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.delete("/inbound/agent/{phone_number}")
async def delete_inbound_agent(phone_number: str, user: CurrentUser = Depends(get_current_user)):
    """Disable automated answering for a number."""
    try:
        result = await bolna_client.delete_inbound_agent(phone_number, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── Voices ────────────────────────────────────────────────────

@router.get("/voices")
async def list_voices(user: CurrentUser = Depends(get_current_user)):
    """List all available voices (including cloned)."""
    try:
        result = await bolna_client.list_voices(api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── Providers ─────────────────────────────────────────────────

@router.get("/providers")
async def list_providers(user: CurrentUser = Depends(get_current_user)):
    """List configured Bolna providers (LLM, telephony, voice)."""
    try:
        result = await bolna_client.list_providers(api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.post("/providers", status_code=201)
async def add_provider(
    body: dict[str, Any],
    user: CurrentUser = Depends(get_current_user),
):
    """Add a new provider."""
    try:
        result = await bolna_client.add_provider(body, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.delete("/providers/{provider_key_name}")
async def delete_provider(provider_key_name: str, user: CurrentUser = Depends(get_current_user)):
    """Remove a provider."""
    try:
        result = await bolna_client.delete_provider(provider_key_name, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── Extractions ───────────────────────────────────────────────

@router.get("/extractions")
async def list_extractions(user: CurrentUser = Depends(get_current_user)):
    """List extraction templates."""
    try:
        result = await bolna_client.list_extractions(api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/extractions/{template_id}")
async def get_extraction(template_id: str, user: CurrentUser = Depends(get_current_user)):
    """Get a specific extraction template."""
    try:
        result = await bolna_client.get_extraction(template_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


# ── SIP Trunks ────────────────────────────────────────────────

@router.get("/sip-trunks")
async def list_sip_trunks(user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.list_sip_trunks(api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.post("/sip-trunks", status_code=201)
async def create_sip_trunk(
    body: dict[str, Any],
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await bolna_client.create_sip_trunk(body, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/sip-trunks/{trunk_id}")
async def get_sip_trunk(trunk_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.get_sip_trunk(trunk_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.patch("/sip-trunks/{trunk_id}")
async def update_sip_trunk(
    trunk_id: str,
    body: dict[str, Any],
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await bolna_client.update_sip_trunk(trunk_id, body, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.delete("/sip-trunks/{trunk_id}")
async def delete_sip_trunk(trunk_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.delete_sip_trunk(trunk_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.post("/sip-trunks/{trunk_id}/numbers", status_code=201)
async def add_sip_trunk_number(
    trunk_id: str,
    body: dict[str, Any],
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await bolna_client.add_sip_trunk_number(
            trunk_id, body.get("phone_number", ""), api_key=_get_api_key(),
        )
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.get("/sip-trunks/{trunk_id}/numbers")
async def list_sip_trunk_numbers(trunk_id: str, user: CurrentUser = Depends(get_current_user)):
    try:
        result = await bolna_client.list_sip_trunk_numbers(trunk_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)


@router.delete("/sip-trunks/{trunk_id}/numbers/{phone_number_id}")
async def delete_sip_trunk_number(
    trunk_id: str,
    phone_number_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await bolna_client.delete_sip_trunk_number(trunk_id, phone_number_id, api_key=_get_api_key())
        return {"data": result}
    except httpx.HTTPStatusError as e:
        _handle_bolna_error(e)
