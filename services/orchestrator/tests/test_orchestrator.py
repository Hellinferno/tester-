import pytest
from src.input_processor import InputValidator, ValidationError
from src.response_builder import ResponseAssembler


def test_input_validator_valid():
    validator = InputValidator()
    assert validator.validate(modality="text_only", text="Hello world") is True


def test_input_validator_missing_image():
    validator = InputValidator()
    with pytest.raises(ValidationError):
        validator.validate(modality="image_only", image_bytes=None)


def test_response_assembler():
    assembler = ResponseAssembler()
    resp = assembler.assemble(
        request_id="req-123",
        modality="text_only",
        input_text="Sample query",
        processing_info={"routing": {"estimated_cost_usd": 0.005}},
        generation_result={"choices": [{"message": {"content": "Answer text"}}]},
    )
    assert resp["request_id"] == "req-123"
    assert resp["response"]["content"] == "Answer text"
    assert resp["cost"]["total_usd"] == 0.005
