from fastapi import UploadFile
from fastapi.responses import JSONResponse
from langchain_community.document_loaders import PyPDFLoader 
import tempfile

def load_pdf(file: UploadFile):
    file_name = file.filename
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        temp_file.write(file.file.read())
        temp_file_path =temp_file.name
    loader = PyPDFLoader(temp_file_path)
    docs = loader.load()

    return docs

