import os
import asyncio
import contextlib
from contextlib import asynccontextmanager

from app.ml_models import ml_models
from app.routes.enrich import enrich_router
from app.routes.query import query_router
from app.routes.quiz import quiz_router
from app.routes.upload import upload_router
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

print(f"Chroma API Key: {os.getenv('CHROMA_API_KEY')}")
print(f"Chroma Tenant: {os.getenv('CHROMA_TENANT')}")
print(f"Chroma Database: {os.getenv('CHROMA_DATABASE')}")


async def _load_ml_models() -> None:
    try:
        from langchain_groq import ChatGroq

        ml_models["llm"] = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0,
            max_tokens=None,
            timeout=None,
            max_retries=2,
        )
        # Keep heavy ranking models lazy-loaded on demand to avoid OOM on small instances.
        ml_models["reranker"] = None
        ml_models["ready"] = True
        ml_models["error"] = None
    except Exception as exc:
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
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


app.include_router(upload_router, prefix="/upload")
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
