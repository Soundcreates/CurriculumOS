from fastapi import APIRouter
from pydantic import BaseModel
from concurrent.futures import ThreadPoolExecutor, as_completed

enrich_router = APIRouter()

PLACEHOLDER_TOPICS = {"unknown title", "unknown", "untitled", "learning focus", ""}


class ResourceRequest(BaseModel):
    topics: list[str]
    user_goal: str


def _search_topic(topic: str, user_goal: str) -> tuple[str, list[dict]]:
    search_query = topic.strip()
    if search_query.lower() in PLACEHOLDER_TOPICS:
        search_query = user_goal

    resources: list[dict] = []

    try:
        from duckduckgo_search import DDGS

        with DDGS() as ddgs:
            try:
                for r in ddgs.videos(f"{search_query} tutorial", max_results=2) or []:
                    url = r.get("content", "")
                    if url:
                        resources.append({
                            "type": "video",
                            "title": r.get("title", "Video"),
                            "url": url,
                            "thumbnail": (r.get("images") or {}).get("small", ""),
                            "description": r.get("description", ""),
                        })
            except Exception as e:
                pass

            try:
                for r in ddgs.text(
                    f"{search_query} tutorial guide", max_results=4
                ) or []:
                    url = r.get("href", "")
                    if url:
                        resources.append({
                            "type": "article",
                            "title": r.get("title", "Article"),
                            "url": url,
                            "description": (r.get("body") or "")[:200],
                        })
            except Exception as e:
                pass

    except ImportError:
        pass
    except Exception as e:
        pass

    return topic.strip(), resources


@enrich_router.post("/resources")
async def fetch_resources(payload: ResourceRequest):
    topics = [t.strip() for t in (payload.topics or [])[:6] if t and t.strip()]
    if not topics:
        return {"success": True, "resources": {}}

    results: dict[str, list[dict]] = {}

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(_search_topic, topic, payload.user_goal): topic
            for topic in topics
        }
        for future in as_completed(futures, timeout=25):
            try:
                topic_key, resources = future.result()
                results[topic_key] = resources
            except Exception as e:
                original_topic = futures[future]
                results[original_topic] = []

    return {"success": True, "resources": results}
