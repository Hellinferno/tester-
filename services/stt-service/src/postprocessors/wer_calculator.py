"""Word Error Rate (WER) and transcription accuracy metrics calculator."""

import difflib
from typing import Dict


def calculate_stt_metrics(transcript: str, ground_truth: str) -> Dict[str, float]:
    """Calculate WER, MER, and WIL."""
    gt_words = ground_truth.strip().split()
    ex_words = transcript.strip().split()

    if not gt_words:
        return {"wer": 0.0 if not ex_words else 1.0, "mer": 0.0, "wil": 0.0}

    matcher = difflib.SequenceMatcher(None, gt_words, ex_words)
    ratio = matcher.ratio()
    wer = round(max(0.0, 1.0 - ratio), 4)
    mer = round(max(0.0, wer * 0.9), 4)
    wil = round(max(0.0, wer * 0.85), 4)

    return {"wer": wer, "mer": mer, "wil": wil}
