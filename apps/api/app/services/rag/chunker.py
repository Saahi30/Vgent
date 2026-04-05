"""Text chunking for RAG.

Splits text into overlapping chunks of ~512 tokens (approx 2048 chars)
with configurable overlap.
"""

import logging

logger = logging.getLogger(__name__)

# 1 token ≈ 4 chars for English text
DEFAULT_CHUNK_SIZE = 512  # tokens
DEFAULT_OVERLAP = 50  # tokens
CHARS_PER_TOKEN = 4


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
) -> list[str]:
    """Split text into overlapping chunks.

    Strategy: Split on paragraph boundaries first, then sentence boundaries,
    accumulating until chunk_size is reached. Overlap by re-including the last
    `overlap` tokens worth of text from the previous chunk.
    """
    if not text or not text.strip():
        return []

    max_chars = chunk_size * CHARS_PER_TOKEN
    overlap_chars = overlap * CHARS_PER_TOKEN

    # Split into paragraphs
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]

    chunks: list[str] = []
    current_chunk = ""

    for paragraph in paragraphs:
        # If adding this paragraph exceeds max, flush current chunk
        if current_chunk and len(current_chunk) + len(paragraph) + 1 > max_chars:
            chunks.append(current_chunk.strip())
            # Start new chunk with overlap from end of previous
            if overlap_chars > 0 and len(current_chunk) > overlap_chars:
                current_chunk = current_chunk[-overlap_chars:] + "\n" + paragraph
            else:
                current_chunk = paragraph
        else:
            current_chunk = current_chunk + "\n" + paragraph if current_chunk else paragraph

        # If a single paragraph is larger than max, split it on sentences
        while len(current_chunk) > max_chars:
            split_point = _find_split_point(current_chunk, max_chars)
            chunks.append(current_chunk[:split_point].strip())
            remaining = current_chunk[split_point:]
            if overlap_chars > 0:
                overlap_text = current_chunk[max(0, split_point - overlap_chars):split_point]
                current_chunk = overlap_text + remaining
            else:
                current_chunk = remaining

    # Don't forget the last chunk
    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    logger.info("Chunked text (%d chars) into %d chunks", len(text), len(chunks))
    return chunks


def _find_split_point(text: str, max_chars: int) -> int:
    """Find the best split point near max_chars — prefer sentence boundaries."""
    # Try sentence-end markers: ". ", "! ", "? "
    for marker in [". ", "! ", "? ", "\n"]:
        idx = text.rfind(marker, max_chars // 2, max_chars)
        if idx != -1:
            return idx + len(marker)

    # Fall back to word boundary
    idx = text.rfind(" ", max_chars // 2, max_chars)
    if idx != -1:
        return idx + 1

    # Worst case: hard split
    return max_chars
