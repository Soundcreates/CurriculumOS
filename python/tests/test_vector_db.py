import unittest
from unittest.mock import MagicMock

from langchain_core.documents import Document

from app.rag.embeddings.vector_db import vector_db


class VectorDatabaseIngestionTests(unittest.TestCase):
    def test_duplicate_chunks_across_batches_are_submitted_once(self):
        unique = [
            Document(
                page_content=f"Source passage {index}",
                metadata={"job_id": "job-1", "chunk_index": index},
            )
            for index in range(100)
        ]
        duplicated = [
            Document(
                page_content=f"  source   passage {index}  ",
                metadata={"job_id": "job-1", "chunk_index": index + 100},
            )
            for index in range(100)
        ]
        collection = MagicMock()
        database = vector_db.__new__(vector_db)
        database.collection = collection

        database.add_documents(unique + duplicated, batch_size=100)

        submitted = sum(
            len(call.args[0])
            for call in collection.add_documents.call_args_list
        )
        self.assertEqual(submitted, 100)
        self.assertEqual(collection.add_documents.call_count, 1)


if __name__ == "__main__":
    unittest.main()
