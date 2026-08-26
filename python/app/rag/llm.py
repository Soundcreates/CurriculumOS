import os

from app.ml_models import ml_models
from pydantic import BaseModel

def _get_llm():
    llm = ml_models.get("llm")
    if llm is None:
        raise RuntimeError("LLM is not ready yet")
    return llm


def generate_roadmap(prompt: str, llm=None) -> str:
    client = llm or _get_llm()
    response = client.responses.create(
        model=os.getenv("OPENAI_MODEL", "gpt-5.6-luna"),
        input=prompt,
        store=False,
    )
    return response.output_text


def generate_roadmap_structured(prompt: str, schema: type[BaseModel], llm=None):
    return generate_structured(prompt, schema, llm)


def generate_quiz(prompt: str, llm=None) -> str:
    return generate_roadmap(prompt, llm)


def generate_quiz_structured(prompt: str, schema: type[BaseModel], llm=None):
    return generate_structured(prompt, schema, llm)


def generate_structured(prompt: str, schema: type[BaseModel], llm=None):
    client = llm or _get_llm()
    response = client.responses.create(
        model=os.getenv("OPENAI_MODEL", "gpt-5.6-luna"),
        input=prompt,
        text={
            "format": {
                "type": "json_schema",
                "name": schema.__name__.lower(),
                "strict": True,
                "schema": schema.model_json_schema(),
            }
        },
        store=False,
    )
    return schema.model_validate_json(response.output_text)
