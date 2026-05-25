from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.rag.llm import generate_quiz_structured
from app.ml_models import ml_models
from groq import BadRequestError
import re
import json

quiz_router = APIRouter()


class QuizGenerateRequest(BaseModel):
    roadmap_content: str
    user_goal: str
    time_query: str
    processed_types: str
    documents_count: int
    difficulty_tiers: int = Field(..., ge=1, le=4)
    questions_per_tier: int = Field(..., ge=1)


class QuizQuestion(BaseModel):
    question: str = Field(..., min_length=1)
    options: list[str] = Field(..., min_length=4, max_length=4)
    answer: str = Field(..., pattern=r"^[A-D]$")
    explanation: str = Field(..., min_length=1)
    tier: int = Field(..., ge=1, le=4)


class QuizResponse(BaseModel):
    questions: list[QuizQuestion] = Field(..., min_length=1)


def _compact_roadmap_context(text: str, max_chars: int = 12000) -> str:
    if not text:
        return ""

    cleaned = text.replace("\\n", "\n").replace('\\"', '"').strip()

    # For legacy records that accidentally stored full AIMessage repr,
    # extract only the meaningful message content.
    content_match = re.search(r"content=(['\"])([\s\S]*?)\1", cleaned)
    if content_match:
        cleaned = content_match.group(2)

    # Keep dense learning lines and drop noisy telemetry-like keys.
    useful_lines = []
    for line in cleaned.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if any(
            noise in stripped.lower()
            for noise in [
                "response_metadata",
                "token_usage",
                "additional_kwargs",
                "usage_metadata",
                "system_fingerprint",
                "model_name",
                "completion_tokens",
                "prompt_tokens",
            ]
        ):
            continue
        useful_lines.append(stripped)

    condensed = "\n".join(useful_lines).strip()
    if len(condensed) <= max_chars:
        return condensed
    return condensed[:max_chars]


def _build_concept_context(raw_roadmap: str) -> str:
    cleaned = _compact_roadmap_context(raw_roadmap, max_chars=15000)
    try:
        parsed = json.loads(cleaned)
    except Exception:
        return cleaned

    if not isinstance(parsed, dict):
        return cleaned

    days = parsed.get("days")
    if not isinstance(days, list):
        return cleaned

    lines: list[str] = []
    for day in days:
        if not isinstance(day, dict):
            continue
        topic = str(day.get("topic", "")).strip()
        tasks = day.get("tasks", [])
        if topic:
            lines.append(f"Concept: {topic}")
        if isinstance(tasks, list):
            for task in tasks:
                task_text = str(task).strip()
                if task_text:
                    lines.append(f"Learning item: {task_text}")

    concept_text = "\n".join(lines).strip()
    return concept_text or cleaned


def _build_quiz_prompt(payload: QuizGenerateRequest, compact_roadmap: str) -> str:
    total_questions = payload.difficulty_tiers * payload.questions_per_tier
    return f"""
You are an expert instructor.
Create a high-quality conceptual quiz from the learning context below.

USER GOAL: {payload.user_goal}
TIME QUERY: {payload.time_query}
PROCESSED TYPES: {payload.processed_types}
DOCUMENTS COUNT: {payload.documents_count}

LEARNING CONTEXT:
{compact_roadmap}

Rules:
- Generate exactly {total_questions} questions.
- Keep difficulty mixed (easy, medium, hard).
- Ensure questions are grounded in concepts and skills from the learning context.
- Do NOT ask meta/schedule questions (forbidden examples: "what is on day 5?", "which topic is day 3?").
- Prefer conceptual understanding, applied reasoning, and best-practice questions.
- Each question must be standalone and useful for real learning assessment.
- Keep options concise.
- Exactly 4 options per question.
- `answer` must be one of: A, B, C, D.
- Use exactly {payload.difficulty_tiers} difficulty tiers: 1..{payload.difficulty_tiers}.
- Generate exactly {payload.questions_per_tier} questions per tier.
- Include `tier` field for every question.
"""


@quiz_router.post("/generate")
async def generate_quiz_route(payload: QuizGenerateRequest):
    if not ml_models.get("ready"):
        raise HTTPException(
            status_code=503,
            detail="ML models are still loading. Please retry in a moment.",
        )

    if payload.questions_per_tier not in {6, 10, 15}:
        raise HTTPException(status_code=400, detail="questions_per_tier must be one of 6, 10, 15")

    concept_context = _build_concept_context(payload.roadmap_content)
    prompt = _build_quiz_prompt(payload, concept_context)

    try:
        quiz = generate_quiz_structured(prompt, QuizResponse, llm=ml_models.get("llm"))
    except BadRequestError:
        # Retry with tighter context when provider rejects message length.
        reduced_context = _compact_roadmap_context(concept_context, max_chars=5000)
        prompt = _build_quiz_prompt(payload, reduced_context)
        quiz = generate_quiz_structured(prompt, QuizResponse, llm=ml_models.get("llm"))

    expected_total = payload.difficulty_tiers * payload.questions_per_tier
    tier_counts: dict[int, int] = {tier: 0 for tier in range(1, payload.difficulty_tiers + 1)}
    for item in quiz.questions:
        if item.tier in tier_counts:
            tier_counts[item.tier] += 1

    valid_total = len(quiz.questions) == expected_total
    valid_distribution = all(count == payload.questions_per_tier for count in tier_counts.values())
    if not valid_total or not valid_distribution:
        raise HTTPException(
            status_code=422,
            detail="quiz generation did not satisfy tier distribution constraints",
        )

    return {
        "success": True,
        "quiz": quiz.model_dump_json(),
    }
