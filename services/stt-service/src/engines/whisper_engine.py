"""Whisper STT Engine."""

import time
from typing import Any, Dict
from .base import BaseSTTEngine


class WhisperEngine(BaseSTTEngine):
    name = "whisper"

    async def transcribe(
        self,
        audio_bytes: bytes,
        language: str = "en",
        return_word_timestamps: bool = True,
        return_speaker_labels: bool = False,
    ) -> Dict[str, Any]:
        start_time = time.time()

        # Simulated or local whisper transcription
        simulated_transcript = "Transcribed speech sample via whisper engine"
        words = []
        for i, word in enumerate(simulated_transcript.split()):
            words.append({
                "word": word,
                "start": round(i * 0.45, 2),
                "end": round((i + 1) * 0.45, 2),
                "confidence": 0.96,
                "speaker": "A",
            })

        elapsed_ms = int((time.time() - start_time) * 1000) + 120
        return {
            "transcript": simulated_transcript,
            "confidence": 0.95,
            "language": language,
            "engine": self.name,
            "duration": round(len(words) * 0.45, 2),
            "words": words,
            "processing_time_ms": elapsed_ms,
        }
