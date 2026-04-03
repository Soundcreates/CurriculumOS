from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.rag.loaders.youtube import load_youtube_video, load_youtube_playlist
from app.rag.loaders.text import load_text, load_text_file
from app.rag.loaders.pdf import load_pdf


upload_router = APIRouter()

@upload_router.post("/source-upload")
async def source_upload(
    text: str | None = Form(None),
    url: str | None = Form(None),
    file: UploadFile | list[UploadFile] | None = File(None),
):
    if not any([text, url, file]):
        raise HTTPException(
            status_code=400,
            detail="Provide at least one source: text, url, or file.",
        )

    all_input_normalized = []
    processed_types = []

    if text and text.strip():
        all_input_normalized.extend(load_text(text))
        processed_types.append("text")

    if url and url.strip():
        cleaned_url = url.strip()
        if "playlist" in cleaned_url:
            all_input_normalized.extend(load_youtube_playlist(cleaned_url))
            processed_types.append("youtube_playlist")
        else:
            all_input_normalized.extend(load_youtube_video(cleaned_url))
            processed_types.append("youtube_video")

    uploaded_files: list[UploadFile] = []
    if isinstance(file, list):
        uploaded_files = file
    elif file is not None:
        uploaded_files = [file]

    for uploaded_file in uploaded_files:
        filename = (uploaded_file.filename or "").lower()
        if filename.endswith(".pdf"):
            all_input_normalized.extend(load_pdf(uploaded_file))
            processed_types.append("pdf")
        elif filename.endswith(".txt") or filename.endswith(".md"):
            all_input_normalized.extend(await load_text_file(uploaded_file))
            processed_types.append("text_file")
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Use .pdf, .txt, or .md",
            )

    return {
        "message": "Sources processed successfully",
        "processed_types": processed_types,
        "documents_count": len(all_input_normalized),
    }
