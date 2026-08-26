import os
import asyncio
import contextlib
from contextlib import asynccontextmanager

from app.ml_models import ml_models
from app.routes.enrich import enrich_router
from app.routes.query import query_router
from app.routes.quiz import quiz_router
from app.routes.worker import worker_router
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


async def _load_ml_models() -> None:
    try:
        from openai import OpenAI

        ml_models["llm"] = OpenAI(
            timeout=float(os.getenv("OPENAI_TIMEOUT_SECONDS", "45")),
            max_retries=2,
        )
        # Keep heavy ranking models lazy-loaded on demand to avoid OOM on small instances.
        ml_models["reranker"] = None
        ml_models["ready"] = True
        ml_models["error"] = None
    except Exception as exc:
        if isinstance(exc, ModuleNotFoundError) and exc.name == "openai":
            ml_models["error"] = "OpenAI SDK is missing. Run: python -m pip install -r requirements.txt"
        else:
            ml_models["error"] = str(exc)
        ml_models["ready"] = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    loader_task = asyncio.create_task(_load_ml_models())
    app.state.model_loader_task = loader_task
    yield
    if not loader_task.done():
        loader_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await loader_task
    ml_models.clear()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


app.include_router(worker_router, prefix="/worker")
app.include_router(query_router, prefix="/query")
app.include_router(quiz_router, prefix="/quiz")
app.include_router(enrich_router, prefix="/enrich")


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "ml_ready": ml_models.get("ready", False),
        "ml_error": ml_models.get("error"),
    }

@app.get("/cron-health")
def cron_health_check():
    return{
        "status":"healthy",
    }
