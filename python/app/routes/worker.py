import asyncio
import base64
import json
import logging
import os
from typing import Any

import requests
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from langchain_core.documents import Document
from pydantic import BaseModel

from app.ml_models import ml_models
from app.rag.loaders.pdf import load_pdf_bytes
from app.rag.loaders.text import load_text
from app.rag.loaders.youtube import load_youtube_playlist, load_youtube_video
from app.rag.pipeline import pipeline
from app.rag.processors.cleaner import clean_documents

worker_router = APIRouter()
http = requests.Session()
logger = logging.getLogger(__name__)


class WorkerRequest(BaseModel):
    job_id: str


def _service_token() -> str:
    return os.getenv("INTERNAL_SERVICE_TOKEN", "")


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_service_token()}"}


def _gateway_request(method: str, path: str, **kwargs: Any) -> requests.Response:
    gateway_url = os.getenv("GATEWAY_URL", "http://127.0.0.1:8080").rstrip("/")
    response = http.request(method, f"{gateway_url}{path}", headers=_headers(), timeout=(5, 90), **kwargs)
    response.raise_for_status()
    return response


def _load_sources(input_data: dict[str, Any]) -> tuple[list[Document], list[str]]:
    documents: list[Document] = []
    processed_types: list[str] = []
    for source in input_data.get("sources", []):
        kind = source.get("kind")
        if kind == "text":
            documents.extend(load_text(source.get("content", "")))
            processed_types.append("text")
        elif kind == "text_file":
            documents.extend(load_text(source.get("content", "")))
            if documents:
                documents[-1].metadata.update({"filename": source.get("name", "source.txt"), "source": "file"})
            processed_types.append("text_file")
        elif kind == "pdf":
            documents.extend(load_pdf_bytes(base64.b64decode(source.get("content", ""), validate=True), source.get("name", "source.pdf")))
            processed_types.append("pdf")
        elif kind == "youtube_url":
            url = source.get("url", "")
            loader = load_youtube_playlist if ("playlist" in url or "list=" in url) else load_youtube_video
            documents.extend(loader(url))
            processed_types.append("youtube")
    return clean_documents(documents), list(dict.fromkeys(processed_types))


@worker_router.post("/generate")
def generate_worker(
    payload: WorkerRequest,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(None),
):
    service_token = _service_token()
    if not service_token or authorization != f"Bearer {service_token}":
        raise HTTPException(status_code=401, detail="unauthorized")
    if not ml_models.get("ready"):
        raise HTTPException(status_code=503, detail="LLM client is not ready")

    background_tasks.add_task(_process_generation_job, payload.job_id)
    return {"success": True}


def _process_generation_job(job_id: str) -> None:
    try:
        job = _gateway_request("POST", f"/internal/generation-jobs/{job_id}/start").json()
        input_data = job["input"]
        documents, processed_types = _load_sources(input_data)
        result = asyncio.run(pipeline(
            documents=documents,
            time_query=input_data["time_query"],
            user_goal=input_data["user_goal"],
            processed_types=processed_types,
            job_id=job_id,
            user_id=int(job["author_id"]),
            llm=ml_models.get("llm"),
        ))
        _gateway_request("POST", f"/internal/generation-jobs/{job_id}/complete", json={
            "roadmap": json.loads(result["roadmap"]),
            "documents_count": result["documents_count"],
        })
    except Exception:
        logger.exception("generation job failed", extra={"job_id": job_id})
        try:
            _gateway_request("POST", f"/internal/generation-jobs/{job_id}/fail", json={"error": "generation failed; retry the job"})
        except Exception:
            pass
