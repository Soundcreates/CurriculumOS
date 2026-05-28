import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from langchain_core.documents import Document
from pydantic import BaseModel, Field

from app.rag.embeddings.vector_db import vector_db
from app.rag.llm import generate_roadmap_structured
from app.rag.processors.chunker import chunk_documents


# ── Output schemas ────────────────────────────────────────────────────────────

class RoadmapDay(BaseModel):
    number: int = Field(..., ge=1, description="1-indexed day number")
    topic: str = Field(..., min_length=1)
    tasks: list[str] = Field(default_factory=list)


class StructuredRoadmap(BaseModel):
    days: list[RoadmapDay] = Field(default_factory=list)


class CurriculumAnalysis(BaseModel):
    core_topics: list[str] = Field(
        default_factory=list,
        description=(
            "Key learning topics extracted from the materials, "
            "ordered by logical learning progression"
        ),
    )


# ── Retrieval helpers ─────────────────────────────────────────────────────────

def build_retrieval_query(user_goal: str, time_query: str) -> str:
    return (
        f"Learning goal: {user_goal}\n"
        f"Time available: {time_query}\n\n"
        "Return the most relevant curriculum concepts, prerequisites, "
        "practice tasks, and progression milestones."
    )


def build_context(docs: list[Document]) -> str:
    sections: list[str] = []
    max_doc_chars = int(os.getenv("RAG_CONTEXT_DOC_CHARS", "1200"))
    max_total_chars = int(os.getenv("RAG_CONTEXT_TOTAL_CHARS", "8000"))
    current_total = 0

    for i, doc in enumerate(docs, start=1):
        meta = doc.metadata or {}
        label = (
            meta.get("title")
            or meta.get("filename")
            or meta.get("source")
            or "document"
        )
        content = doc.page_content.strip()
        if max_doc_chars > 0:
            content = content[:max_doc_chars]

        entry = f"[Source {i}: {label}]\n{content}"
        if max_total_chars > 0 and current_total + len(entry) > max_total_chars:
            break
        sections.append(entry)
        current_total += len(entry)

    return "\n\n".join(sections)


# ── Agent 1: Understanding ────────────────────────────────────────────────────

def extract_curriculum_topics(
    context: str, user_goal: str, time_query: str, llm
) -> list[str]:
    """
    First agent: reads the retrieved docs and extracts the key curriculum
    topics the learner needs to master, in learning-progression order.
    """
    prompt = f"""You are an expert curriculum analyst.

USER GOAL: {user_goal}
TIME FRAME: {time_query}

RETRIEVED LEARNING MATERIALS:
{context[:5000]}

Carefully read these materials and extract up to 8 core learning topics
that MUST be covered to achieve the user's goal.
Order them by logical learning progression (fundamentals first).
Use the actual topic names found in the materials — be specific, never generic.
Do NOT include "Unknown Title" or placeholder names."""

    try:
        structured = llm.with_structured_output(CurriculumAnalysis)
        result = structured.invoke(prompt)
        topics = [t.strip() for t in (result.core_topics or []) if t and t.strip()]
        # Filter out placeholder junk
        topics = [
            t for t in topics
            if "unknown" not in t.lower() and "untitled" not in t.lower()
        ]
        print(f"[pipeline] Extracted topics: {topics}")
        return topics[:8]
    except Exception as exc:
        print(f"[pipeline] Topic extraction failed: {exc}")
        return []


# ── Agent 2: Web enrichment ───────────────────────────────────────────────────

_MAX_HTML_BYTES = 256 * 1024  # 256 KB cap before BS4 parsing


def _fetch_topic_content(topic: str, user_goal: str) -> str:
    """
    Search DuckDuckGo for the topic and return snippet-only content.
    Page fetching is kept very lean: responses are streamed and capped at
    _MAX_HTML_BYTES before BS4 parsing to avoid large in-memory HTML trees.
    """
    try:
        import requests
        from bs4 import BeautifulSoup
        from duckduckgo_search import DDGS

        query = f"{topic} {user_goal} learn tutorial guide"
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=2)) or []

        parts = [f"[Web — {topic}]"]

        for r in results[:1]:
            url = r.get("href", "")
            title = r.get("title", "Untitled")
            snippet = (r.get("body") or "")[:400]

            if not url:
                parts.append(f"• {title}: {snippet}")
                continue

            try:
                with requests.get(
                    url,
                    timeout=5,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; CurriculumOS/1.0)"},
                    allow_redirects=True,
                    stream=True,
                ) as resp:
                    ctype = resp.headers.get("content-type", "")
                    if resp.ok and "text/html" in ctype:
                        raw_html = resp.raw.read(_MAX_HTML_BYTES, decode_content=True).decode(
                            "utf-8", errors="replace"
                        )
                        soup = BeautifulSoup(raw_html, "html.parser")
                        for noise in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
                            noise.decompose()
                        main = (
                            soup.find("main")
                            or soup.find("article")
                            or soup.find("div", {"role": "main"})
                            or soup.find("body")
                        )
                        raw_text = main.get_text(separator=" ") if main else ""
                        page_text = " ".join(raw_text.split())[:600]
                        del soup, raw_html, raw_text
                        parts.append(f"• {title}\n  {page_text or snippet}")
                    else:
                        parts.append(f"• {title}: {snippet}")
            except Exception:
                parts.append(f"• {title}: {snippet}")

        return "\n".join(parts)

    except Exception as exc:
        print(f"[pipeline] Web fetch failed for '{topic}': {exc}")
        return ""


