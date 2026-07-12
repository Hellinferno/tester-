"""OCR Engines."""
from .base import BaseOCREngine
from .tesseract_engine import TesseractEngine
from .easyocr_engine import EasyOCREngine
from .paddleocr_engine import PaddleOCREngine

__all__ = ['BaseOCREngine', 'TesseractEngine', 'EasyOCREngine', 'PaddleOCREngine']
