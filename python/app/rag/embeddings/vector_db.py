from langchain_chroma import Chroma
import os
from app.rag.embeddings import embedding_function
from app.rag.processors.deduplicator import deduplicate_documents

class vector_db:
  def __init__(self, collection_name):

    self.collection=Chroma(
      collection_name=collection_name,
      embedding_function=embedding_function,
      chroma_cloud_api_key= os.getenv("CHROMA_API_KEY"),
      tenant = os.getenv("CHROMA_TENANT"),
      database = os.getenv("CHROMA_DATABASE"),
    )

  def add_documents(self, documents, batch_size=100):
    for i in range(0, len(documents), batch_size):
      batch = documents[i:i+batch_size]
      self.collection.add_documents(batch)

  def similarity_search(self, query, k:int=5):
    INITIAL_K=20

    search_results = self.collection.similarity_search(query, k=INITIAL_K)
    results = sorted(search_results, key=lambda x: x[1])

    docs_to_return = deduplicate_documents(results)

    return docs_to_return[:k]
