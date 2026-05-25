from langchain_core.documents import Document
from app.rag.embeddings.vector_db import vector_db
from app.rag.processors.chunker import chunk_documents
from app.rag.llm import generate_roadmap_structured
from app.rag.embeddings.reranker import deduplicate_documents, rerank_documents
from pydantic import BaseModel, Field
import json


class RoadmapDay(BaseModel):
   number: int = Field(..., ge=1, description="1-indexed day number")
   topic: str = Field(..., min_length=1)
   tasks: list[str] = Field(default_factory=list)


class StructuredRoadmap(BaseModel):
   days: list[RoadmapDay] = Field(default_factory=list)
def build_retrieval_query(user_goal: str, time_query: str) -> str:
   return f"""
Learning goal: {user_goal}
Time available: {time_query}

Return the most relevant curriculum concepts, prerequisites,
practice tasks, and progression milestones.
""".strip()


def build_time_constrained_prompt(user_goal: str, time_query: str, context: str):
    return f"""
You are an expert AI learning planner.

Your task is to generate a structured, time-constrained learning roadmap.

----------------------
USER GOAL:
{user_goal}

TIME CONSTRAINT:
{time_query}

RETRIEVED KNOWLEDGE BASE:
{context}
----------------------

INSTRUCTIONS:

1. Interpret the TIME CONSTRAINT strictly and convert it into a day-by-day plan.
   - Example: "2 months" ≈ 60 days
   - Example: "3 weeks" ≈ 21 days

2. Create a COMPLETE roadmap covering the FULL duration.

3. Each day MUST include:
   - Topic (what to learn)
   - Tasks (specific actionable steps like read/watch/build/practice)

4. Ensure:
   - Logical progression (beginner → intermediate → advanced)
   - No repetition of topics
   - Balanced workload per day
   - Gradual increase in difficulty

5. Use ONLY the provided KNOWLEDGE BASE.
   - Do NOT hallucinate topics outside context

6. If the duration is long:
   - Group learning into phases (e.g., fundamentals, core concepts, advanced)

----------------------

OUTPUT FORMAT:
- Return ONLY a machine-parseable structured response that matches the schema:
  days: [ {{ number: int, topic: str, tasks: string[] }} ]
- Do not include markdown, explanations, or keys outside this schema.
- Ensure each day has at least one actionable task.

----------------------

IMPORTANT:
- Be precise and structured
- Avoid vague tasks like "study more"
- Prefer actionable tasks like:
  - "Watch video on X"
  - "Implement Y"
  - "Revise Z"

"""


def build_context(docs: list[Document]) -> str:
   sections = []

   for i, doc in enumerate(docs, start=1):
      metadata = doc.metadata or {}
      source_label = (
         metadata.get("title")
         or metadata.get("filename")
         or metadata.get("source")
         or "document"
      )
      sections.append(
         f"[Source {i}: {source_label}]\n{doc.page_content.strip()}"
      )

   return "\n\n".join(sections)
    

async def pipeline(
   documents,
   time_query,
   user_goal,
   processed_types: list[str],
   llm=None,
):
   chunked_docs = chunk_documents(documents)

   db = vector_db("paths")
   db.add_documents(chunked_docs)

   retrieval_query = build_retrieval_query(user_goal, time_query)
   matched_docs = db.similarity_search(retrieval_query, k=6)
   deduplicated_docs = deduplicate_documents(matched_docs)
   reranked_docs = rerank_documents(retrieval_query, deduplicated_docs)
   prompt_context = build_context(reranked_docs)
   print("reranking of documents have been completed")
   prompt = build_time_constrained_prompt(user_goal, time_query, prompt_context)
   roadmap = generate_roadmap_structured(prompt, StructuredRoadmap, llm=llm)

   normalized_days = sorted(
      roadmap.days,
      key=lambda d: d.number,
   )

   roadmap_payload = {
      "days": [
         {
            "number": day.number,
            "topic": day.topic.strip(),
            "tasks": [task.strip() for task in day.tasks if task and task.strip()],
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
