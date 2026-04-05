"""Embedding generation for RAG.

Uses OpenAI-compatible embeddings API. Falls back to a simple TF-IDF-like
hash embedding when no API key is configured (for local dev).

Production: Use OpenAI text-embedding-3-small (1536 dims) or
Gemini text-embedding-004 (768 dims — we pad/project to 1536).
"""

import logging
import hashlib
import struct
from typing import Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1536


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts.

    Tries providers in order: OpenAI → Gemini → local hash fallback.
    """
    settings = get_settings()

    if settings.openai_api_key:
        return await _openai_embeddings(texts, settings.openai_api_key)

    if settings.google_api_key:
        return await _gemini_embeddings(texts, settings.google_api_key)

    # Fallback: deterministic hash-based embeddings (good enough for dev)
    logger.warning("No embedding API key configured — using hash fallback (dev only)")
    return [_hash_embedding(t) for t in texts]


async def generate_embedding(text: str) -> list[float]:
    """Generate a single embedding."""
    results = await generate_embeddings([text])
    return results[0]


async def _openai_embeddings(texts: list[str], api_key: str) -> list[list[float]]:
    """Call OpenAI embeddings API (text-embedding-3-small, 1536 dims)."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "text-embedding-3-small",
                "input": texts,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    embeddings = [item["embedding"] for item in data["data"]]
    logger.info("Generated %d OpenAI embeddings", len(embeddings))
    return embeddings


async def _gemini_embeddings(texts: list[str], api_key: str) -> list[list[float]]:
    """Call Google Gemini embeddings API (text-embedding-004, 768 dims → padded to 1536)."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContent?key={api_key}",
            json={
                "requests": [
                    {"model": "models/text-embedding-004", "content": {"parts": [{"text": t}]}}
                    for t in texts
                ],
            },
        )
        resp.raise_for_status()
        data = resp.json()

    embeddings = []
    for item in data.get("embeddings", []):
        vec = item["values"]
        # Pad to 1536 dims if needed
        if len(vec) < EMBEDDING_DIM:
            vec = vec + [0.0] * (EMBEDDING_DIM - len(vec))
        embeddings.append(vec[:EMBEDDING_DIM])

    logger.info("Generated %d Gemini embeddings (padded to %d dims)", len(embeddings), EMBEDDING_DIM)
    return embeddings


def _hash_embedding(text: str) -> list[float]:
    """Deterministic hash-based pseudo-embedding for dev/testing.

    NOT suitable for production — no semantic understanding.
    Uses SHA-256 to generate a reproducible 1536-dim vector.
    """
    result = []
    i = 0
    while len(result) < EMBEDDING_DIM:
        h = hashlib.sha256(f"{text}:{i}".encode()).digest()
        # Unpack 8 floats from 32 bytes (4 bytes each)
        floats = struct.unpack("8f", h)
        result.extend(floats)
        i += 1
    # Normalize to unit vector
    vec = result[:EMBEDDING_DIM]
    magnitude = sum(x * x for x in vec) ** 0.5
    if magnitude > 0:
        vec = [x / magnitude for x in vec]
    return vec
