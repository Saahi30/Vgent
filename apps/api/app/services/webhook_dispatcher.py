"""Webhook dispatcher — sends call events to tenant-configured webhook URLs."""

import httpx
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.webhook import WebhookDelivery


async def dispatch_webhook(
    db: AsyncSession,
    tenant_id: str,
    call_id: str,
    url: str,
    event_type: str,
    payload: dict,
):
    """Send a webhook and record the delivery attempt."""
    delivery = WebhookDelivery(
        tenant_id=tenant_id,
        call_id=call_id,
        url=url,
        event_type=event_type,
        payload=payload,
    )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={
                    "event": event_type,
                    "call_id": call_id,
                    "tenant_id": tenant_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": payload,
                },
                headers={"Content-Type": "application/json", "User-Agent": "Vgent-Webhook/1.0"},
                timeout=10.0,
            )
            delivery.response_status = response.status_code
            delivery.response_body = response.text[:1000]
            delivery.delivered_at = datetime.now(timezone.utc)
            delivery.failed = response.status_code >= 400
    except Exception as e:
        delivery.failed = True
        delivery.response_body = str(e)[:1000]

    db.add(delivery)
    await db.flush()
