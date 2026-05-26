from __future__ import annotations

import os
import re
from collections import Counter
from hashlib import sha1

from langchain_core.documents import Document
from app.ml_models import ml_models

RERANKER_MODEL_NAME = os.getenv("RERANKER_MODEL_NAME", "cross-encoder/ms-marco-MiniLM-L-2-v2")
RERANKER_PROVIDER = os.getenv("RERANKER_PROVIDER", "lexical").strip().lower()
_TOKEN_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)
_WHITESPACE_RE = re.compile(r"\s+")


def reranker_enabled() -> bool:
    return os.getenv("ENABLE_RERANKER", "true").strip().lower() in {"1", "true", "yes", "on"}


def get_reranker():
    if not reranker_enabled():
        return None

    reranker = ml_models.get("reranker")
    if reranker is None:
        from sentence_transformers import CrossEncoder

        reranker = CrossEncoder(RERANKER_MODEL_NAME)
        ml_models["reranker"] = reranker
    return reranker


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def lexical_score(query_tokens: Counter[str], doc_tokens: list[str]) -> float:
    if not doc_tokens:
        return 0.0

    doc_counts = Counter(doc_tokens)
    score = 0.0
    for token, weight in query_tokens.items():
        if token in doc_counts:
            score += weight * min(doc_counts[token], weight)
    return score


def lexical_rerank(query: str, documents: list[Document]) -> list[Document]:
    query_tokens = tokenize(query)
    if not query_tokens:
        return documents

    query_counts = Counter(query_tokens)
    scored: list[tuple[Document, float]] = []
    for document in documents:
        score = lexical_score(query_counts, tokenize(document.page_content))
        scored.append((document, score))

    scored.sort(key=lambda item: item[1], reverse=True)

    reranked: list[Document] = []
    for document, score in scored:
        metadata = dict(document.metadata or {})
        metadata["rerank_score"] = float(score)
        reranked.append(
            Document(
                page_content=document.page_content,
                metadata=metadata,
            )
        )

    return reranked


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

    rerank_top_n = int(os.getenv("RERANK_TOP_N", "6"))
    candidates = documents[: max(1, rerank_top_n)]

    if RERANKER_PROVIDER != "cross-encoder":
        return lexical_rerank(query, candidates) + documents[len(candidates):]

    try:
        reranker = get_reranker()
        if reranker is None:
            return documents

        rerank_batch_size = int(os.getenv("RERANK_BATCH_SIZE", "2"))
        pairs = [[query, document.page_content] for document in candidates]
        scores = reranker.predict(pairs, batch_size=max(1, rerank_batch_size))
    except Exception:
        return lexical_rerank(query, candidates) + documents[len(candidates):]

    if hasattr(scores, "tolist"):
        scores = scores.tolist()

    reranked_documents: list[Document] = []
    for document, score in zip(candidates, scores):
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

    # Keep non-reranked tail ordered by vector score behind reranked candidates.
    if len(documents) > len(candidates):
        reranked_documents.extend(documents[len(candidates):])

    return reranked_documents
