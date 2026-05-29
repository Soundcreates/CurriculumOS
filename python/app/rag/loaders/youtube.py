from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import WebshareProxyConfig
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
from pytube import Playlist, YouTube
from langchain_core.documents import Document
from urllib.parse import parse_qs, urlparse
import re
import requests
import os

def extract_video_id(url: str) -> str:
    if "v=" in url:
        return url.split("v=")[-1].split("&")[0]
    elif "youtu.be/" in url:
        return url.split("youtu.be/")[-1].split("?")[0]
    else:
        raise ValueError("Invalid YouTube URL format")

def load_youtube_video(url: str) -> list[Document]:
    video_id = extract_video_id(url)
    
    proxy_username = os.getenv("WEBSHARE_PROXY_USERNAME")
    proxy_password = os.getenv("WEBSHARE_PROXY_PASSWORD")
    
    if proxy_username and proxy_password:
        proxy_config = WebshareProxyConfig(
            proxy_username=proxy_username,
            proxy_password=proxy_password
        )
        api = YouTubeTranscriptApi(proxy_config=proxy_config)
    else:
        api = YouTubeTranscriptApi()

    try:
        transcript = api.fetch(video_id, languages=["en"])
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
        text = chunk.text
        start_time = chunk.start

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

def load_youtube_playlist(url: str) -> list[Document]:
    video_urls = _get_playlist_video_urls(url)
    all_docs = []

    for idx, vid_url in enumerate(video_urls):
        try:
            print(f"Processing video {idx+1}/{len(video_urls)}: {vid_url}")
            vid_docs = load_youtube_video(vid_url)

            for doc in vid_docs:
                doc.metadata["playlist"] = True
                doc.metadata["video_index"] = idx

            all_docs.extend(vid_docs)
        except Exception as e:
            print(f"Error processing video {vid_url}: {e}")

    return all_docs


def _get_playlist_video_urls(url: str) -> list[str]:
    try:
        playlist = Playlist(url)
        urls = list(playlist.video_urls)
        if urls:
            return urls
    except Exception as e:
        print(f"pytube playlist parsing failed: {e}")

    playlist_id = _extract_playlist_id(url)
    if not playlist_id:
        return []

    return _extract_playlist_video_urls_from_html(playlist_id)


def _extract_playlist_id(url: str) -> str | None:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    playlist_id = query.get("list", [None])[0]
    return playlist_id


def _extract_playlist_video_urls_from_html(playlist_id: str) -> list[str]:
    playlist_url = f"https://www.youtube.com/playlist?list={playlist_id}"
    response = requests.get(playlist_url, timeout=15)
    response.raise_for_status()

    pattern = re.compile(r'"videoId":"([A-Za-z0-9_-]{11})"')
    video_ids = pattern.findall(response.text)
    seen = set()
    urls = []
    for video_id in video_ids:
        if video_id in seen:
            continue
        seen.add(video_id)
        urls.append(f"https://www.youtube.com/watch?v={video_id}")

    return urls
