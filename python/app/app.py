import os

from app.routes.query import query_router
from app.routes.quiz import quiz_router
from app.routes.upload import upload_router
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
load_dotenv()

print(f"Chroma API Key: {os.getenv('CHROMA_API_KEY')}")
print(f"Chroma Tenant: {os.getenv('CHROMA_TENANT')}")
print(f"Chroma Database: {os.getenv('CHROMA_DATABASE')}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    print("RAG system is live!")


app.include_router(upload_router, prefix="/upload")
app.include_router(query_router, prefix="/query")
app.include_router(quiz_router, prefix="/quiz")


@app.get("/health")
def health_check():
    return {"status": "healthy"}
