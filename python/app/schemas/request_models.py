from pydantic import BaseModel
class PdfUploadRequest(BaseModel):
    file: bytes 

class YoutubeUploadRequest(BaseModel):
    url: str

class TextUploadRequest(BaseModel): 
    text: str