def enrich_with_web_content(topics: list[str], user_goal: str) -> str:
    """
    Fetches web content for topics sequentially (not concurrently) to keep
    peak memory low on constrained instances.
    """
    if not topics:
        return ""

    sections: list[str] = []
    with ThreadPoolExecutor(max_workers=1) as executor:
        futures = {
            executor.submit(_fetch_topic_content, topic, user_goal): topic
            for topic in topics[:3]
        }
        for future in as_completed(futures, timeout=20):
            try:
                text = future.result()
                if text:
                    sections.append(text)
            except Exception as exc:
                print(f"[pipeline] Web enrichment timeout: {exc}")

    return "\n\n".join(sections)


# ── Agent 3: Final generation prompt ─────────────────────────────────────────

def build_enriched_generation_prompt(
    user_goal: str,
    time_query: str,
    retrieved_context: str,
    web_context: str,
) -> str:
    web_section = (
        f"\nWEB-SOURCED SUPPLEMENTARY CONTENT:\n{web_context[:6000]}\n"
        if web_context.strip()
        else ""
    )

    return f"""You are an expert AI learning planner.

Generate a structured, time-constrained learning roadmap using the
retrieved materials AND the web-sourced supplementary content below.

----------------------
USER GOAL:
{user_goal}

TIME CONSTRAINT:
{time_query}

RETRIEVED KNOWLEDGE BASE (from uploaded materials):
{retrieved_context}
{web_section}
----------------------

INSTRUCTIONS:

1. Convert the TIME CONSTRAINT strictly into the correct number of days:
   - "2 weeks" = 14 days, "1 month" ≈ 30 days, "3 months" ≈ 90 days

2. Create a COMPLETE roadmap covering the FULL duration with one entry per day.

3. Each day MUST have:
   - A clear, specific topic name drawn from the materials or web content
     (NEVER output "Unknown Title", "Unknown", "Learning Focus", or any placeholder)
   - 2–4 concrete, actionable tasks such as:
     "Watch the video on [specific concept]",
     "Implement [specific feature] in [language]",
     "Read the section on [specific topic]",
     "Solve [N] practice problems on [topic]"

4. Logical progression:
   - Fundamentals → Core concepts → Advanced application
   - No repeated topics
   - Balanced workload per day
   - Gradual increase in difficulty

5. Infer meaningful topics from context:
   - If a source has no title, infer the topic from its content
   - Use web content to supplement gaps left by uploaded materials

6. For long durations, group into phases (e.g., Foundations, Core Skills, Project)

----------------------

OUTPUT FORMAT:
Return ONLY a structured response matching this schema:
  days: [ {{ number: int, topic: str, tasks: string[] }} ]

No markdown, no explanations, no keys outside this schema.
Every day must have at least 2 tasks.
"""


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def pipeline(
    documents: list[Document],
    time_query: str,
    user_goal: str,
    processed_types: list[str],
    llm=None,
):
    # ── Step 1: Chunk & embed uploaded content ────────────────────────────────
    chunked_docs = chunk_documents(documents)
    db = vector_db("paths")
    db.add_documents(chunked_docs)

    # ── Step 2: Retrieve relevant chunks ──────────────────────────────────────
    retrieval_query = build_retrieval_query(user_goal, time_query)
    matched_docs = db.similarity_search(retrieval_query, k=6)
    retrieved_context = build_context(matched_docs)

    # ── Step 3: Understanding agent ───────────────────────────────────────────
    # Reads retrieved docs and extracts the core curriculum topics
    print("[pipeline] Running understanding agent...")
    topics = extract_curriculum_topics(retrieved_context, user_goal, time_query, llm)

    # ── Step 4: Web enrichment ────────────────────────────────────────────────
    # Fetches real web content (DDG search + BeautifulSoup page scraping)
    # for each topic to supplement the uploaded materials
    web_context = ""
    if topics:
        print(f"[pipeline] Fetching web content for {len(topics)} topics...")
        web_context = enrich_with_web_content(topics, user_goal)
        print(f"[pipeline] Web content: {len(web_context)} chars")

    # ── Step 5: Final generation with with_structured_output ─────────────────
    print("[pipeline] Running final generation agent...")
    prompt = build_enriched_generation_prompt(
        user_goal, time_query, retrieved_context, web_context
    )
    roadmap = generate_roadmap_structured(prompt, StructuredRoadmap, llm=llm)

    normalized_days = sorted(roadmap.days, key=lambda d: d.number)

    roadmap_payload = {
        "days": [
            {
                "number": day.number,
                "topic": day.topic.strip(),
                "tasks": [t.strip() for t in day.tasks if t and t.strip()],
            }
            for day in normalized_days
        ]
    }
    roadmap_content = json.dumps(roadmap_payload, ensure_ascii=False)

    return {
        "success": True,
        "message": "Roadmap generated successfully",
        "roadmap": roadmap_content,
        "user_goal": user_goal,
        "time_query": time_query,
        "processed_types": processed_types,
        "documents_count": len(documents),
    }
