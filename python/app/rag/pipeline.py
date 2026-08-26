import json
import os
import re

from langchain_core.documents import Document
from pydantic import BaseModel, ConfigDict, Field

from app.rag.embeddings.vector_db import vector_db
from app.rag.llm import generate_roadmap_structured
from app.rag.processors.chunker import chunk_documents


class RoadmapDay(BaseModel):
    model_config = ConfigDict(extra="forbid")

    number: int = Field(..., ge=1)
    topic: str = Field(..., min_length=1)
    tasks: list[str] = Field(..., min_length=2, max_length=4)
    citations: list[str] = Field(..., min_length=1, max_length=3)


class StructuredRoadmap(BaseModel):
    model_config = ConfigDict(extra="forbid")

    days: list[RoadmapDay] = Field(..., min_length=1)


def parse_duration_days(value: str) -> int:
    match = re.fullmatch(
        r"\s*(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*"
        r"(day|days|week|weeks|month|months)\s*",
        value,
        re.IGNORECASE,
    )
    if not match:
        raise ValueError("time_query must use a whole number of days, weeks, or months")
    amount_token = match.group(1).lower()
    word_amounts = {
        "a": 1,
        "an": 1,
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
        "ten": 10,
        "eleven": 11,
        "twelve": 12,
    }
    amount = int(amount_token) if amount_token.isdigit() else word_amounts[amount_token]
    multiplier = {"day": 1, "days": 1, "week": 7, "weeks": 7, "month": 30, "months": 30}[match.group(2).lower()]
    days = amount * multiplier
    if not 1 <= days <= 180:
        raise ValueError("time_query must be between 1 and 180 days")
    return days


def build_retrieval_query(user_goal: str, time_query: str) -> str:
    return f"Learning goal: {user_goal}\nTime available: {time_query}\nFind source passages for prerequisites, concepts, and practice tasks."


def build_context(docs: list[Document]) -> tuple[str, set[str]]:
    max_doc_chars = int(os.getenv("RAG_CONTEXT_DOC_CHARS", "1400"))
    max_total_chars = int(os.getenv("RAG_CONTEXT_TOTAL_CHARS", "9000"))
    current_total = 0
    sections: list[str] = []
    source_ids: set[str] = set()
    for doc in docs:
        metadata = doc.metadata or {}
        chunk_id = str(metadata.get("chunk_id", ""))
        if not chunk_id:
            continue
        label = metadata.get("filename") or metadata.get("title") or metadata.get("source") or "source"
        page = metadata.get("page")
        page_label = f", page {int(page) + 1}" if isinstance(page, int) else ""
        entry = f"[Source {chunk_id}: {label}{page_label}]\n{doc.page_content.strip()[:max_doc_chars]}"
        if current_total + len(entry) > max_total_chars:
            break
        sections.append(entry)
        source_ids.add(chunk_id)
        current_total += len(entry)
    return "\n\n".join(sections), source_ids


def build_generation_prompt(user_goal: str, duration_days: int, context: str) -> str:
    return f"""You are a source-grounded learning planner.

USER GOAL: {user_goal}
DURATION: {duration_days} days

AUTHORITATIVE SOURCE PASSAGES:
{context}

Return exactly {duration_days} sequential daily plans. Each plan needs a specific topic,
2 to 4 concrete tasks, and 1 to 3 citations using only the exact Source IDs above.
Do not use outside knowledge, invent sources, use placeholders, repeat topics, or mention
the schedule itself in quiz-like language. Progress from foundations to application.
"""


def validate_roadmap(roadmap: StructuredRoadmap, expected_days: int, source_ids: set[str]) -> StructuredRoadmap:
    if len(roadmap.days) != expected_days:
        raise ValueError("generated roadmap did not cover the requested duration")
    for expected_number, day in enumerate(roadmap.days, start=1):
        if day.number != expected_number:
            raise ValueError("generated roadmap days must be contiguous")
        if day.topic.strip().lower() in {"unknown", "unknown title", "untitled", "learning focus"}:
            raise ValueError("generated roadmap contains a placeholder topic")
        if any(citation not in source_ids for citation in day.citations):
            raise ValueError("generated roadmap contains an invalid source citation")
    return roadmap


async def pipeline(documents: list[Document], time_query: str, user_goal: str, processed_types: list[str], job_id: str, user_id: int, llm=None):
    duration_days = parse_duration_days(time_query)
    if not documents:
        raise ValueError("no readable source content was found")

    for index, document in enumerate(documents):
        document.metadata = dict(document.metadata or {})
        document.metadata.update({"job_id": job_id, "user_id": str(user_id), "chunk_index": index})
    chunked_docs = chunk_documents(documents)
    if not chunked_docs:
        raise ValueError("source content did not produce usable chunks")
    for index, document in enumerate(chunked_docs):
        document.metadata.update({"job_id": job_id, "user_id": str(user_id), "chunk_index": index})

    db = vector_db(os.getenv("CHROMA_COLLECTION", "curriculum_sources_v1"))
    db.add_documents(chunked_docs)
    matched_docs = db.similarity_search(build_retrieval_query(user_goal, time_query), job_id=job_id, k=6)
    context, source_ids = build_context(matched_docs)
    if not context:
        raise ValueError("no relevant source passages were retrieved")
    roadmap = generate_roadmap_structured(build_generation_prompt(user_goal, duration_days, context), StructuredRoadmap, llm=llm)
    roadmap = validate_roadmap(roadmap, duration_days, source_ids)
    return {
        "success": True,
        "roadmap": json.dumps(roadmap.model_dump(), ensure_ascii=False),
        "documents_count": len(documents),
        "processed_types": processed_types,
    }
