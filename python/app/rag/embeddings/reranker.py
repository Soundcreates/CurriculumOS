from __future__ import annotations

import re
from functools import lru_cache
from hashlib import sha1

from langchain_core.documents import Document
from sentence_transformers import CrossEncoder


RERANKER_MODEL_NAME = "BAAI/bge-reranker-base"
_WHITESPACE_RE = re.compile(r"\s+")


@lru_cache(maxsize=1)
def get_reranker():
    return CrossEncoder(RERANKER_MODEL_NAME)


def normalize_text(text: str) -> str:
    return _WHITESPACE_RE.sub(" ", text).strip().lower()


def document_signature(document: Document) -> str:
    normalized_content = normalize_text(document.page_content)
    return sha1(normalized_content.encode("utf-8")).hexdigest()


def deduplicate_documents(documents: list[Document]) -> list[Document]:
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


def rerank_documents(query: str, documents: list[Document]) -> list[Document]:
    if not documents:
        return []

    try:
        reranker = get_reranker()
        pairs = [[query, document.page_content] for document in documents]
        scores = reranker.predict(pairs)
    except Exception:
        return documents

    if hasattr(scores, "tolist"):
        scores = scores.tolist()

    reranked_documents: list[Document] = []
    for document, score in zip(documents, scores):
        metadata = dict(document.metadata or {})
        metadata["rerank_score"] = float(score)
        reranked_documents.append(
            Document(
                page_content=document.page_content,
                metadata=metadata,
            )
        )

    reranked_documents.sort(
        key=lambda document: document.metadata.get("rerank_score", float("-inf")),
        reverse=True,
    )

    return reranked_documents
