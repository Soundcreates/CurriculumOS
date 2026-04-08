from langchain.text_splitter import RecursiveCharacterTextSplitter

def chunk_documents(documents):
  chunker = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=100
  )

  return chunker.split_documents(documents)
