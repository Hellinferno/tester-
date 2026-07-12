"""SLM Analysis Engine implementation per section 2 of Computation Engine Spec."""

import asyncio
import json
import logging
import os
from typing import Any, Dict, Optional

import httpx
from src.system_instructions.selector import InstructionProfileSelector

logger = logging.getLogger("analysis-engine")


class SLMAnalysisEngine:
    """Analyzes query complexity, subject, reasoning depth, intent, and instruction profile."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY", "")
        self.selector = InstructionProfileSelector()

    async def analyze(
        self,
        text: str,
        modality: str = "text_only",
        has_image: bool = False,
        has_voice: bool = False,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Perform comprehensive SLM analysis of query.

        `api_key` is the caller's per-request (BYOK) OpenRouter key; when absent
        we fall back to the engine default, then to the offline heuristic.
        """
        effective_key = api_key or self.api_key
        # If a key is available, attempt remote SLM analysis via OpenRouter Llama 3.1 8B
        if effective_key:
            try:
                remote_result = await self._analyze_via_openrouter(text, modality, effective_key)
                if remote_result:
                    return remote_result
            except Exception as exc:
                logger.warning(f"OpenRouter SLM analysis fallback triggered: {exc}")

        # Robust heuristic & keyword SLM analyzer
        return self._analyze_heuristically(text, modality, has_image, has_voice)

    @staticmethod
    def _estimate_thinking(
        reasoning_type: str, estimated_steps: int, complexity_level: str
    ) -> Dict[str, Any]:
        """Heuristic estimate of chain-of-thought ('thinking') tokens the query
        is likely to need before it answers. Simple/factual queries need none.
        Scales with reasoning depth (steps × per-step budget) and complexity."""
        per_step = {"factual": 0, "creative": 120, "analytical": 180, "multi_step": 320}
        complexity_mult = {"low": 0.5, "medium": 1.0, "high": 1.6, "critical": 2.3}
        requires = reasoning_type in ("analytical", "multi_step") or complexity_level in ("high", "critical")
        base = per_step.get(reasoning_type, 150)
        tokens = int(estimated_steps * base * complexity_mult.get(complexity_level, 1.0)) if requires else 0
        return {"requires_thinking": requires, "thinking_tokens": tokens}

    async def _analyze_via_openrouter(
        self, text: str, modality: str, api_key: str
    ) -> Optional[Dict[str, Any]]:
        url = "https://openrouter.ai/api/v1/chat/completions"
        prompt = (
            f"Analyze the query: '{text}' (modality: {modality}). Return JSON with:\n"
            '"complexity": {"level": "low"|"medium"|"high"|"critical", "score": float},\n'
            '"subject": {"primary": string, "confidence": float},\n'
            '"reasoning": {"type": "factual"|"analytical"|"creative"|"multi_step", "estimated_steps": int},\n'
            '"intent": {"primary": string, "reformulated_query": string},\n'
            '"output_requirements": {"format": "text"|"markdown"|"code"|"json", "estimated_tokens": int}'
        )
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://slm-router.io",
            "X-Title": "SLM Router",
        }
        payload = {
            "model": "meta-llama/llama-3.1-8b-instruct",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                data = json.loads(content)
                complexity_level = data.get("complexity", {}).get("level", "medium")
                subject_primary = data.get("subject", {}).get("primary", "general_knowledge")
                profile = self.selector.select(modality, subject_primary, complexity_level)
                data["instruction_profile"] = profile
                # Estimate thinking tokens from the SLM's own reasoning assessment
                reasoning = data.get("reasoning", {}) or {}
                reasoning.update(
                    self._estimate_thinking(
                        reasoning.get("type", "analytical"),
                        int(reasoning.get("estimated_steps", 2) or 2),
                        complexity_level,
                    )
                )
                data["reasoning"] = reasoning
                return data
        return None

    def _analyze_heuristically(
        self, text: str, modality: str, has_image: bool, has_voice: bool
    ) -> Dict[str, Any]:
        lower = (text or "").lower()
        word_count = len(lower.split())

        # Subject classification
        if any(w in lower for w in ["def ", "class ", "code", "python", "javascript", "bug", "error", "stack"]):
            subject = "computer_science"
            conf = 0.92
        elif any(w in lower for w in ["integral", "derivative", "solve", "equation", "math", "calculate"]):
            subject = "mathematics"
            conf = 0.89
        elif any(w in lower for w in ["poem", "story", "creative", "imagine"]):
            subject = "creative_writing"
            conf = 0.85
        else:
            subject = "general_knowledge"
            conf = 0.80

        # Complexity determination
        if word_count > 60 or any(w in lower for w in ["compare", "synthesize", "architecture", "multi-step"]):
            complexity = "high"
            score = 0.85
            steps = 4
            reasoning_type = "multi_step"
        elif word_count > 20 or subject in ["computer_science", "mathematics"]:
            complexity = "medium"
            score = 0.65
            steps = 2
            reasoning_type = "analytical"
        else:
            complexity = "low"
            score = 0.35
            steps = 1
            reasoning_type = "factual"

        # Intent extraction & Output requirements
        if "json" in lower:
            out_fmt = "json"
        elif subject == "computer_science":
            out_fmt = "markdown"
        else:
            out_fmt = "text"

        intent = "code_generation" if subject == "computer_science" else "question_answering"
        profile = self.selector.select(modality, subject, complexity)

        return {
            "complexity": {"level": complexity, "score": score},
            "subject": {"primary": subject, "confidence": conf},
            "reasoning": {
                "type": reasoning_type,
                "estimated_steps": steps,
                **self._estimate_thinking(reasoning_type, steps, complexity),
            },
            "intent": {
                "primary": intent,
                "reformulated_query": text.strip() if text else "Inspect provided media context.",
            },
            "output_requirements": {
                "format": out_fmt,
                "estimated_tokens": min(4096, max(256, word_count * 8)),
            },
            "instruction_profile": profile,
        }
