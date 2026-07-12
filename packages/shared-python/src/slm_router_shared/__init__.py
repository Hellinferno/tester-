"""Shared Python package for SLM Router services.

Exposes Pydantic models (mirroring @slm-router/shared-types), reusable clients
(Supabase, Redis, OpenRouter), structured logging, and config helpers.
"""

from slm_router_shared.models import (
    AnalysisBundle,
    AnalysisResult,
    ComplexityAnalysis,
    ComplexityLevel,
    IntentExtraction,
    MediaFile,
    ModelConfig,
    Modality,
    OutputRequirements,
    QueryRequest,
    ReasoningAssessment,
    RequestStatus,
    RoutingDecision,
    SttResult,
    SubjectClassification,
    SystemInstructionProfile,
    User,
)
from slm_router_shared.settings import Settings, get_settings

__all__ = [
    # models
    'AnalysisBundle',
    'AnalysisResult',
    'ComplexityAnalysis',
    'ComplexityLevel',
    'IntentExtraction',
    'MediaFile',
    'ModelConfig',
    'Modality',
    'OutputRequirements',
    'QueryRequest',
    'ReasoningAssessment',
    'RequestStatus',
    'RoutingDecision',
    'SttResult',
    'SubjectClassification',
    'SystemInstructionProfile',
    'User',
    # settings
    'Settings',
    'get_settings',
]
