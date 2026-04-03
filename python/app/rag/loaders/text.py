from fastapi import UploadFile
from langchain_core.documents import Document

def load_text(text:str):
    if not text or not text.strip():
        return []
    
    return [
        Document(
            page_content =text.strip(),
            metadata={
                "source": "text",
                "type": "raw_input"
            }
        )
    ]

async def load_text_file(file: UploadFile):
    content = await file.read()

    try:
        text= content.decode('utf-8')
    except UnicodeDecodeError:
        text= content.decode('latin-1')
    
    if not text.strip():
        return []
    
    return [
        Document(
            page_content = text.strip(),
            metadata={
                "source": "text",
                "type": "file",
                "filename": file.filename
            }
        )
    ]