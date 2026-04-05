"""Extract plain text from various document formats.

Supports: PDF, DOCX, TXT, CSV, and web URLs.
"""

import io
import csv
import logging
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)


async def extract_text(content: bytes, content_type: str, file_name: str = "") -> str:
    """Extract plain text from a document based on its content type."""
    ct = (content_type or "").lower()
    ext = Path(file_name).suffix.lower() if file_name else ""

    if ct == "text/plain" or ext == ".txt":
        return content.decode("utf-8", errors="replace")

    if ct == "text/csv" or ext == ".csv":
        return _extract_csv(content)

    if ct == "application/pdf" or ext == ".pdf":
        return _extract_pdf(content)

    if ct in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ) or ext == ".docx":
        return _extract_docx(content)

    raise ValueError(f"Unsupported content type: {content_type} ({file_name})")


async def extract_text_from_url(url: str) -> str:
    """Fetch a URL and extract its text content."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    ct = resp.headers.get("content-type", "text/html").split(";")[0].strip()

    if ct in ("text/plain", "text/csv"):
        return resp.text

    if ct == "application/pdf":
        return _extract_pdf(resp.content)

    # For HTML, strip tags to get raw text
    if "html" in ct:
        return _strip_html(resp.text)

    return resp.text


def _extract_pdf(content: bytes) -> str:
    """Extract text from PDF bytes using pypdf."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(content))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


def _extract_docx(content: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    from docx import Document

    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def _extract_csv(content: bytes) -> str:
    """Convert CSV to readable text (row-by-row)."""
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    rows = []
    for row in reader:
        parts = [f"{h}: {row.get(h, '')}" for h in headers if row.get(h, "").strip()]
        rows.append(", ".join(parts))
    return "\n".join(rows)


def _strip_html(html: str) -> str:
    """Basic HTML tag stripping."""
    import re
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text
