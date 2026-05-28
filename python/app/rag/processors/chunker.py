import os

from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_documents(documents):
  chunk_size = int(os.getenv("RAG_CHUNK_SIZE", "350"))
  chunk_overlap = int(os.getenv("RAG_CHUNK_OVERLAP", "40"))
  max_chunks = int(os.getenv("RAG_MAX_CHUNKS", "60"))

  chunker = RecursiveCharacterTextSplitter(
    chunk_size=chunk_size,
    chunk_overlap=chunk_overlap,
  )

  chunks = chunker.split_documents(documents)
  return chunks[:max_chunks] if max_chunks > 0 else chunks
