"""OpenRouter API client for SLM analysis and response generation.

Vendored into router-service so its Docker image is self-contained (per-service
build context on Render cannot reach packages/shared-python). Keep in sync with
packages/shared-python/src/slm_router_shared/clients/openrouter_client.py —
router-service is the only runtime user of this client.
"""

import logging
from typing import Any, AsyncGenerator, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)


class OpenRouterError(Exception):
    """Exception raised for errors during OpenRouter communication."""
    pass


class OpenRouterClient:
    """Async client for OpenRouter API per Integration Guide."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://openrouter.ai/api/v1",
        timeout: float = 30.0,
    ):
        self.api_key = api_key or ""
        self.base_url = base_url
        headers = {
            "HTTP-Referer": "https://slm-router.io",
            "X-Title": "SLM Router",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers=headers,
            timeout=timeout,
        )

    async def close(self):
        await self.client.aclose()

    def _auth_headers(self, api_key: Optional[str]) -> Optional[Dict[str, str]]:
        """Per-request Authorization override for BYOK. Falls back to the
        client's default key (baked into self.client headers) when None."""
        return {"Authorization": f"Bearer {api_key}"} if api_key else None

    async def chat_completion(
        self,
        model: str,
        messages: List[Dict[str, Any]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stream: bool = False,
        api_key: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Send chat completion request to OpenRouter API.

        Pass `api_key` to use a per-request (BYOK) key instead of the client default.
        """
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
            **kwargs,
        }
        try:
            response = await self.client.post(
                "/chat/completions", json=payload, headers=self._auth_headers(api_key)
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            logger.error(f"OpenRouter chat completion failed: {exc}")
            raise OpenRouterError(f"OpenRouter API request failed: {exc}") from exc

    async def stream_completion(
        self,
        model: str,
        messages: List[Dict[str, Any]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        api_key: Optional[str] = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """Stream SSE chunks from OpenRouter API.

        Pass `api_key` to use a per-request (BYOK) key instead of the client default.
        """
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            **kwargs,
        }
        try:
            async with self.client.stream(
                "POST", "/chat/completions", json=payload, headers=self._auth_headers(api_key)
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:].strip()
                        if data and data != "[DONE]":
                            yield data
        except Exception as exc:
            logger.error(f"OpenRouter streaming error: {exc}")
            raise OpenRouterError(str(exc)) from exc

    async def get_available_models(self) -> List[Dict[str, Any]]:
        """Fetch list of available models from OpenRouter."""
        try:
            response = await self.client.get("/models")
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
        except httpx.HTTPError as exc:
            logger.error(f"Failed to fetch OpenRouter models: {exc}")
            return []
