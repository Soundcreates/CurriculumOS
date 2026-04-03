from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
from pytube import Playlist, YouTube
from langchain_core.documents import Document

def extract_video_id(url: str) -> str:
    if "v=" in url:
        return url.split("v=")[-1].split("&")[0]
    elif "youtu.be/" in url:
        return url.split("youtu.be/")[-1].split("?")[0]
    else:
        raise ValueError("Invalid YouTube URL format")
    

def load_youtube_video(url: str) -> list[Document]:
    video_id = extract_video_id(url)
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=["en"])
    except (TranscriptsDisabled, NoTranscriptFound):
        print(f"No transcript available for video: {url}")
        return []
    except Exception as e:
        print(f"Error fetching transcript: {e}")
        return []

    documents = []

    try:
        yt = YouTube(url)
        title = yt.title
    except Exception:
        title = "Unknown Title"

    for i, chunk in enumerate(transcript):
        text = chunk["text"]
        start_time = chunk["start"]

        documents.append(
            Document(
                page_content = text,
                metadata={
                    "source": "youtube",
                    "video_id": video_id,
                    "title": title,
                    "timestamp": start_time,
                    "sequence": i,
                    "start_time": start_time,
                    "url": url
                }
            )
        )

    return documents

def load_youtube_playlist(url : str):

    playlist= Playlist(url)

    all_docs = []

    for idx, vid_url in enumerate(playlist.video_urls):
        try:
            print(f"Processing video {idx+1}/{len(playlist.video_urls)}: {vid_url}")
            vid_docs = load_youtube_video(vid_url)

            for doc in vid_docs:
                doc.metadata["playlist"] = True
                doc.metadata["video_index"] = idx

            all_docs.extend(vid_docs)
        except Exception as e:
            print(f"Error processing video {vid_url}: {e}")


    return all_docs