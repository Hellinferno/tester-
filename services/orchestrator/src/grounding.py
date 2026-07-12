"""SerpAPI web-search grounding for the orchestrator.

When a query enables web search, we fetch live Google results via SerpAPI and
format them as context the LLM can cite. Best-effort: any failure returns ""
so generation still proceeds ungrounded.
"""

import logging
from typing import Any, Dict, List

import httpx

logger = logging.getLogger("orchestrator")

SERPAPI_URL = "https://serpapi.com/search.json"


async def serpapi_search(query: str, api_key: str, num: int = 5) -> Dict[str, Any]:
    """Run a Google search via SerpAPI.

    Returns {"context": <str for the prompt>, "sources": [{title, link, snippet}]}.
    On any failure or missing key, returns empty context/sources (grounding is
    optional and must never break the request).
    """
    empty: Dict[str, Any] = {"context": "", "sources": []}
    if not api_key or not query.strip():
        return empty

    params = {"engine": "google", "q": query.strip(), "api_key": api_key, "num": num}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(SERPAPI_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning(f"SerpAPI grounding failed: {exc}")
        return empty

    results: List[Dict[str, Any]] = data.get("organic_results", []) or []
    sources: List[Dict[str, str]] = []
    lines: List[str] = []
    for i, r in enumerate(results[:num], 1):
        title = r.get("title", "") or ""
        snippet = r.get("snippet", "") or ""
        link = r.get("link", "") or ""
        if not (title or snippet):
            continue
        sources.append({"title": title, "link": link, "snippet": snippet})
        lines.append(f"{i}. {title}\n   {snippet}\n   {link}")

    if not lines:
        return empty

    context = (
        "Live web search results (Google via SerpAPI). Use these to answer "
        "accurately and cite sources where relevant:\n\n" + "\n".join(lines)
    )
    return {"context": context, "sources": sources}
