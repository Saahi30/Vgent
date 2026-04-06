from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
import math
import csv
import io

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse, normalize_phone_number
from app.schemas.common import ApiResponse, PaginatedResponse

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=PaginatedResponse[ContactResponse])
async def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: str | None = None,
    do_not_call: bool | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Contact).where(Contact.tenant_id == user.tenant_id)
    count_query = select(func.count()).select_from(Contact).where(Contact.tenant_id == user.tenant_id)

    if search:
        search_filter = (
            Contact.phone_number.ilike(f"%{search}%")
            | Contact.first_name.ilike(f"%{search}%")
            | Contact.last_name.ilike(f"%{search}%")
            | Contact.email.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if do_not_call is not None:
        query = query.where(Contact.do_not_call == do_not_call)
        count_query = count_query.where(Contact.do_not_call == do_not_call)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Contact.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    contacts = result.scalars().all()

    return PaginatedResponse(
        data=[ContactResponse.model_validate(c) for c in contacts],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("", response_model=ApiResponse[ContactResponse], status_code=201)
async def create_contact(
    body: ContactCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = Contact(tenant_id=user.tenant_id, **body.model_dump())
    db.add(contact)
    await db.flush()
    return ApiResponse(data=ContactResponse.model_validate(contact))


@router.get("/{contact_id}", response_model=ApiResponse[ContactResponse])
async def get_contact(
    contact_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.tenant_id == user.tenant_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ApiResponse(data=ContactResponse.model_validate(contact))


@router.patch("/{contact_id}", response_model=ApiResponse[ContactResponse])
async def update_contact(
    contact_id: UUID,
    body: ContactUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.tenant_id == user.tenant_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)

    await db.flush()
    return ApiResponse(data=ContactResponse.model_validate(contact))


@router.delete("/{contact_id}", response_model=ApiResponse)
async def delete_contact(
    contact_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.tenant_id == user.tenant_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    await db.delete(contact)
    await db.flush()
    return ApiResponse(data={"deleted": True})


@router.post("/bulk-delete", response_model=ApiResponse)
async def bulk_delete_contacts(
    contact_ids: list[UUID],
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple contacts at once. Returns count of deleted contacts."""
    if not contact_ids:
        raise HTTPException(status_code=400, detail="No contact IDs provided")
    if len(contact_ids) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 contacts per batch")

    deleted = 0
    for contact_id in contact_ids:
        result = await db.execute(
            select(Contact).where(Contact.id == contact_id, Contact.tenant_id == user.tenant_id)
        )
        contact = result.scalar_one_or_none()
        if contact:
            await db.delete(contact)
            deleted += 1

    await db.flush()
    return ApiResponse(data={"deleted": deleted, "requested": len(contact_ids)})


@router.post("/import/preview", response_model=ApiResponse)
async def preview_csv(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Upload a CSV and return headers + first 5 rows for column mapping preview."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])

    if not headers:
        raise HTTPException(status_code=400, detail="CSV has no headers")

    preview_rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        preview_rows.append(dict(row))

    # Count total rows
    text_reader = csv.DictReader(io.StringIO(text))
    total_rows = sum(1 for _ in text_reader)

    return ApiResponse(data={
        "headers": headers,
        "preview": preview_rows,
        "total_rows": total_rows,
    })


@router.post("/import", response_model=ApiResponse)
async def import_contacts_csv(
    file: UploadFile = File(...),
    phone_number_col: str = Query(..., description="CSV column name to map to phone_number"),
    first_name_col: str | None = Query(None, description="CSV column name to map to first_name"),
    last_name_col: str | None = Query(None, description="CSV column name to map to last_name"),
    email_col: str | None = Query(None, description="CSV column name to map to email"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import contacts from a CSV file with custom column mapping."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []

    if phone_number_col not in headers:
        raise HTTPException(status_code=400, detail=f"Column '{phone_number_col}' not found in CSV")

    imported = 0
    skipped = 0
    duplicates = 0

    for row in reader:
        phone = row.get(phone_number_col, "").strip()
        if not phone:
            skipped += 1
            continue
        phone = normalize_phone_number(phone)

        # Check for duplicate phone within this tenant
        existing = (await db.execute(
            select(Contact).where(
                Contact.tenant_id == user.tenant_id,
                Contact.phone_number == phone,
            ).limit(1)
        )).scalar_one_or_none()

        if existing:
            duplicates += 1
            continue

        # Build metadata from unmapped columns
        mapped_cols = {phone_number_col, first_name_col, last_name_col, email_col}
        extra_metadata = {}
        for col in headers:
            if col not in mapped_cols and row.get(col, "").strip():
                extra_metadata[col] = row[col].strip()

        contact = Contact(
            tenant_id=user.tenant_id,
            phone_number=phone,
            first_name=(row.get(first_name_col, "").strip() or None) if first_name_col else None,
            last_name=(row.get(last_name_col, "").strip() or None) if last_name_col else None,
            email=(row.get(email_col, "").strip() or None) if email_col else None,
            metadata_=extra_metadata if extra_metadata else {},
        )
        db.add(contact)
        imported += 1

    await db.flush()
    return ApiResponse(data={"imported": imported, "skipped": skipped, "duplicates": duplicates})
