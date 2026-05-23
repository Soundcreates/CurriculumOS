from fastapi import APIRouter
from pydantic import BaseModel
from app.rag.llm import generate_quiz

quiz_router = APIRouter()


class QuizGenerateRequest(BaseModel):
    roadmap_content: str
    user_goal: str
    time_query: str
    processed_types: str
    documents_count: int


@quiz_router.post("/generate")
async def generate_quiz_route(payload: QuizGenerateRequest):
    prompt = f"""
You are an expert instructor.
Create a quiz from the roadmap context below.

USER GOAL: {payload.user_goal}
TIME QUERY: {payload.time_query}
PROCESSED TYPES: {payload.processed_types}
DOCUMENTS COUNT: {payload.documents_count}

ROADMAP:
{payload.roadmap_content}

Return STRICT JSON only with this shape:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "answer": "A",
      "explanation": "..."
    }}
  ]
}}

Rules:
- Generate exactly 8 questions.
- Keep difficulty mixed (easy, medium, hard).
- Ensure questions are directly grounded in roadmap content.
"""

    quiz = generate_quiz(prompt)
    return {
        "success": True,
        "quiz": str(quiz),
    }
