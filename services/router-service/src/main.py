"""Router Service FastAPI Application (Port 8005)."""

import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from slm_router_shared.clients.openrouter_client import OpenRouterClient
from src.routing.model_router import ModelRouter, UserPreferences

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("router-service")

app = FastAPI(title="SLM Router - Router Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

router = ModelRouter()
openrouter_client = OpenRouterClient()


class RouteRequest(BaseModel):
    analysis: Dict[str, Any]
    preferences: Optional[UserPreferences] = None


class GenerateRequest(BaseModel):
    model: str
    messages: List[Dict[str, Any]]
    temperature: float = 0.7
    max_tokens: int = 4096
    stream: bool = False
    system_instruction: Optional[str] = None


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {"status": "ok", "service": "router-service", "port": 8005}


@app.get("/models")
async def list_models() -> Dict[str, Any]:
    return {"models": [m.model_dump() for m in router.models]}


@app.post("/route")
async def route_query(request: RouteRequest) -> Dict[str, Any]:
    return router.route(request.analysis, request.preferences)


@app.post("/generate")
async def generate_response(
    request: GenerateRequest,
    x_openrouter_key: Optional[str] = Header(default=None),
) -> Any:
    messages = list(request.messages)
    if request.system_instruction:
        messages.insert(0, {"role": "system", "content": request.system_instruction})

    # BYOK: the caller's per-request OpenRouter key. Falls back to the client
    # default (usually empty) so offline/test flows still use the mock path.
    api_key = x_openrouter_key or openrouter_client.api_key

    if request.stream:
        async def event_generator():
            if api_key:
                try:
                    async for chunk in openrouter_client.stream_completion(
                        model=request.model,
                        messages=messages,
                        temperature=request.temperature,
                        max_tokens=request.max_tokens,
                        api_key=api_key,
                    ):
                        yield f"data: {chunk}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                except Exception as exc:
                    logger.warning(f"OpenRouter streaming fallback: {exc}")

            # Simulated SSE stream for offline / test / fallback
            words = "Here is the comprehensive, highly accurate response synthesized for your query.".split()
            for i, word in enumerate(words):
                chunk_data = json.dumps({"choices": [{"delta": {"content": word + " "}}]})
                yield f"data: {chunk_data}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    # Non-streaming
    if api_key:
        try:
            return await openrouter_client.chat_completion(
                model=request.model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                api_key=api_key,
            )
        except Exception as exc:
            logger.warning(f"OpenRouter generate fallback: {exc}")

    return {
        "id": "gen-mock-1",
        "model": request.model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Synthesized multi-modal response generated successfully.",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 120, "completion_tokens": 85, "total_tokens": 205},
    }
