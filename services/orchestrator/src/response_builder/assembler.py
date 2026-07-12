"""Response Assembler."""

from datetime import datetime, timezone
from typing import Any, Dict


class ResponseAssembler:
    """Assembles final multi-modal query response conforming to API contracts."""

    def assemble(
        self,
        request_id: str,
        modality: str,
        input_text: str,
        processing_info: Dict[str, Any],
        generation_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        content = ""
        if "choices" in generation_result and generation_result["choices"]:
            content = generation_result["choices"][0].get("message", {}).get("content", "")
        elif isinstance(generation_result, dict):
            content = generation_result.get("content", str(generation_result))

        tokens_used = generation_result.get("usage", {}).get("total_tokens", 250)
        tokens_in = generation_result.get("usage", {}).get("prompt_tokens", 100)
        tokens_out = generation_result.get("usage", {}).get("completion_tokens", 150)

        cost_usd = processing_info.get("routing", {}).get("estimated_cost_usd", 0.0028)

        return {
            "request_id": request_id,
            "status": "completed",
            "modality": modality,
            "input": {
                "text": input_text,
            },
            "processing": processing_info,
            "response": {
                "content": content,
                "content_type": "text/markdown",
                "tokens_used": tokens_used,
                "tokens_input": tokens_in,
                "tokens_output": tokens_out,
                "finish_reason": "stop",
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
            "cost": {
                "total_usd": cost_usd,
                "model_cost": cost_usd,
                "processing_cost": 0.0002,
            },
            "metadata": {
                "system_instruction_profile": processing_info.get("analysis", {}).get("instruction_profile", {}).get("title", "Default"),
            },
        }
