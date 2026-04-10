from langchain_core.documents import Document
from sqlalchemy.ext.asyncio import AsyncSession
from app.rag.embeddings.vector_db import vector_db
from app.rag.processors.chunker import chunk_documents
from app.rag.llm import generate_roadmap
from app.models.roadmap import Roadmap

def build_time_constrained_prompt(user_goal: str, time_query: str, context: str):
    return f"""
You are an expert AI learning planner.

Your task is to generate a structured, time-constrained learning roadmap.

----------------------
USER GOAL:
{user_goal}

TIME CONSTRAINT:
{time_query}

KNOWLEDGE BASE:
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

OUTPUT FORMAT (STRICT,JSON ONLY):

Day 1:
Topic:
Tasks:

Day 2:
Topic:
Tasks:

JSON-FORMAT:
day: {
    "number":1,
    "topic" : "Topci Name",
    "tasks": [
        "Task 1",
        "Task 2",
        ...]

}

...

Continue until ALL days are covered.

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
    context = ""

    for i, doc in enumerate(docs):
        context += f"\n[Source {i+1}]\n"
        context += doc.page_content + "\n"

    return context
    

async def pipeline(
   documents,
   time_query,
   user_goal,
   session: AsyncSession,
   processed_types: list[str],
):
   prompt_context = build_context(documents)
   chunked_docs = chunk_documents(documents)

   db = vector_db("paths")
   db.add_documents(chunked_docs)

   prompt = build_time_constrained_prompt(user_goal, time_query, prompt_context)
   matched_docs = db.similarity_search(prompt, k=5)
   roadmap = generate_roadmap(prompt, matched_docs)

   roadmap_record = Roadmap(
      user_goal=user_goal,
      time_query=time_query,
      roadmap_content=str(roadmap),
      processed_types=",".join(processed_types),
      documents_count=len(documents),
      name=user_goal,
      description=f"Roadmap for {time_query}",
   )
   session.add(roadmap_record)
   await session.commit()
   await session.refresh(roadmap_record)

   return {"success": True, "roadmap": roadmap, "roadmap_id": roadmap_record.id}
