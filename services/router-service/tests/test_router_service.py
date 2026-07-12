from src.routing.model_router import ModelRouter, UserPreferences


def test_model_router_vision_query():
    router = ModelRouter()
    analysis = {
        "modality": "image_text",
        "complexity": {"level": "high"},
        "subject": {"primary": "computer_science"},
        "output_requirements": {"estimated_tokens": 1000},
    }
    decision = router.route(analysis)
    assert "selected_model" in decision
    assert decision["confidence"] > 0.0
    assert len(decision["fallback_chain"]) >= 1


def test_model_router_cost_priority():
    router = ModelRouter()
    analysis = {
        "modality": "text_only",
        "complexity": {"level": "low"},
        "subject": {"primary": "general_knowledge"},
        "output_requirements": {"estimated_tokens": 200},
    }
    prefs = UserPreferences(priority="cost")
    decision = router.route(analysis, prefs)
    assert decision["selected_model"] is not None
