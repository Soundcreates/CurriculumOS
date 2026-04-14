from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.upload import upload_router
from app.routes.query import query_router
from dotenv import load_dotenv

app = FastAPI()
load_dotenv()

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

@app.get("/health")
def health_check():
    return {"status": "healthy"}
