import pytest
from src.models import SLMAnalysisEngine
from src.system_instructions import InstructionProfileSelector


@pytest.mark.asyncio
async def test_slm_analysis_engine_code_query():
    engine = SLMAnalysisEngine(api_key="")  # test offline heuristic branch
    result = await engine.analyze(
        text="Can you debug this Python code error?",
        modality="text_only",
    )
    assert result["subject"]["primary"] == "computer_science"
    assert "instruction_profile" in result


@pytest.mark.asyncio
async def test_slm_analysis_engine_math_query():
    engine = SLMAnalysisEngine(api_key="")
    result = await engine.analyze(
        text="Calculate the integral of x^2 dx",
        modality="text_only",
    )
    assert result["subject"]["primary"] == "mathematics"


def test_profile_selector():
    selector = InstructionProfileSelector()
    profile = selector.select("image_text", "computer_science", "high")
    assert profile["title"] == "Technical Analysis"
