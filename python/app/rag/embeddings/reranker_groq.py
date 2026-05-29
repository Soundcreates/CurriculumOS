import os
from langchain_core.documents import Document
from langchain_groq import ChatGroq
import json


def is_reranker_enabled() -> bool:
    """Check if reranking is enabled via environment variable."""
    return os.getenv("ENABLE_RERANKER", "false").lower() == "true"


def rerank_documents_groq(
    query: str,
    documents: list[Document],
    llm: ChatGroq | None = None,
    top_k: int = 6,
) -> list[Document]:
    """
    Rerank documents using Groq LLM (lightweight, API-based, no model loading).

    Uses the Groq API to score relevance of each document to the query.
    No local models = no memory overhead = safe on 512MB RAM.

    Args:
        query: The search query
        documents: List of documents to rerank
        llm: Optional ChatGroq instance (creates one if None)
        top_k: Number of top documents to return

    Returns:
        Top k documents sorted by relevance score
    """
    if not documents:
        return []

    if llm is None:
        from app.ml_models import ml_models
        llm = ml_models.get("llm")
        if llm is None:
            return documents[:top_k]

    try:
        doc_strings = []
        for i, doc in enumerate(documents):
            doc_str = f"[Doc {i}]: {doc.page_content[:500]}"
            doc_strings.append(doc_str)

        prompt = f"""You are a relevance scoring assistant. Score each document's relevance to the query on a scale of 0-100.

QUERY: {query}

DOCUMENTS:
{chr(10).join(doc_strings)}

Return ONLY valid JSON with scores for each document (0-100), no explanation:
{{"scores": [{{"doc_index": 0, "score": 85}}, {{"doc_index": 1, "score": 42}}, ...]}}

Make sure all doc indices are included."""

        response = llm.invoke(prompt)
        response_text = response.content.strip()

        try:
            result = json.loads(response_text)
            scores = {item["doc_index"]: item["score"] for item in result.get("scores", [])}
        except (json.JSONDecodeError, KeyError, TypeError):
            scores = {}

        scored_docs = []
        for i, doc in enumerate(documents):
            score = scores.get(i, 0)
            scored_docs.append((score, doc))

        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored_docs[:top_k]]

    except Exception as e:
        print(f"[reranker] Groq reranking failed: {e}, falling back to original order")
        return documents[:top_k]
