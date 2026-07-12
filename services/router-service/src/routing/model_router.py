"""Model Router implementation per section 5 of Computation Engine Spec."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class UserPreferences(BaseModel):
    priority: str = "quality"  # quality | cost | latency
    budget_usd: float = 0.05
    max_latency_ms: int = 10000


class RegisteredModel(BaseModel):
    model_id: str
    provider: str = "openrouter"
    display_name: str
    capabilities: List[str]
    max_tokens: int
    context_window: int
    cost_per_1k_input: float
    cost_per_1k_output: float
    average_latency_ms: int
    is_active: bool = True
    is_fallback: bool = False


class ModelRouter:
    """Intelligent model selection algorithm."""

    def __init__(self, models: Optional[List[RegisteredModel]] = None):
        self.models = models or self._get_default_models()

    def _get_default_models(self) -> List[RegisteredModel]:
        return [
            RegisteredModel(
                model_id="anthropic/claude-3.5-sonnet",
                display_name="Claude 3.5 Sonnet",
                capabilities=["vision", "code", "reasoning", "multilingual"],
                max_tokens=8192,
                context_window=200000,
                cost_per_1k_input=0.003,
                cost_per_1k_output=0.015,
                average_latency_ms=2500,
            ),
            RegisteredModel(
                model_id="openai/gpt-4o",
                display_name="GPT-4o",
                capabilities=["vision", "code", "reasoning", "multilingual"],
                max_tokens=4096,
                context_window=128000,
                cost_per_1k_input=0.0025,
                cost_per_1k_output=0.010,
                average_latency_ms=2200,
            ),
            RegisteredModel(
                model_id="openai/gpt-4o-mini",
                display_name="GPT-4o Mini",
                capabilities=["vision", "code", "multilingual"],
                max_tokens=4096,
                context_window=128000,
                cost_per_1k_input=0.00015,
                cost_per_1k_output=0.0006,
                average_latency_ms=1100,
                is_fallback=True,
            ),
            RegisteredModel(
                model_id="google/gemini-flash-1.5",
                display_name="Gemini 1.5 Flash",
                capabilities=["vision", "multilingual", "fast"],
                max_tokens=8192,
                context_window=1000000,
                cost_per_1k_input=0.000075,
                cost_per_1k_output=0.0003,
                average_latency_ms=900,
                is_fallback=True,
            ),
            RegisteredModel(
                model_id="meta-llama/llama-3.1-8b-instruct",
                display_name="Llama 3.1 8B Instruct",
                capabilities=["code", "fast"],
                max_tokens=4096,
                context_window=131072,
                cost_per_1k_input=0.00005,
                cost_per_1k_output=0.00015,
                average_latency_ms=750,
            ),
        ]

    def route(
        self,
        analysis: Dict[str, Any],
        preferences: Optional[UserPreferences] = None,
    ) -> Dict[str, Any]:
        prefs = preferences or UserPreferences()
        modality = analysis.get("modality", "text_only")
        complexity = analysis.get("complexity", {}).get("level", "medium")
        subject = analysis.get("subject", {}).get("primary", "general_knowledge")
        reasoning = analysis.get("reasoning", {}).get("type", "analytical")
        estimated_tokens = analysis.get("output_requirements", {}).get("estimated_tokens", 500)

        scores: Dict[str, float] = {}
        candidate_models = [m for m in self.models if m.is_active]

        for model in candidate_models:
            score = self._score_model(model, modality, complexity, subject, reasoning, estimated_tokens, prefs)
            scores[model.model_id] = score

        best_model_id = max(scores, key=scores.get) if scores else "openai/gpt-4o-mini"
        best_model = next((m for m in candidate_models if m.model_id == best_model_id), candidate_models[0])

        # Build fallback chain
        fallback_chain = [
            m.model_id
            for m in sorted(candidate_models, key=lambda m: scores.get(m.model_id, 0.0), reverse=True)
            if m.model_id != best_model_id
        ][:2]

        estimated_cost = round(
            (estimated_tokens / 1000.0) * best_model.cost_per_1k_input
            + (estimated_tokens / 1000.0) * best_model.cost_per_1k_output,
            6,
        )

        return {
            "selected_model": best_model.model_id,
            "display_name": best_model.display_name,
            "confidence": round(scores.get(best_model.model_id, 0.88), 4),
            "estimated_cost_usd": estimated_cost,
            "estimated_latency_ms": best_model.average_latency_ms,
            "fallback_chain": fallback_chain,
            "reasoning": f"Optimal match for complexity='{complexity}', subject='{subject}', modality='{modality}'.",
        }

    def _score_model(
        self,
        model: RegisteredModel,
        modality: str,
        complexity: str,
        subject: str,
        reasoning: str,
        estimated_tokens: int,
        prefs: UserPreferences,
    ) -> float:
        score = 0.5

        # Vision requirement
        if modality in ["image_text", "image_voice", "image_only"]:
            if "vision" in model.capabilities:
                score += 0.35
            else:
                return 0.05  # Severe penalty if vision missing

        # Complexity match
        if complexity in ["high", "critical"]:
            if model.model_id in ["anthropic/claude-3.5-sonnet", "openai/gpt-4o"]:
                score += 0.3
            elif model.is_fallback:
                score -= 0.15

        # Code match
        if subject == "computer_science" and "code" in model.capabilities:
            score += 0.15

        # Priority adjustments
        if prefs.priority == "cost":
            score += max(0.0, (0.01 - model.cost_per_1k_output) * 20)
        elif prefs.priority == "latency":
            score += max(0.0, (3000 - model.average_latency_ms) / 5000)

        return round(min(0.99, max(0.1, score)), 4)
