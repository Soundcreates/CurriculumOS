import os

from app.rag.embeddings.embeddor import get_embedding_function
from app.rag.embeddings.reranker import deduplicate_documents
from app.rag.embeddings.reranker_groq import (
    is_reranker_enabled,
    rerank_documents_groq,
)
from chromadb.errors import InvalidArgumentError
from langchain_core.documents import Document
from langchain_chroma import Chroma


class vector_db:
    def __init__(self, collection_name):
        self.collection_name = collection_name

        self.collection = Chroma(
            collection_name=self.collection_name,
            embedding_function=get_embedding_function(),
            chroma_cloud_api_key=os.getenv("CHROMA_API_KEY"),
            tenant=os.getenv("CHROMA_TENANT"),
            database=os.getenv("CHROMA_DATABASE"),
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
            batch = deduplicate_documents(documents[i : i + batch_size])

            if not batch:
                continue

            try:
                self.collection.add_documents(batch)
            except InvalidArgumentError as e:
                error_message = str(e).lower()
                if "expecting embedding with dimension" in error_message:
                    self._recreate_collection()
                    self.collection.add_documents(batch)
                else:
                    raise

    def similarity_search(self, query, k: int = 5):
        max_initial_k = int(os.getenv("RAG_MAX_INITIAL_K", "8"))
        initial_k = min(max(k * 2, 6), max_initial_k)

        search_results = self.collection.similarity_search_with_score(
            query, k=initial_k
        )

        sorted_results = sorted(search_results, key=lambda x: x[1])
        candidate_documents: list[Document] = []

        for document, vector_score in sorted_results:
            metadata = dict(document.metadata or {})
            metadata["vector_score"] = float(vector_score)
            candidate_documents.append(
                Document(
                    page_content=document.page_content,
                    metadata=metadata,
                )
            )

        deduplicated_documents = deduplicate_documents(candidate_documents)

        if is_reranker_enabled():
            from app.ml_models import ml_models
            llm = ml_models.get("llm")
            reranked_documents = rerank_documents_groq(query, deduplicated_documents, llm=llm, top_k=k)
            return reranked_documents

        return deduplicated_documents[:k]
