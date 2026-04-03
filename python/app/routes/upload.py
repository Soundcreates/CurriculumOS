from fastapi import APIRouter, UploadFile, File
from schemas.request_models import PdfUploadRequest, YoutubeUploadRequest, TextUploadRequest

upload_router = APIRouter()

@upload_router.post("/pdf-upload")
def upload_pdf(file:UploadFile = File(...)):
    pass

@upload_router.post("/youtube-upload")
def upload_youtube(url:YoutubeUploadRequest):
    pass

@upload_router.post("/text-upload")
def upload_text(text:TextUploadRequest):
    pass