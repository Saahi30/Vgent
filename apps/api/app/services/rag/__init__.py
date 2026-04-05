"""RAG (Retrieval-Augmented Generation) service.

Modules:
- document_processor: Extract text from PDF, DOCX, TXT, CSV, URLs
- chunker: Split text into overlapping chunks (~512 tokens)
- embeddings: Generate vector embeddings (OpenAI / Gemini / hash fallback)
- retriever: pgvector similarity search + context formatting
"""
