import io
import pytest
from PIL import Image
from src.engines import EasyOCREngine, PaddleOCREngine, TesseractEngine
from src.postprocessors import calculate_accuracy_metrics, compute_ensemble_vote


@pytest.fixture
def sample_image() -> Image.Image:
    return Image.new("RGB", (200, 100), color=(255, 255, 255))


@pytest.mark.asyncio
async def test_tesseract_engine(sample_image):
    engine = TesseractEngine()
    result = await engine.extract(sample_image)
    assert "text" in result
    assert "confidence" in result
    assert result["engine"] == "tesseract"


@pytest.mark.asyncio
async def test_easyocr_engine(sample_image):
    engine = EasyOCREngine()
    result = await engine.extract(sample_image)
    assert "text" in result
    assert result["engine"] == "easyocr"


@pytest.mark.asyncio
async def test_paddleocr_engine(sample_image):
    engine = PaddleOCREngine()
    result = await engine.extract(sample_image)
    assert "text" in result
    assert result["engine"] == "paddleocr"


def test_calculate_accuracy_metrics():
    extracted = "Hello World"
    ground_truth = "Hello World"
    metrics = calculate_accuracy_metrics(extracted, ground_truth)
    assert metrics["wer"] == 0.0
    assert metrics["cer"] == 0.0
    assert metrics["word_accuracy"] == 1.0


def test_compute_ensemble_vote():
    res1 = {"text": "A", "confidence": 0.80, "engine": "t1"}
    res2 = {"text": "B", "confidence": 0.95, "engine": "t2"}
    winner = compute_ensemble_vote([res1, res2])
    assert winner["text"] == "B"
    assert winner["engine"] == "ensemble"
