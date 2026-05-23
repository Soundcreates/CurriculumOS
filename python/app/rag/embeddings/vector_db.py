from langchain_chroma import Chroma
import os
from app.rag.embeddings.embeddor import get_embedding_function
from app.rag.processors.deduplicator import deduplicate_documents
from chromadb.errors import InvalidArgumentError

class vector_db:
  def __init__(self, collection_name):
    self.collection_name = collection_name

    self.collection=Chroma(
      collection_name=self.collection_name,
      embedding_function=get_embedding_function(),
      chroma_cloud_api_key= os.getenv("CHROMA_API_KEY"),
      tenant = os.getenv("CHROMA_TENANT"),
      database = os.getenv("CHROMA_DATABASE"),
    )

  def _recreate_collection(self):
    # Reset a stale collection schema (old embedding dimensions) and rebuild it.
    try:
      self.collection.delete_collection()
    except Exception:
      pass

    self.collection = Chroma(
      collection_name=self.collection_name,
      embedding_function=get_embedding_function(),
      chroma_cloud_api_key=os.getenv("CHROMA_API_KEY"),
      tenant=os.getenv("CHROMA_TENANT"),
      database=os.getenv("CHROMA_DATABASE"),
    )

  def add_documents(self, documents, batch_size=100):
    for i in range(0, len(documents), batch_size):
      batch = documents[i:i+batch_size]
      try:
        self.collection.add_documents(batch)
      except InvalidArgumentError as e:
        error_message = str(e).lower()
        if "expecting embedding with dimension" in error_message:
          self._recreate_collection()
          self.collection.add_documents(batch)
        else:
          raise

  def similarity_search(self, query, k:int=5):
    INITIAL_K=20

    search_results = self.collection.similarity_search_with_score(query, k=INITIAL_K)

    sorted_results = sorted(search_results, key=lambda x: x[1])

    docs_to_return = deduplicate_documents(sorted_results)

    return docs_to_return[:k]
