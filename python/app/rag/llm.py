from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_groq import ChatGroq

load_dotenv()

llm = ChatGroq(
    model="meta-llama/llama-prompt-guard-2-86m",
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)


def generate_roadmap(prompt: str, context_docs: list[Document]):
    roadmap = llm.invoke(prompt)
    return roadmap


def generate_quiz(prompt: str):
    quiz = llm.invoke(prompt)
    return quiz
