import pytest
from src.engines import DeepgramEngine, WhisperEngine
from src.postprocessors import calculate_stt_metrics


@pytest.mark.asyncio
async def test_whisper_engine():
    engine = WhisperEngine()
    result = await engine.transcribe(b"fake_audio_bytes", "en")
    assert "transcript" in result
    assert result["engine"] == "whisper"


@pytest.mark.asyncio
async def test_deepgram_engine():
    engine = DeepgramEngine()
    result = await engine.transcribe(b"fake_audio_bytes", "en")
    assert "transcript" in result
    assert result["engine"] == "deepgram"


def test_calculate_stt_metrics():
    transcript = "hello world test"
    ground_truth = "hello world test"
    metrics = calculate_stt_metrics(transcript, ground_truth)
    assert metrics["wer"] == 0.0
