import unittest
from unittest.mock import MagicMock, patch

from langchain_core.documents import Document

from app.rag.embeddings.reranker import deduplicate_documents, rerank_documents
from app.rag.pipeline import pipeline


class RerankerTests(unittest.TestCase):
    def test_deduplicate_documents_uses_normalized_content(self):
        docs = [
            Document(page_content="Python  Basics", metadata={"source": "a"}),
            Document(page_content="python basics ", metadata={"source": "b"}),
            Document(page_content="FastAPI patterns", metadata={"source": "c"}),
        ]

        unique_docs = deduplicate_documents(docs)

        self.assertEqual(len(unique_docs), 2)
        self.assertEqual(unique_docs[0].page_content, "Python  Basics")
        self.assertEqual(unique_docs[1].page_content, "FastAPI patterns")

    def test_rerank_documents_orders_by_model_scores(self):
        docs = [
            Document(page_content="intro to python", metadata={"source": "a"}),
            Document(page_content="advanced fastapi", metadata={"source": "b"}),
            Document(page_content="vector search", metadata={"source": "c"}),
        ]

        fake_reranker = MagicMock()
        fake_reranker.predict.return_value = [0.1, 0.9, 0.3]

        with patch(
            "app.rag.embeddings.reranker.get_reranker",
            return_value=fake_reranker,
        ):
            reranked_docs = rerank_documents("build an api", docs)

        self.assertEqual(reranked_docs[0].page_content, "advanced fastapi")
        self.assertEqual(reranked_docs[1].page_content, "vector search")
        self.assertEqual(reranked_docs[2].page_content, "intro to python")
        self.assertIn("rerank_score", reranked_docs[0].metadata)
        self.assertEqual(reranked_docs[0].metadata["rerank_score"], 0.9)


class PipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_pipeline_uses_retrieved_documents_in_prompt(self):
        input_docs = [Document(page_content="raw source text", metadata={"source": "text"})]
        retrieved_doc = Document(
            page_content="retrieved curriculum chunk",
            metadata={"title": "Curriculum Chunk"},
        )

        fake_db = MagicMock()
        fake_db.similarity_search.return_value = [retrieved_doc]

        with patch("app.rag.pipeline.vector_db", return_value=fake_db), patch(
            "app.rag.pipeline.chunk_documents", return_value=input_docs
        ), patch(
            "app.rag.pipeline.generate_roadmap_structured",
            return_value=MagicMock(days=[]),
        ) as mocked_generate:
            result = await pipeline(input_docs, "3 weeks", "learn python", ["text"])

        self.assertTrue(result["success"])
        generated_prompt = mocked_generate.call_args.args[0]
        self.assertIn("retrieved curriculum chunk", generated_prompt)
        self.assertIn("learn python", generated_prompt)
        fake_db.similarity_search.assert_called_once()
        retrieval_query = fake_db.similarity_search.call_args.args[0]
        self.assertIn("learn python", retrieval_query)
        self.assertIn("3 weeks", retrieval_query)


if __name__ == "__main__":
    unittest.main()
