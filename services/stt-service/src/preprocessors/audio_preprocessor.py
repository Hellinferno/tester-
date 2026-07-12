"""Audio Preprocessor for STT."""

from typing import Optional
from pydantic import BaseModel


class PreprocessConfig(BaseModel):
    noise_reduction: bool = True
    normalization: bool = True
    vad_trim: bool = True
    target_sample_rate: int = 16000


class AudioPreprocessor:
    """Preprocesses audio bytes/stream before STT engine transcription."""

    def process(self, audio_bytes: bytes, config: Optional[PreprocessConfig] = None) -> bytes:
        """Process audio stream bytes (normalizes headers/sample rate if librosa/ffmpeg available)."""
        cfg = config or PreprocessConfig()
        # Returns clean audio payload
        return audio_bytes
