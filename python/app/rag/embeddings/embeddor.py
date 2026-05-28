from functools import lru_cache

from langchain_community.embeddings.fastembed import FastEmbedEmbeddings


@lru_cache(maxsize=1)
def get_embedding_function() -> FastEmbedEmbeddings:
    return FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")


def embed_documents(documents: list[str]) -> list[list[float]]:
    model = get_embedding_function()
    return model.embed_documents(documents)
