import json
import unittest
from unittest.mock import MagicMock, patch

from langchain_core.documents import Document

from app.rag.llm import generate_structured
from app.rag.pipeline import (
    RoadmapDay,
    StructuredRoadmap,
    parse_duration_days,
    pipeline,
    validate_roadmap,
)


class DurationAndValidationTests(unittest.TestCase):
    def test_duration_parser_accepts_supported_units(self):
        self.assertEqual(parse_duration_days("2 weeks"), 14)
        self.assertEqual(parse_duration_days("1 month"), 30)
        self.assertEqual(parse_duration_days("One month"), 30)
        with self.assertRaises(ValueError):
            parse_duration_days("sometime soon")

    def test_roadmap_rejects_unknown_citations(self):
        roadmap = StructuredRoadmap(days=[RoadmapDay(number=1, topic="Python", tasks=["Read", "Practice"], citations=["missing"])])
        with self.assertRaises(ValueError):
            validate_roadmap(roadmap, 1, {"source-1"})


class PipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_pipeline_retrieves_only_the_current_job_and_preserves_citations(self):
        source_doc = Document(page_content="Python basics", metadata={"source": "text"})
        retrieved_doc = Document(page_content="Functions are reusable blocks.", metadata={"chunk_id": "chunk-1", "source": "text"})
        fake_db = MagicMock()
        fake_db.similarity_search.return_value = [retrieved_doc]
        roadmap = StructuredRoadmap(days=[RoadmapDay(number=1, topic="Functions", tasks=["Read about functions", "Write one function"], citations=["chunk-1"])])

        with patch("app.rag.pipeline.vector_db", return_value=fake_db), patch(
            "app.rag.pipeline.chunk_documents", return_value=[source_doc]
        ), patch("app.rag.pipeline.generate_roadmap_structured", return_value=roadmap):
            result = await pipeline([source_doc], "1 day", "Learn Python", ["text"], "job-1", 7)

        self.assertTrue(result["success"])
        self.assertEqual(json.loads(result["roadmap"])["days"][0]["citations"], ["chunk-1"])
        fake_db.similarity_search.assert_called_once()
        self.assertEqual(fake_db.similarity_search.call_args.kwargs["job_id"], "job-1")


class StructuredOutputTests(unittest.TestCase):
    def test_openai_structured_call_uses_strict_schema_and_disables_storage(self):
        response = MagicMock(output_text='{"days":[{"number":1,"topic":"Python","tasks":["Read","Practice"],"citations":["source-1"]}]}')
        client = MagicMock()
        client.responses.create.return_value = response

        result = generate_structured("prompt", StructuredRoadmap, client)

        self.assertEqual(result.days[0].topic, "Python")
        kwargs = client.responses.create.call_args.kwargs
        self.assertFalse(kwargs["store"])
        self.assertTrue(kwargs["text"]["format"]["strict"])
        self.assertFalse(kwargs["text"]["format"]["schema"]["additionalProperties"])
        self.assertFalse(kwargs["text"]["format"]["schema"]["$defs"]["RoadmapDay"]["additionalProperties"])


if __name__ == "__main__":
    unittest.main()
