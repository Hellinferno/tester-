"""Base class for OCR engines."""

from abc import ABC, abstractmethod
from typing import Any, Dict
from PIL import Image


class BaseOCREngine(ABC):
    """Abstract base engine for OCR processing."""

    name: str = "base"

    @abstractmethod
    async def extract(self, image: Image.Image, language: str = "eng") -> Dict[str, Any]:
        """Extract text, confidence, words, lines, and blocks from a PIL Image."""
        pass
