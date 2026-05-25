from dotenv import load_dotenv
from langchain_groq import ChatGroq
from pydantic import BaseModel

load_dotenv()

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)


def generate_roadmap(prompt: str):
    roadmap = llm.invoke(prompt)
    return roadmap


def generate_roadmap_structured(prompt: str, schema: type[BaseModel]):
    structured_llm = llm.with_structured_output(schema)
    return structured_llm.invoke(prompt)


def generate_quiz(prompt: str):
    quiz = llm.invoke(prompt)
    return quiz


def generate_quiz_structured(prompt: str, schema: type[BaseModel]):
    structured_llm = llm.with_structured_output(schema)
    return structured_llm.invoke(prompt)
