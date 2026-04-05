"""Knowledge Base indexing tasks — async document processing pipeline.

index_document: Celery task triggered after document upload.
    1. Read document content (from local storage or URL)
    2. Extract text (PDF, DOCX, TXT, CSV)
    3. Chunk text into ~512-token pieces with overlap
    4. Generate embeddings for each chunk
    5. Store chunks + embeddings in kb_chunks (pgvector)
    6. Update document status to "ready"
"""

import asyncio
import logging

from celery_app import celery

logger = logging.getLogger(__name__)

EMBEDDING_BATCH_SIZE = 20  # Embed N chunks at a time to avoid API limits


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _index(document_id: str, content: bytes, content_type: str, file_name: str):
    """Core async indexing pipeline."""
    from sqlalchemy import select
    from app.core.database import async_session
    from app.models.knowledge_base import KBDocument, KBChunk
    from app.services.rag.document_processor import extract_text
    from app.services.rag.chunker import chunk_text
    from app.services.rag.embeddings import generate_embeddings

    async with async_session() as db:
        doc = (await db.execute(
            select(KBDocument).where(KBDocument.id == document_id)
        )).scalar_one_or_none()

        if not doc:
            logger.error("Document %s not found", document_id)
            return

        try:
            # Step 1: Extract text
            logger.info("Extracting text from %s (%s)", file_name, content_type)
            text = await extract_text(content, content_type, file_name)

            if not text or not text.strip():
                doc.status = "failed"
                await db.commit()
                logger.warning("No text extracted from document %s", document_id)
                return

            # Step 2: Chunk
            logger.info("Chunking %d chars of text", len(text))
            chunks = chunk_text(text)

            if not chunks:
                doc.status = "failed"
                await db.commit()
                logger.warning("No chunks produced for document %s", document_id)
                return

            # Step 3: Generate embeddings in batches
            logger.info("Generating embeddings for %d chunks", len(chunks))
            all_embeddings = []
            for i in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
                batch = chunks[i:i + EMBEDDING_BATCH_SIZE]
                batch_embeddings = await generate_embeddings(batch)
                all_embeddings.extend(batch_embeddings)

            # Step 4: Store chunks with embeddings
            for idx, (chunk_text_content, embedding) in enumerate(zip(chunks, all_embeddings)):
                chunk = KBChunk(
                    document_id=doc.id,
                    knowledge_base_id=doc.knowledge_base_id,
                    tenant_id=doc.tenant_id,
                    content=chunk_text_content,
                    embedding=embedding,
                    chunk_index=idx,
                    metadata_={"char_count": len(chunk_text_content)},
                )
                db.add(chunk)

            # Step 5: Update document status
            doc.chunk_count = len(chunks)
            doc.status = "ready"
            await db.commit()

            logger.info(
                "Document %s indexed: %d chunks, %d embeddings",
                document_id, len(chunks), len(all_embeddings),
            )

        except Exception as e:
            doc.status = "failed"
            await db.commit()
            logger.exception("Failed to index document %s: %s", document_id, e)
            raise


@celery.task(name="app.tasks.kb_tasks.index_document", bind=True, max_retries=2)
def index_document(self, document_id: str, content_b64: str, content_type: str, file_name: str):
    """Index a document: extract text → chunk → embed → store.

    Content is passed as base64 to survive Celery JSON serialization.
    """
    import base64
    content = base64.b64decode(content_b64)
    try:
        _run_async(_index(document_id, content, content_type, file_name))
    except Exception as exc:
        logger.exception("index_document failed for %s, retrying", document_id)
        raise self.retry(exc=exc, countdown=30)


@celery.task(name="app.tasks.kb_tasks.index_url")
def index_url(document_id: str, url: str):
    """Index a document from a URL: fetch → extract → chunk → embed → store."""
    _run_async(_index_from_url(document_id, url))


async def _index_from_url(document_id: str, url: str):
    """Fetch URL content and run the indexing pipeline."""
    from sqlalchemy import select
    from app.core.database import async_session
    from app.models.knowledge_base import KBDocument, KBChunk
    from app.services.rag.document_processor import extract_text_from_url
    from app.services.rag.chunker import chunk_text
    from app.services.rag.embeddings import generate_embeddings

    async with async_session() as db:
        doc = (await db.execute(
            select(KBDocument).where(KBDocument.id == document_id)
        )).scalar_one_or_none()

        if not doc:
            return

        try:
            text = await extract_text_from_url(url)

            if not text or not text.strip():
                doc.status = "failed"
                await db.commit()
                return

            chunks = chunk_text(text)
            all_embeddings = []
            for i in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
                batch = chunks[i:i + EMBEDDING_BATCH_SIZE]
                batch_embeddings = await generate_embeddings(batch)
                all_embeddings.extend(batch_embeddings)

            for idx, (chunk_content, embedding) in enumerate(zip(chunks, all_embeddings)):
                chunk = KBChunk(
                    document_id=doc.id,
                    knowledge_base_id=doc.knowledge_base_id,
                    tenant_id=doc.tenant_id,
                    content=chunk_content,
                    embedding=embedding,
                    chunk_index=idx,
                    metadata_={"source_url": url, "char_count": len(chunk_content)},
                )
                db.add(chunk)

            doc.chunk_count = len(chunks)
            doc.status = "ready"
            await db.commit()

            logger.info("URL document %s indexed: %d chunks", document_id, len(chunks))

        except Exception as e:
            doc.status = "failed"
            await db.commit()
            logger.exception("Failed to index URL document %s: %s", document_id, e)
