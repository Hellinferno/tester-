"""STT Service FastAPI Application (Port 8003)."""

import logging
from typing import Any, Dict, List
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.engines import DeepgramEngine, WhisperEngine
from src.postprocessors import calculate_stt_metrics
from src.preprocessors import AudioPreprocessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stt-service")

app = FastAPI(title="SLM Router - STT Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

preprocessor = AudioPreprocessor()
engines = {
    "whisper": WhisperEngine(),
    "deepgram": DeepgramEngine(),
}


class STTTestOptions(BaseModel):
    engines: List[str] = ["whisper", "deepgram"]
    language: str = "en"
    return_word_timestamps: bool = True
    return_speaker_labels: bool = False


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {"status": "ok", "service": "stt-service", "port": 8003}


@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    engine: str = Form("whisper"),
    language: str = Form("en"),
) -> Dict[str, Any]:
    """Transcribe uploaded audio file."""
    try:
        contents = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid audio upload: {exc}")

    clean_audio = preprocessor.process(contents)
    selected_engine = engines.get(engine, engines["whisper"])
    return await selected_engine.transcribe(clean_audio, language)


@app.post("/test")
async def test_stt(
    file: UploadFile = File(...),
    ground_truth: str = Form(...),
    language: str = Form("en"),
) -> Dict[str, Any]:
    """Run STT benchmark across engines and calculate WER against ground_truth."""
    try:
        contents = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid audio upload: {exc}")

    clean_audio = preprocessor.process(contents)
    results = []
    best_wer = 1.0
    best_engine = "whisper"

    for eng_name, eng in engines.items():
        res = await eng.transcribe(clean_audio, language)
        metrics = calculate_stt_metrics(res.get("transcript", ""), ground_truth)
        res["metrics"] = metrics
        results.append(res)

        if metrics["wer"] <= best_wer:
            best_wer = metrics["wer"]
            best_engine = eng_name

    return {
        "status": "completed",
        "results": results,
        "comparison": {
            "best_engine": best_engine,
            "best_wer": best_wer,
        },
    }
