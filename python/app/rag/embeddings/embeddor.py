from functools import lru_cache

from langchain_ollama import OllamaEmbeddings


@lru_cache(maxsize=1)
def get_embedding_function() -> OllamaEmbeddings:
    return OllamaEmbeddings(model="qwen3-embedding:0.6b")


def embed_documents(documents: list[str]) -> list[list[float]]:
    model = get_embedding_function()
    return model.embed_documents(documents)
