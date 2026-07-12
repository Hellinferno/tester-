"""Base class for STT engines."""

from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseSTTEngine(ABC):
    """Abstract base engine for speech-to-text transcription."""

    name: str = "base"

    @abstractmethod
    async def transcribe(
        self,
        audio_bytes: bytes,
        language: str = "en",
        return_word_timestamps: bool = True,
        return_speaker_labels: bool = False,
    ) -> Dict[str, Any]:
        """Transcribe audio bytes to text and metadata."""
        pass
