from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.upload import upload_router
from routes.query import query_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    print("RAG system is live!")

app.include_router(upload_router, prefix="/upload")
app.include_router(query_router, prefix="/query")

@app.get("/health")
def health_check():
    return {"status": "healthy"}

