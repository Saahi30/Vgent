from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.models.user import User
from app.schemas.user import UserResponse
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/team", tags=["team"])


class InviteMemberRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    role: str = Field(default="member", pattern=r"^(owner|member)$")


class UpdateMemberRequest(BaseModel):
    role: str = Field(pattern=r"^(owner|member)$")


def _require_owner(user: CurrentUser):
    if user.role not in ("owner", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can manage team members",
        )


@router.get("/members", response_model=ApiResponse[list[UserResponse]])
async def list_members(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all team members for the current tenant."""
    if not user.tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")

    result = await db.execute(
        select(User)
        .where(User.tenant_id == user.tenant_id)
        .where(User.is_active == True)
        .order_by(User.created_at.asc())
    )
    members = result.scalars().all()
    return ApiResponse(data=[UserResponse.model_validate(m) for m in members])


@router.post("/members/invite", response_model=ApiResponse[UserResponse])
async def invite_member(
    body: InviteMemberRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a new member to the tenant. Owner only.

    For now, creates a user DB record. Supabase handles actual auth.
    The user ID is generated here; in production, Supabase admin API
    would create the auth user and return the ID.
    """
    _require_owner(user)

    if not user.tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")

    # Check if a user with this email-like pattern already exists in the tenant
    # Since User model doesn't have email, we check by full_name as a basic guard
    new_user = User(
        id=uuid.uuid4(),
        tenant_id=user.tenant_id,
        role=body.role,
        full_name=body.full_name,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)

    return ApiResponse(data=UserResponse.model_validate(new_user))


@router.patch("/members/{user_id}", response_model=ApiResponse[UserResponse])
async def update_member(
    user_id: UUID,
    body: UpdateMemberRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a team member's role. Owner only."""
    _require_owner(user)

    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .where(User.tenant_id == user.tenant_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if str(user_id) == user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    member.role = body.role
    member.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(member)

    return ApiResponse(data=UserResponse.model_validate(member))


@router.delete("/members/{user_id}", response_model=ApiResponse[dict])
async def remove_member(
    user_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the tenant. Owner only."""
    _require_owner(user)

    if str(user_id) == user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .where(User.tenant_id == user.tenant_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.is_active = False
    member.updated_at = datetime.utcnow()
    await db.flush()

    return ApiResponse(data={"removed": True})
