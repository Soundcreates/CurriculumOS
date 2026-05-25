from app.ml_models import ml_models
from pydantic import BaseModel

def _get_llm():
    llm = ml_models.get("llm")
    if llm is None:
        raise RuntimeError("LLM is not ready yet")
    return llm


def generate_roadmap(prompt: str, llm=None):
    llm = llm or _get_llm()
    roadmap = llm.invoke(prompt)
    return roadmap


def generate_roadmap_structured(prompt: str, schema: type[BaseModel], llm=None):
    llm = llm or _get_llm()
    structured_llm = llm.with_structured_output(schema)
    return structured_llm.invoke(prompt)


def generate_quiz(prompt: str, llm=None):
    llm = llm or _get_llm()
    quiz = llm.invoke(prompt)
    return quiz


def generate_quiz_structured(prompt: str, schema: type[BaseModel], llm=None):
    llm = llm or _get_llm()
    structured_llm = llm.with_structured_output(schema)
    return structured_llm.invoke(prompt)
