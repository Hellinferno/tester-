"""Instruction Profile Selector per section 6 of Computation Engine Spec."""

from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4


class InstructionProfileSelector:
    """Selects the best matching system instruction profile based on query analysis."""

    def __init__(self, profiles: Optional[List[Dict[str, Any]]] = None):
        self.profiles = profiles or self._get_builtin_profiles()

    def _get_builtin_profiles(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Technical Analysis",
                "instructions": "You are an expert technical analyst. Provide structured, mathematically rigorous answers with step-by-step reasoning.",
                "configuration": {
                    "temperature": 0.3,
                    "thinking_mode": True,
                    "thinking_budget": 4000,
                    "structured_outputs": True,
                    "code_execution": True,
                    "function_calling": False,
                    "grounding_google_search": True,
                    "grounding_google_maps": False,
                    "url_context": True,
                },
                "applicable_modalities": ["image_text", "text_only"],
                "applicable_subjects": ["computer_science", "mathematics", "engineering"],
                "applicable_complexity_levels": ["high", "critical"],
                "is_default": False,
            },
            {
                "id": "660e8400-e29b-41d4-a716-446655440001",
                "title": "General Multi-Modal Assistant",
                "instructions": "You are a helpful multi-modal assistant capable of inspecting visual and audio context accurately.",
                "configuration": {
                    "temperature": 0.7,
                    "thinking_mode": False,
                    "thinking_budget": 0,
                    "structured_outputs": False,
                    "code_execution": False,
                    "function_calling": False,
                    "grounding_google_search": False,
                    "grounding_google_maps": False,
                    "url_context": False,
                },
                "applicable_modalities": ["image_text", "image_voice", "image_only", "voice_only", "text_only"],
                "applicable_subjects": ["general_knowledge", "literature", "other"],
                "applicable_complexity_levels": ["low", "medium"],
                "is_default": True,
            },
        ]

    def select(self, modality: str, subject: str, complexity: str) -> Dict[str, Any]:
        scored: List[tuple[Dict[str, Any], float]] = []
        for profile in self.profiles:
            score = 0.0
            if modality in profile.get("applicable_modalities", []):
                score += 0.4
            if subject in profile.get("applicable_subjects", []):
                score += 0.4
            if complexity in profile.get("applicable_complexity_levels", []):
                score += 0.2
            scored.append((profile, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        if scored and scored[0][1] >= 0.4:
            return scored[0][0]
        return self.get_default_profile()

    def get_default_profile(self) -> Dict[str, Any]:
        for profile in self.profiles:
            if profile.get("is_default"):
                return profile
        return self.profiles[0] if self.profiles else {}
