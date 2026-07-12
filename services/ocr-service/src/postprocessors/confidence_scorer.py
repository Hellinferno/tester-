"""OCR Confidence & Error Rate Scorer."""

import difflib
from typing import Dict, List


def calculate_accuracy_metrics(extracted_text: str, ground_truth: str) -> Dict[str, float]:
    """Calculate Character Error Rate (CER), Word Error Rate (WER), and Accuracies."""
    gt_chars = list(ground_truth)
    ex_chars = list(extracted_text)

    # Character level Levenshtein ratio approximation / CER
    matcher = difflib.SequenceMatcher(None, gt_chars, ex_chars)
    char_acc = round(matcher.ratio(), 4)
    cer = round(max(0.0, 1.0 - char_acc), 4)

    gt_words = ground_truth.split()
    ex_words = extracted_text.split()
    word_matcher = difflib.SequenceMatcher(None, gt_words, ex_words)
    word_acc = round(word_matcher.ratio(), 4)
    wer = round(max(0.0, 1.0 - word_acc), 4)

    return {
        "character_accuracy": char_acc,
        "word_accuracy": word_acc,
        "cer": cer,
        "wer": wer,
    }


def compute_ensemble_vote(results: List[dict]) -> dict:
    """Choose or merge OCR output from multiple engines based on highest confidence score."""
    if not results:
        return {
            "extracted_text": "",
            "confidence": 0.0,
            "engine": "ensemble",
            "words": [],
            "lines": [],
            "blocks": [],
        }

    best = max(results, key=lambda r: r.get("confidence", 0.0))
    merged = dict(best)
    merged["engine"] = "ensemble"
    return merged
