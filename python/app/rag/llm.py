from langchain_groq import ChatGroq
from langchain_core.documents import Document

llm = ChatGroq(
    model="qwen/qwen3-32b",
    temperature=0,
    max_tokens=None,
    reasoning_format="parsed",
    timeout=None,
    max_retries=2,
)

def generate_roadmap(prompt: str, context_docs: list[Document]):
    roadmap = llm.invoke(prompt)
    return roadmap