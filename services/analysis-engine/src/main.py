"""Analysis Engine FastAPI Application (Port 8004)."""

import logging
from typing import Any, Dict, Optional
from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.models import SLMAnalysisEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("analysis-engine")

app = FastAPI(title="SLM Router - Analysis Engine", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = SLMAnalysisEngine()


class AnalysisRequest(BaseModel):
    text: str
    modality: str = "text_only"
    has_image: bool = False
    has_voice: bool = False
    metadata: Optional[Dict[str, Any]] = None


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {"status": "ok", "service": "analysis-engine", "port": 8004}


@app.post("/analyze")
async def analyze_query(
    request: AnalysisRequest,
    x_openrouter_key: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """Analyze query complexity, subject, reasoning requirements, and match instruction profile."""
    return await analyzer.analyze(
        text=request.text,
        modality=request.modality,
        has_image=request.has_image,
        has_voice=request.has_voice,
        api_key=x_openrouter_key,
    )
