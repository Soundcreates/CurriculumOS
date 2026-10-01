from __future__ import annotations

import re
from hashlib import sha1

from langchain_core.documents import Document

_WHITESPACE_RE = re.compile(r"\\s+")


def normalize_text(text: str) -> str:
    """Normalize text for deduplication."""
    return _WHITESPACE_RE.sub(" ", text).strip().lower()


def document_signature(document: Document) -> bytes:
    """Generate a compact signature for a document's normalized content."""
    normalized_content = normalize_text(document.page_content)
    return sha1(normalized_content.encode("utf-8")).digest()


def deduplicate_documents(
    documents: list[Document],
    seen_signatures: set[bytes] | None = None,
    max_seen_signatures: int | None = None,
) -> list[Document]:
    """
    Remove duplicate documents by normalized content.

    A shared signature set deduplicates across batches. Its optional cap bounds
    extra memory; duplicates remain deduplicated within each individual batch.
    """
    batch_signatures: set[bytes] = set()
    deduplicated: list[Document] = []

    for document in documents:
        if not document.page_content.strip():
            continue

        signature = document_signature(document)
        if signature in batch_signatures:
            continue
        batch_signatures.add(signature)

        if seen_signatures is not None and signature in seen_signatures:
            continue
        if (
            seen_signatures is not None
            and (
                max_seen_signatures is None
                or len(seen_signatures) < max_seen_signatures
            )
        ):
            seen_signatures.add(signature)
        deduplicated.append(document)

    return deduplicated
