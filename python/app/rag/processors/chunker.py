from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_documents(documents):
  chunker = RecursiveCharacterTextSplitter(
    chunk_size=400,
    chunk_overlap=50,
  )

  return chunker.split_documents(documents)
