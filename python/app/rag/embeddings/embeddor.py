from functools import lru_cache

from langchain_community.embeddings import HuggingFaceEmbeddings


@lru_cache(maxsize=1)
def get_embedding_function() -> HuggingFaceEmbeddings:
  return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def embed_documents(documents: list[str]) -> list[list[float]]:
  model = get_embedding_function()
  return model.embed_documents(documents)
