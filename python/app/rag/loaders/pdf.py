from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
import tempfile
import os
from langchain_core.documents import Document

def load_pdf(file: UploadFile) -> list[Document]:
    return load_pdf_bytes(file.file.read(), file.filename or "source.pdf")


def load_pdf_bytes(content: bytes, filename: str) -> list[Document]:
    temp_file_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        docs = PyPDFLoader(temp_file_path).load()
        for document in docs:
            document.metadata["filename"] = filename
        return docs
    finally:
        if temp_file_path:
            try:
                os.unlink(temp_file_path)
            except FileNotFoundError:
                pass
