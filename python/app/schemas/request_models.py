from pydantic import BaseModel
from fastapi import  UploadFile


class PdfUploadRequest(BaseModel):
    file: bytes 

class YoutubeUploadRequest(BaseModel):
    url: str

class TextUploadRequest(BaseModel): 
    text: str



class Source_upload_request(BaseModel):
    text: str | None
    url:str | None
    file: UploadFile | None