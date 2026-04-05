import json
import redis.asyncio as aioredis
from app.core.config import get_settings

settings = get_settings()

redis_client = aioredis.from_url(
    settings.redis_url,
    decode_responses=True,
    encoding="utf-8",
)


async def get_redis() -> aioredis.Redis:
    return redis_client


async def publish_event(channel: str, data: dict):
    """Publish an event to a Redis pub/sub channel."""
    await redis_client.publish(channel, json.dumps(data))


# ---------------------------------------------------------------------------
# Active call tracking — used by live monitor for instant state snapshots
# ---------------------------------------------------------------------------

ACTIVE_CALLS_KEY = "vgent:active_calls"          # Hash: call_id → JSON metadata
TENANT_ACTIVE_KEY = "vgent:tenant:{tenant_id}:active_calls"  # Set of call_ids


async def register_active_call(call_id: str, tenant_id: str, metadata: dict):
    """Mark a call as active and store its metadata for live monitor."""
    meta = {**metadata, "call_id": call_id, "tenant_id": tenant_id}
    pipe = redis_client.pipeline()
    pipe.hset(ACTIVE_CALLS_KEY, call_id, json.dumps(meta))
    pipe.sadd(TENANT_ACTIVE_KEY.format(tenant_id=tenant_id), call_id)
    await pipe.execute()


async def unregister_active_call(call_id: str, tenant_id: str):
    """Remove a call from the active set."""
    pipe = redis_client.pipeline()
    pipe.hdel(ACTIVE_CALLS_KEY, call_id)
    pipe.srem(TENANT_ACTIVE_KEY.format(tenant_id=tenant_id), call_id)
    await pipe.execute()


async def update_active_call(call_id: str, updates: dict):
    """Merge updates into an active call's metadata."""
    raw = await redis_client.hget(ACTIVE_CALLS_KEY, call_id)
    if raw:
        meta = json.loads(raw)
        meta.update(updates)
        await redis_client.hset(ACTIVE_CALLS_KEY, call_id, json.dumps(meta))


async def get_active_calls_for_tenant(tenant_id: str) -> list[dict]:
    """Return all active calls belonging to a tenant."""
    call_ids = await redis_client.smembers(
        TENANT_ACTIVE_KEY.format(tenant_id=tenant_id)
    )
    if not call_ids:
        return []
    raw_values = await redis_client.hmget(ACTIVE_CALLS_KEY, *call_ids)
    return [json.loads(v) for v in raw_values if v]


async def get_all_active_calls() -> list[dict]:
    """Return all active calls across all tenants (superadmin)."""
    all_raw = await redis_client.hgetall(ACTIVE_CALLS_KEY)
    return [json.loads(v) for v in all_raw.values()]
