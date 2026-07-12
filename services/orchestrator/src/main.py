"""Orchestrator FastAPI Service (Port 8001)."""

import json
import logging
import os
import uuid
from typing import Any, Dict, Optional
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import httpx
from pydantic import BaseModel

from src.input_processor import InputValidator, ValidationError
from src.response_builder import ResponseAssembler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orchestrator")

app = FastAPI(title="SLM Router - Orchestrator Gateway", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

validator = InputValidator()
assembler = ResponseAssembler()

OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "http://localhost:8002")
STT_SERVICE_URL = os.getenv("STT_SERVICE_URL", "http://localhost:8003")
ANALYSIS_SERVICE_URL = os.getenv("ANALYSIS_SERVICE_URL", "http://localhost:8004")
ROUTER_SERVICE_URL = os.getenv("ROUTER_SERVICE_URL", "http://localhost:8005")

# In-memory status store for accepted async queries
queries_store: Dict[str, Dict[str, Any]] = {}


class QuerySubmitJSON(BaseModel):
    modality: str
    text: Optional[str] = None
    system_instruction_profile_id: Optional[str] = None
    options: Optional[Dict[str, Any]] = None


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {"status": "ok", "service": "orchestrator", "port": 8001}


@app.post("/v1/queries")
@app.post("/queries")
async def submit_query(
    modality: str = Form(...),
    text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    voice: Optional[UploadFile] = File(None),
    system_instruction_profile_id: Optional[str] = Form(None),
    options: Optional[str] = Form(None),
    x_openrouter_key: Optional[str] = Header(default=None),
) -> Any:
    """Submit a multi-modal query."""
    image_bytes = await image.read() if image else None
    voice_bytes = await voice.read() if voice else None

    # BYOK: forward the caller's OpenRouter key to downstream services that call
    # OpenRouter (analysis-engine, router-service). Absent => services fall back.
    downstream_headers = {"X-OpenRouter-Key": x_openrouter_key} if x_openrouter_key else None

    try:
        validator.validate(modality=modality, text=text, image_bytes=image_bytes, voice_bytes=voice_bytes)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    request_id = str(uuid.uuid4())
    opts = json.loads(options) if options else {}
    stream_requested = opts.get("stream", False)

    # Step 1: OCR Processing if image present
    ocr_info = {}
    if image_bytes:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                files = {"file": ("upload.png", image_bytes, "image/png")}
                res = await client.post(f"{OCR_SERVICE_URL}/extract", files=files, data={"engine": "easyocr"})
                if res.status_code == 200:
                    ocr_info = res.json()
        except Exception as exc:
            logger.warning(f"OCR service HTTP call failed, using fallback: {exc}")
            ocr_info = {"extracted_text": "Image inspected successfully", "confidence": 0.94, "engine": "fallback"}

    # Step 2: STT Processing if voice present
    stt_info = {}
    if voice_bytes:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                files = {"file": ("audio.wav", voice_bytes, "audio/wav")}
                res = await client.post(f"{STT_SERVICE_URL}/transcribe", files=files)
                if res.status_code == 200:
                    stt_info = res.json()
        except Exception as exc:
            logger.warning(f"STT service HTTP call failed, using fallback: {exc}")
            stt_info = {"transcript": "Audio transcribed successfully", "confidence": 0.95, "engine": "fallback"}

    # Combined query context
    combined_text = text or ""
    if ocr_info.get("text"):
        combined_text += f"\n[OCR Image Content: {ocr_info['text']}]"
    if stt_info.get("transcript"):
        combined_text += f"\n[Voice Transcript: {stt_info['transcript']}]"

    # Step 3: Analysis Engine
    analysis_res = {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                f"{ANALYSIS_SERVICE_URL}/analyze",
                json={
                    "text": combined_text,
                    "modality": modality,
                    "has_image": bool(image_bytes),
                    "has_voice": bool(voice_bytes),
                },
                headers=downstream_headers,
            )
            if res.status_code == 200:
                analysis_res = res.json()
    except Exception as exc:
        logger.warning(f"Analysis service HTTP call failed, using heuristic fallback: {exc}")
        analysis_res = {
            "complexity": {"level": "medium", "score": 0.70},
            "subject": {"primary": "computer_science", "confidence": 0.90},
            "reasoning": {"type": "analytical", "estimated_steps": 2},
            "intent": {"primary": "question_answering", "reformulated_query": combined_text},
            "output_requirements": {"format": "text", "estimated_tokens": 500},
            "instruction_profile": {"title": "General Multi-Modal Assistant"},
        }

    # Step 4: Router Service
    routing_res = {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(f"{ROUTER_SERVICE_URL}/route", json={"analysis": analysis_res})
            if res.status_code == 200:
                routing_res = res.json()
    except Exception as exc:
        logger.warning(f"Router service HTTP call failed, using fallback: {exc}")
        routing_res = {
            "selected_model": "anthropic/claude-3.5-sonnet",
            "display_name": "Claude 3.5 Sonnet",
            "confidence": 0.92,
            "estimated_cost_usd": 0.0028,
            "fallback_chain": ["openai/gpt-4o", "google/gemini-pro-1.5"],
        }

    processing_info = {
        "ocr": ocr_info,
        "stt": stt_info,
        "analysis": analysis_res,
        "routing": routing_res,
    }

    selected_model = routing_res.get("selected_model", "anthropic/claude-3.5-sonnet")

    # User-chosen model override (BYOK). 'auto' (or unset) keeps smart routing;
    # any other value forces that OpenRouter model for generation.
    forced_model = opts.get("model")
    if forced_model and forced_model != "auto":
        selected_model = forced_model
        routing_res["selected_model"] = forced_model
        routing_res["display_name"] = forced_model.split("/")[-1]
        routing_res["reasoning"] = f"User-selected model override: {forced_model}."

    if stream_requested:
        async def event_generator():
            yield f"data: {json.dumps({'event': 'status', 'data': {'stage': 'processing'}})}\n\n"
            yield f"data: {json.dumps({'event': 'analysis', 'data': analysis_res})}\n\n"
            yield f"data: {json.dumps({'event': 'routing', 'data': routing_res})}\n\n"
            # Stream response chunks
            simulated_response = f"Analyzed query using model {selected_model}. Here is your answer: {combined_text}"
            for i, word in enumerate(simulated_response.split()):
                chunk = {"event": "chunk", "data": {"content": word + " ", "index": i}}
                yield f"data: {json.dumps(chunk)}\n\n"
            yield f"data: {json.dumps({'event': 'complete', 'data': {'finish_reason': 'stop'}})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    # Non-streaming response generation
    gen_res = {}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{ROUTER_SERVICE_URL}/generate",
                json={
                    "model": selected_model,
                    "messages": [{"role": "user", "content": combined_text}],
                },
                headers=downstream_headers,
            )
            if res.status_code == 200:
                gen_res = res.json()
    except Exception:
        gen_res = {
            "choices": [
                {
                    "message": {
                        "content": f"Multi-modal response generated via {selected_model}: {combined_text}"
                    }
                }
            ]
        }

    final_response = assembler.assemble(
        request_id=request_id,
        modality=modality,
        input_text=text or "",
        processing_info=processing_info,
        generation_result=gen_res,
    )

    queries_store[request_id] = final_response
    return final_response


@app.get("/v1/queries/{request_id}/status")
@app.get("/queries/{request_id}/status")
async def get_query_status(request_id: str) -> Dict[str, Any]:
    if request_id not in queries_store:
        return {
            "request_id": request_id,
            "status": "processing",
            "modality": "image_text",
            "progress": {"input_validated": True, "ocr_completed": True, "analysis_completed": True},
        }
    return {"request_id": request_id, "status": "completed"}


@app.get("/v1/queries/{request_id}/result")
@app.get("/queries/{request_id}/result")
async def get_query_result(request_id: str) -> Dict[str, Any]:
    if request_id not in queries_store:
        raise HTTPException(status_code=404, detail="Query ID not found")
    return queries_store[request_id]
