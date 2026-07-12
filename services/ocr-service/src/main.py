"""OCR Service FastAPI Application (Port 8002)."""

import io
import logging
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from src.engines import EasyOCREngine, PaddleOCREngine, TesseractEngine
from src.postprocessors import calculate_accuracy_metrics, compute_ensemble_vote
from src.preprocessors import ImagePreprocessor, PreprocessConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-service")

app = FastAPI(title="SLM Router - OCR Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

preprocessor = ImagePreprocessor()
engines = {
    "tesseract": TesseractEngine(),
    "easyocr": EasyOCREngine(),
    "paddleocr": PaddleOCREngine(),
}


class OCRRequestOptions(BaseModel):
    engine: Optional[str] = "easyocr"
    language: Optional[str] = "eng"
    use_ensemble: Optional[bool] = False
    preprocessing: Optional[PreprocessConfig] = None


class OCRTestRequestOptions(BaseModel):
    engines: List[str] = ["tesseract", "easyocr", "paddleocr"]
    language: str = "eng"
    return_bounding_boxes: bool = True
    preprocessing: Optional[PreprocessConfig] = None


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {"status": "ok", "service": "ocr-service", "port": 8002}


@app.post("/extract")
async def extract_text(
    file: UploadFile = File(...),
    engine: str = Form("easyocr"),
    language: str = Form("eng"),
    use_ensemble: bool = Form(False),
) -> Dict[str, Any]:
    """Extract text from uploaded image file."""
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image upload: {exc}")

    processed_image = preprocessor.process(image)

    if use_ensemble:
        results = []
        for eng_name, eng in engines.items():
            res = await eng.extract(processed_image, language)
            results.append(res)
        return compute_ensemble_vote(results)

    selected_engine = engines.get(engine, engines["easyocr"])
    return await selected_engine.extract(processed_image, language)


@app.post("/test")
async def test_ocr(
    file: UploadFile = File(...),
    ground_truth: str = Form(...),
    language: str = Form("eng"),
) -> Dict[str, Any]:
    """Run OCR benchmark across engines and calculate accuracy against ground_truth."""
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image upload: {exc}")

    processed_image = preprocessor.process(image)
    results = []
    best_wer = 1.0
    best_cer = 1.0
    best_engine = "tesseract"

    for eng_name, eng in engines.items():
        res = await eng.extract(processed_image, language)
        metrics = calculate_accuracy_metrics(res.get("text", ""), ground_truth)
        res["metrics"] = metrics
        res["extracted_text"] = res.get("text", "")
        results.append(res)

        if metrics["wer"] < best_wer:
            best_wer = metrics["wer"]
            best_cer = metrics["cer"]
            best_engine = eng_name

    return {
        "status": "completed",
        "results": results,
        "comparison": {
            "best_engine": best_engine,
            "best_wer": best_wer,
            "best_cer": best_cer,
        },
    }
