from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from pydantic import BaseModel
import base64

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.models.knowledge_base import KnowledgeBase, KBDocument
from app.schemas.knowledge_base import (
    KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse,
    KBDocumentResponse, KBChunkResponse,
)
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge-bases"])

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
}


# --- Knowledge Base CRUD ---

@router.get("", response_model=ApiResponse[list[KnowledgeBaseResponse]])
async def list_knowledge_bases(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.tenant_id == user.tenant_id)
        .order_by(KnowledgeBase.created_at.desc())
    )
    kbs = result.scalars().all()
    return ApiResponse(data=[KnowledgeBaseResponse.model_validate(kb) for kb in kbs])


@router.post("", response_model=ApiResponse[KnowledgeBaseResponse], status_code=201)
async def create_knowledge_base(
    body: KnowledgeBaseCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kb = KnowledgeBase(tenant_id=user.tenant_id, **body.model_dump())
    db.add(kb)
    await db.flush()
    return ApiResponse(data=KnowledgeBaseResponse.model_validate(kb))


@router.get("/{kb_id}", response_model=ApiResponse[KnowledgeBaseResponse])
async def get_knowledge_base(
    kb_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_id, KnowledgeBase.tenant_id == user.tenant_id)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return ApiResponse(data=KnowledgeBaseResponse.model_validate(kb))


@router.patch("/{kb_id}", response_model=ApiResponse[KnowledgeBaseResponse])
async def update_knowledge_base(
    kb_id: UUID,
    body: KnowledgeBaseUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_id, KnowledgeBase.tenant_id == user.tenant_id)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(kb, key, value)

    await db.flush()
    return ApiResponse(data=KnowledgeBaseResponse.model_validate(kb))


@router.delete("/{kb_id}", response_model=ApiResponse)
async def delete_knowledge_base(
    kb_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_id, KnowledgeBase.tenant_id == user.tenant_id)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    await db.delete(kb)
    await db.flush()
    return ApiResponse(data={"deleted": True})


# --- Documents ---

@router.get("/{kb_id}/documents", response_model=ApiResponse[list[KBDocumentResponse]])
async def list_kb_documents(
    kb_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KBDocument)
        .where(KBDocument.knowledge_base_id == kb_id, KBDocument.tenant_id == user.tenant_id)
        .order_by(KBDocument.created_at.desc())
    )
    docs = result.scalars().all()
    return ApiResponse(data=[KBDocumentResponse.model_validate(d) for d in docs])


@router.post("/{kb_id}/documents", response_model=ApiResponse[KBDocumentResponse], status_code=201)
async def upload_document(
    kb_id: UUID,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document (PDF, DOCX, TXT, CSV) and trigger async indexing."""
    # Verify KB exists
    kb = (await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_id, KnowledgeBase.tenant_id == user.tenant_id)
    )).scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    # Validate file
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    if file.size and file.size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    # Read content
    content = await file.read()

    doc = KBDocument(
        knowledge_base_id=kb_id,
        tenant_id=user.tenant_id,
        file_name=file.filename,
        content_type=file.content_type,
        status="processing",
    )
    db.add(doc)
    await db.flush()

    doc_id = str(doc.id)

    # Trigger async indexing via Celery
    from app.tasks.kb_tasks import index_document
    index_document.delay(
        document_id=doc_id,
        content_b64=base64.b64encode(content).decode("ascii"),
        content_type=file.content_type or "application/octet-stream",
        file_name=file.filename or "unnamed",
    )

    return ApiResponse(data=KBDocumentResponse.model_validate(doc))


class URLImportBody(BaseModel):
    url: str


@router.post("/{kb_id}/documents/url", response_model=ApiResponse[KBDocumentResponse], status_code=201)
async def import_from_url(
    kb_id: UUID,
    body: URLImportBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import a document from a URL and trigger async indexing."""
    kb = (await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_id, KnowledgeBase.tenant_id == user.tenant_id)
    )).scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    doc = KBDocument(
        knowledge_base_id=kb_id,
        tenant_id=user.tenant_id,
        file_name=body.url,
        file_url=body.url,
        content_type="text/html",
        status="processing",
    )
    db.add(doc)
    await db.flush()

    from app.tasks.kb_tasks import index_url
    index_url.delay(document_id=str(doc.id), url=body.url)

    return ApiResponse(data=KBDocumentResponse.model_validate(doc))


@router.delete("/{kb_id}/documents/{doc_id}", response_model=ApiResponse)
async def delete_document(
    kb_id: UUID,
    doc_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a document and all its chunks."""
    doc = (await db.execute(
        select(KBDocument).where(
            KBDocument.id == doc_id,
            KBDocument.knowledge_base_id == kb_id,
            KBDocument.tenant_id == user.tenant_id,
        )
    )).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.delete(doc)
    await db.flush()
    return ApiResponse(data={"deleted": True})


# --- Retrieval / Search ---

class SearchBody(BaseModel):
    query: str
    top_k: int = 5


@router.post("/{kb_id}/search", response_model=ApiResponse[list[KBChunkResponse]])
async def search_knowledge_base(
    kb_id: UUID,
    body: SearchBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search the knowledge base with a natural language query. Returns top-k relevant chunks."""
    # Verify KB exists
    kb = (await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_id, KnowledgeBase.tenant_id == user.tenant_id)
    )).scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    from app.services.rag.retriever import retrieve_context

    chunks = await retrieve_context(db, kb_id, body.query, top_k=body.top_k)

    return ApiResponse(data=[
        KBChunkResponse(
            id=chunk.get("id", ""),
            content=chunk["content"],
            chunk_index=chunk.get("chunk_index"),
            similarity=chunk.get("similarity"),
        )
        for chunk in chunks
    ])
