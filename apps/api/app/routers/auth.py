from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
import re

from app.core.config import get_settings
from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.user import SignupRequest, LoginRequest, UserResponse
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/signup", response_model=ApiResponse[UserResponse])
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Create a new account: Supabase user + tenant + owner record."""
    # Create user in Supabase Auth
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{settings.supabase_url}/auth/v1/signup",
            json={"email": body.email, "password": body.password},
            headers={
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
        )

    if res.status_code != 200:
        error_detail = res.json().get("msg", res.text)
        raise HTTPException(status_code=400, detail=f"Signup failed: {error_detail}")

    auth_user = res.json()
    user_id = auth_user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Signup failed: no user ID returned")

    # Create tenant
    slug = re.sub(r"[^a-z0-9-]", "-", body.organization_name.lower().strip())
    slug = re.sub(r"-+", "-", slug).strip("-")

    # Check slug uniqueness
    existing = await db.execute(select(Tenant).where(Tenant.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{user_id[:8]}"

    tenant = Tenant(name=body.organization_name, slug=slug)
    db.add(tenant)
    await db.flush()

    # Create user record
    user = User(
        id=user_id,
        tenant_id=tenant.id,
        role="owner",
        full_name=body.full_name,
    )
    db.add(user)
    await db.flush()

    return ApiResponse(data=UserResponse.model_validate(user))


@router.post("/login")
async def login(body: LoginRequest):
    """Login via Supabase Auth — returns access_token and refresh_token."""
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{settings.supabase_url}/auth/v1/token?grant_type=password",
            json={"email": body.email, "password": body.password},
            headers={
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
        )

    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return ApiResponse(data=res.json())


@router.get("/me", response_model=ApiResponse[UserResponse])
async def get_me(user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get current user profile."""
    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return ApiResponse(data=UserResponse.model_validate(db_user))
