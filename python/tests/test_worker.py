import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import BackgroundTasks
from langchain_core.documents import Document

from app.ml_models import ml_models
from app.routes.worker import WorkerRequest, _process_generation_job, generate_worker


class WorkerTests(unittest.TestCase):
    def test_worker_completes_with_roadmap_object_not_json_string(self):
        previous_token = os.environ.get("INTERNAL_SERVICE_TOKEN")
        os.environ["INTERNAL_SERVICE_TOKEN"] = "  Bearer test-token  "
        self.addCleanup(_restore_env, "INTERNAL_SERVICE_TOKEN", previous_token)
        ml_models["ready"] = True
        ml_models["llm"] = MagicMock()
        start_response = MagicMock()
        start_response.json.return_value = {
            "id": "job-1",
            "author_id": 1,
            "input": {"sources": [], "user_goal": "Learn Python", "time_query": "1 day"},
        }
        complete_response = MagicMock()
        with patch("app.routes.worker._gateway_request", side_effect=[start_response, complete_response]) as request, patch(
            "app.routes.worker._load_sources", return_value=([Document(page_content="Python", metadata={})], ["text"])
        ), patch(
            "app.routes.worker.pipeline",
            new=AsyncMock(return_value={"roadmap": '{"days": []}', "documents_count": 1}),
        ):
            background_tasks = BackgroundTasks()
            result = generate_worker(
                WorkerRequest(job_id="job-1"),
                background_tasks=background_tasks,
                authorization="Bearer test-token",
            )
            _process_generation_job("job-1")

        self.assertTrue(result["success"])
        completion_payload = request.call_args_list[1].kwargs["json"]
        self.assertEqual(completion_payload["roadmap"], {"days": []})


def _restore_env(key: str, value: str | None) -> None:
    if value is None:
        os.environ.pop(key, None)
    else:
        os.environ[key] = value


if __name__ == "__main__":
    unittest.main()
