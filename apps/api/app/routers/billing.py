"""
Mock billing / payment endpoints.

Simulates a payment gateway flow:
1. Client selects a credit pack (minutes or dollars).
2. Backend creates an "order" with a mock order_id.
3. Client "pays" via card or UPI (all mocked).
4. Client calls verify → backend marks paid and credits the tenant.

For demo purposes — no real money changes hands.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from uuid import UUID
import uuid
import time

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.models.tenant import Tenant
from app.models.spending_ledger import SpendingLedger

router = APIRouter(prefix="/billing", tags=["billing"])

# ── In-memory mock order store (resets on server restart) ────
_mock_orders: dict[str, dict] = {}

# ── Credit packs available for purchase ──────────────────────
CREDIT_PACKS = [
    {
        "id": "starter_100",
        "name": "Starter",
        "minutes": 100,
        "dollars_credit": 10.0,
        "price_inr": 499,
        "price_usd": 5.99,
        "popular": False,
    },
    {
        "id": "growth_500",
        "name": "Growth",
        "minutes": 500,
        "dollars_credit": 50.0,
        "price_inr": 1999,
        "price_usd": 24.99,
        "popular": True,
    },
    {
        "id": "pro_2000",
        "name": "Pro",
        "minutes": 2000,
        "dollars_credit": 200.0,
        "price_inr": 6999,
        "price_usd": 84.99,
        "popular": False,
    },
    {
        "id": "enterprise_10000",
        "name": "Enterprise",
        "minutes": 10000,
        "dollars_credit": 1000.0,
        "price_inr": 29999,
        "price_usd": 359.99,
        "popular": False,
    },
]


class CreateOrderRequest(BaseModel):
    pack_id: str
    payment_method: str = Field(pattern=r"^(card|upi)$")


class VerifyPaymentRequest(BaseModel):
    order_id: str
    # For card mock: just the last 4 digits for display
    card_last4: str | None = None
    # For UPI mock: the UPI ID used
    upi_id: str | None = None


@router.get("/packs")
async def list_credit_packs(user: CurrentUser = Depends(get_current_user)):
    """List available credit packs."""
    return {"data": CREDIT_PACKS}


@router.post("/create-order")
async def create_order(
    body: CreateOrderRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a mock payment order. Returns order_id and UPI details if UPI."""
    pack = next((p for p in CREDIT_PACKS if p["id"] == body.pack_id), None)
    if not pack:
        raise HTTPException(status_code=400, detail="Invalid pack_id")

    order_id = f"ORD_{uuid.uuid4().hex[:12].upper()}"
    _mock_orders[order_id] = {
        "order_id": order_id,
        "tenant_id": str(user.tenant_id),
        "pack": pack,
        "payment_method": body.payment_method,
        "status": "pending",
        "created_at": time.time(),
    }

    response: dict = {
        "order_id": order_id,
        "pack": pack,
        "payment_method": body.payment_method,
        "status": "pending",
    }

    if body.payment_method == "upi":
        # Generate mock UPI payment string for QR code
        amount = pack["price_inr"]
        upi_string = f"upi://pay?pa=vgent@ybl&pn=Vgent%20AI&am={amount}&cu=INR&tn=Credits%20{pack['name']}%20Pack&tr={order_id}"
        response["upi_deeplink"] = upi_string
        response["upi_payee"] = "vgent@ybl"
        response["amount_inr"] = amount

    return {"data": response}


@router.post("/verify-payment")
async def verify_payment(
    body: VerifyPaymentRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mock payment verification.
    In a real system this would check with Razorpay/Stripe.
    Here we just mark it as paid and credit the tenant.
    """
    order = _mock_orders.get(body.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order["tenant_id"] != str(user.tenant_id):
        raise HTTPException(status_code=403, detail="Order does not belong to this tenant")

    if order["status"] == "paid":
        return {"data": {"status": "already_paid", "order_id": body.order_id}}

    # Mark as paid
    order["status"] = "paid"

    pack = order["pack"]
    minutes_to_add = pack["minutes"]
    dollars_to_add = pack["dollars_credit"]

    # Credit the tenant
    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.allocated_minutes += minutes_to_add
    tenant.allocated_dollars += dollars_to_add

    # Create ledger entry
    ledger = SpendingLedger(
        tenant_id=user.tenant_id,
        event_type="admin_credit",
        minutes_delta=minutes_to_add,
        dollars_delta=dollars_to_add,
        balance_minutes_after=tenant.used_minutes,
        balance_dollars_after=tenant.used_dollars,
        note=f"Payment: {pack['name']} pack ({minutes_to_add} min, ${dollars_to_add}) — Order {body.order_id}",
    )
    db.add(ledger)
    await db.commit()

    return {
        "data": {
            "status": "paid",
            "order_id": body.order_id,
            "credits_added": {
                "minutes": minutes_to_add,
                "dollars": dollars_to_add,
            },
            "new_balance": {
                "allocated_minutes": tenant.allocated_minutes,
                "allocated_dollars": tenant.allocated_dollars,
                "used_minutes": tenant.used_minutes,
                "used_dollars": tenant.used_dollars,
            },
            "payment_method": order["payment_method"],
            "card_last4": body.card_last4,
            "upi_id": body.upi_id,
        }
    }


@router.get("/history")
async def payment_history(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get payment/credit history from spending ledger."""
    result = await db.execute(
        select(SpendingLedger)
        .where(
            SpendingLedger.tenant_id == user.tenant_id,
            SpendingLedger.event_type == "admin_credit",
        )
        .order_by(SpendingLedger.created_at.desc())
        .limit(50)
    )
    entries = result.scalars().all()

    return {
        "data": [
            {
                "id": str(e.id),
                "minutes_added": e.minutes_delta,
                "dollars_added": e.dollars_delta,
                "note": e.note,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ]
    }
