from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User
from dataclasses import dataclass
from typing import Optional

security = HTTPBearer(auto_error=False)
settings = get_settings()

DEFAULT_USER_ID = "default"


@dataclass
class CurrentUser:
    id: str
    tenant_id: str | None
    role: str
    email: str | None = None


async def verify_jwt(token: str) -> dict:
    """Verify a Supabase JWT token and return claims."""
    jwt_secret = settings.supabase_jwt_secret
    if not jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET not configured",
        )

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    """Extract and validate current user from JWT, or return default user if no token."""
    if not credentials:
        # No auth token — return first available user or a default
        result = await db.execute(select(User).where(User.is_active == True).limit(1))
        user = result.scalar_one_or_none()
        if user:
            return CurrentUser(
                id=str(user.id),
                tenant_id=str(user.tenant_id) if user.tenant_id else None,
                role=user.role,
                email=None,
            )
        return CurrentUser(id=DEFAULT_USER_ID, tenant_id=None, role="owner", email=None)

    payload = await verify_jwt(credentials.credentials)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    return CurrentUser(
        id=str(user.id),
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
        role=user.role,
        email=payload.get("email"),
    )


def require_role(*roles: str):
    """Dependency that requires the user to have one of the specified roles."""
    async def check_role(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(roles)}",
            )
        return user
    return check_role


def require_superadmin():
    """Dependency that requires superadmin role."""
    return require_role("superadmin")
