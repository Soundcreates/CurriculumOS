from app.rag.embeddings.vector_db import vector_db
from app.rag.chunking import chunk_documents

def pipeline(documents):

    chunked_docs = chunk_documents(documents)

    db = vector_db("paths")
    db.add_documents(chunked_docs)
    return {"success" :True}
