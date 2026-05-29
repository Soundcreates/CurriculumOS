from __future__ import annotations

import re
from hashlib import sha1

from langchain_core.documents import Document

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    """Normalize text for deduplication."""
    return _WHITESPACE_RE.sub(" ", text).strip().lower()


def document_signature(document: Document) -> str:
    """Generate a signature for a document based on its content."""
    normalized_content = normalize_text(document.page_content)
    return sha1(normalized_content.encode("utf-8")).hexdigest()


def deduplicate_documents(documents: list[Document]) -> list[Document]:
    """
    Remove duplicate documents based on content similarity.

    Uses SHA1 hashing of normalized content to detect duplicates.
    Safe for low-memory environments (no ML models).
    """
    seen_signatures: set[str] = set()
    deduplicated: list[Document] = []

    for document in documents:
        if not document.page_content.strip():
            continue

        signature = document_signature(document)
        if signature in seen_signatures:
            continue

        seen_signatures.add(signature)
        deduplicated.append(document)

    return deduplicated
