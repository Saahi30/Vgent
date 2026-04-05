"""RAG retrieval — find relevant chunks from a knowledge base using pgvector.

Used during calls to inject relevant context into the LLM system prompt.
"""

import logging
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_base import KBChunk
from app.services.rag.embeddings import generate_embedding

logger = logging.getLogger(__name__)

DEFAULT_TOP_K = 5
SIMILARITY_THRESHOLD = 0.3  # cosine distance threshold


async def retrieve_context(
    db: AsyncSession,
    knowledge_base_id: str | UUID,
    query: str,
    top_k: int = DEFAULT_TOP_K,
) -> list[dict]:
    """Retrieve the top-k most relevant chunks for a query.

    Returns list of {content, chunk_index, similarity, document_id}.
    Uses pgvector cosine distance (<=> operator).
    """
    query_embedding = await generate_embedding(query)

    # pgvector cosine distance: 1 - cosine_similarity
    # Lower distance = more similar
    result = await db.execute(
        text("""
            SELECT
                id,
                document_id,
                content,
                chunk_index,
                1 - (embedding <=> :embedding::vector) as similarity
            FROM kb_chunks
            WHERE knowledge_base_id = :kb_id
              AND embedding IS NOT NULL
            ORDER BY embedding <=> :embedding::vector
            LIMIT :top_k
        """),
        {
            "kb_id": str(knowledge_base_id),
            "embedding": str(query_embedding),
            "top_k": top_k,
        },
    )

    chunks = []
    for row in result:
        if row.similarity >= SIMILARITY_THRESHOLD:
            chunks.append({
                "content": row.content,
                "chunk_index": row.chunk_index,
                "similarity": round(float(row.similarity), 4),
                "document_id": str(row.document_id),
            })

    logger.info(
        "Retrieved %d chunks (of %d) from KB %s for query: %.50s...",
        len(chunks), top_k, knowledge_base_id, query,
    )
    return chunks


def build_rag_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a context string for the LLM."""
    if not chunks:
        return ""

    parts = ["<knowledge_base>"]
    for i, chunk in enumerate(chunks, 1):
        parts.append(f"[Source {i} (relevance: {chunk['similarity']:.0%})]")
        parts.append(chunk["content"])
        parts.append("")
    parts.append("</knowledge_base>")

    return "\n".join(parts)
