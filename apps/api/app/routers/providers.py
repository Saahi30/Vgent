from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.core.security import encrypt_credentials
from app.models.provider_credential import ProviderCredential
from app.schemas.provider import ProviderCredentialCreate, ProviderCredentialUpdate, ProviderCredentialResponse
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("", response_model=ApiResponse[list[ProviderCredentialResponse]])
async def list_providers(
    provider_type: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ProviderCredential).where(ProviderCredential.tenant_id == user.tenant_id)

    if provider_type:
        query = query.where(ProviderCredential.provider_type == provider_type)

    query = query.order_by(ProviderCredential.created_at.desc())
    result = await db.execute(query)
    providers = result.scalars().all()

    return ApiResponse(data=[ProviderCredentialResponse.model_validate(p) for p in providers])


@router.post("", response_model=ApiResponse[ProviderCredentialResponse], status_code=201)
async def create_provider(
    body: ProviderCredentialCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Encrypt credentials before storing
    encrypted_creds = encrypt_credentials(body.credentials)

    provider = ProviderCredential(
        tenant_id=user.tenant_id,
        provider_type=body.provider_type,
        provider_name=body.provider_name,
        credentials={"encrypted": encrypted_creds},
        is_default=body.is_default,
        label=body.label,
    )

    # If setting as default, unset other defaults of same type
    if body.is_default:
        existing = await db.execute(
            select(ProviderCredential).where(
                ProviderCredential.tenant_id == user.tenant_id,
                ProviderCredential.provider_type == body.provider_type,
                ProviderCredential.is_default == True,
            )
        )
        for p in existing.scalars().all():
            p.is_default = False

    db.add(provider)
    await db.flush()

    return ApiResponse(data=ProviderCredentialResponse.model_validate(provider))


@router.get("/{provider_id}", response_model=ApiResponse[ProviderCredentialResponse])
async def get_provider(
    provider_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProviderCredential).where(
            ProviderCredential.id == provider_id,
            ProviderCredential.tenant_id == user.tenant_id,
        )
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    return ApiResponse(data=ProviderCredentialResponse.model_validate(provider))


@router.patch("/{provider_id}", response_model=ApiResponse[ProviderCredentialResponse])
async def update_provider(
    provider_id: UUID,
    body: ProviderCredentialUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProviderCredential).where(
            ProviderCredential.id == provider_id,
            ProviderCredential.tenant_id == user.tenant_id,
        )
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if body.credentials is not None:
        encrypted_creds = encrypt_credentials(body.credentials)
        provider.credentials = {"encrypted": encrypted_creds}

    if body.is_default is not None:
        if body.is_default:
            # Unset other defaults
            existing = await db.execute(
                select(ProviderCredential).where(
                    ProviderCredential.tenant_id == user.tenant_id,
                    ProviderCredential.provider_type == provider.provider_type,
                    ProviderCredential.is_default == True,
                    ProviderCredential.id != provider_id,
                )
            )
            for p in existing.scalars().all():
                p.is_default = False
        provider.is_default = body.is_default

    if body.label is not None:
        provider.label = body.label

    await db.flush()
    return ApiResponse(data=ProviderCredentialResponse.model_validate(provider))


@router.delete("/{provider_id}", response_model=ApiResponse)
async def delete_provider(
    provider_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProviderCredential).where(
            ProviderCredential.id == provider_id,
            ProviderCredential.tenant_id == user.tenant_id,
        )
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    await db.delete(provider)
    await db.flush()
    return ApiResponse(data={"deleted": True})
