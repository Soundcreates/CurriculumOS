import os
from hashlib import sha256

from app.rag.embeddings.embeddor import get_embedding_function
from app.rag.embeddings.reranker import deduplicate_documents
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

    def add_documents(self, documents, batch_size=100):
        for i in range(0, len(documents), batch_size):
            batch = deduplicate_documents(documents[i : i + batch_size])

            if not batch:
                continue

            ids = []
            for document in batch:
                stable_key = f"{document.metadata.get('job_id', '')}:{document.metadata.get('chunk_index', '')}:{document.page_content}"
                chunk_id = sha256(stable_key.encode("utf-8")).hexdigest()
                document.metadata["chunk_id"] = chunk_id
                ids.append(chunk_id)
            self.collection.add_documents(batch, ids=ids)

    def similarity_search(self, query, job_id: str, k: int = 5):
        max_initial_k = int(os.getenv("RAG_MAX_INITIAL_K", "8"))
        initial_k = min(max(k * 2, 6), max_initial_k)

        search_results = self.collection.similarity_search_with_score(
            query, k=initial_k, filter={"job_id": job_id}
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

        return deduplicated_documents[:k]
