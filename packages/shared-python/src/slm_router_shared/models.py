"""Pydantic models mirroring the DB schema and @slm-router/shared-types.

snake_case is used throughout to match Postgres column names and the Python
convention from rules.md §1.1.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── Enums ────────────────────────────────────────────────────────────
class Modality(str, Enum):
    IMAGE_TEXT = 'image_text'
    IMAGE_VOICE = 'image_voice'
    IMAGE_ONLY = 'image_only'
    VOICE_ONLY = 'voice_only'
    TEXT_ONLY = 'text_only'


class RequestStatus(str, Enum):
    PENDING = 'pending'
    PROCESSING = 'processing'
    ANALYZING = 'analyzing'
    ROUTING = 'routing'
    GENERATING = 'generating'
    COMPLETED = 'completed'
    FAILED = 'failed'


class ComplexityLevel(str, Enum):
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'
    CRITICAL = 'critical'


class ReasoningType(str, Enum):
    FACTUAL = 'factual'
    ANALYTICAL = 'analytical'
    CREATIVE = 'creative'
    MULTI_STEP = 'multi_step'
    COMPARATIVE = 'comparative'
    SYNTHETIC = 'synthetic'


class OutputFormat(str, Enum):
    TEXT = 'text'
    JSON = 'json'
    MARKDOWN = 'markdown'
    CODE = 'code'
    IMAGE = 'image'


class EstimatedLength(str, Enum):
    SHORT = 'short'
    MEDIUM = 'medium'
    LONG = 'long'


class UserRole(str, Enum):
    USER = 'user'
    ADMIN = 'admin'
    DEVELOPER = 'developer'


class UserTier(str, Enum):
    FREE = 'free'
    PRO = 'pro'
    ENTERPRISE = 'enterprise'


# ── Common config: accept snake_case from DB, allow population by name ─
class _OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, extra='ignore')


# ── Domain models ────────────────────────────────────────────────────
class User(_OrmModel):
    id: UUID
    email: str
    display_name: Optional[str] = None
    role: UserRole = UserRole.USER
    tier: UserTier = UserTier.FREE
    api_key: Optional[str] = None
    rate_limit_per_minute: int = 100
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None


class MediaFile(_OrmModel):
    id: UUID
    request_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    media_type: str  # 'image' | 'voice'
    original_filename: Optional[str] = None
    storage_key: str
    storage_bucket: str
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[float] = None
    sample_rate: Optional[int] = None
    checksum: Optional[str] = None
    created_at: Optional[datetime] = None


class QueryRequest(_OrmModel):
    id: UUID
    session_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    modality: Modality
    status: RequestStatus = RequestStatus.PENDING
    input_text: Optional[str] = None
    input_text_hash: Optional[str] = None
    has_image: bool = False
    has_voice: bool = False
    image_id: Optional[UUID] = None
    voice_id: Optional[UUID] = None
    estimated_complexity: Optional[ComplexityLevel] = None
    selected_model: Optional[str] = None
    response_id: Optional[UUID] = None
    latency_ms: Optional[int] = None
    cost_usd: Optional[float] = None
    error_message: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class BoundingBox(BaseModel):
    text: str
    bbox: list[int]  # x1,y1,x2,y2
    conf: float


class OcrResult(_OrmModel):
    extracted_text: Optional[str] = None
    confidence_score: Optional[float] = None
    language_detected: Optional[str] = None
    processing_time_ms: Optional[int] = None
    engine_used: Optional[str] = None
    word_count: Optional[int] = None
    bounding_boxes: Optional[list[BoundingBox]] = None
    raw_result: Optional[dict[str, Any]] = None


class SttWord(BaseModel):
    word: str
    start: float
    end: float
    conf: float
    speaker: Optional[str] = None


class SttResult(_OrmModel):
    transcript: Optional[str] = None
    confidence_score: Optional[float] = None
    language_detected: Optional[str] = None
    processing_time_ms: Optional[int] = None
    engine_used: Optional[str] = None
    word_count: Optional[int] = None
    words: Optional[list[SttWord]] = None
    speaker_labels: Optional[dict[str, Any]] = None
    raw_result: Optional[dict[str, Any]] = None


class AnalysisResult(_OrmModel):
    complexity_level: Optional[ComplexityLevel] = None
    complexity_score: Optional[float] = None
    complexity_reasoning: Optional[str] = None
    reasoning_type: Optional[ReasoningType] = None
    estimated_steps: Optional[int] = None
    requires_chain_of_thought: bool = False
    primary_subject: Optional[str] = None
    subject_confidence: Optional[float] = None
    subject_subcategories: Optional[list[str]] = None
    domain_tags: Optional[list[str]] = None
    primary_intent: Optional[str] = None
    secondary_intents: Optional[list[str]] = None
    entities: Optional[dict[str, Any]] = None
    query_reformulation: Optional[str] = None
    output_format: Optional[OutputFormat] = None
    estimated_length: Optional[EstimatedLength] = None
    special_requirements: Optional[list[str]] = None
    system_instruction_profile_id: Optional[UUID] = None
    analysis_time_ms: Optional[int] = None
    raw_analysis: Optional[dict[str, Any]] = None


class ModelConfig(_OrmModel):
    model_id: str
    provider: str = 'openrouter'
    display_name: Optional[str] = None
    description: Optional[str] = None
    capabilities: list[str] = Field(default_factory=list)
    max_tokens: Optional[int] = None
    context_window: Optional[int] = None
    cost_per_1k_input: float = 0.0
    cost_per_1k_output: float = 0.0
    average_latency_ms: Optional[int] = None
    is_active: bool = True
    is_fallback: bool = False
    priority: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)


class RoutingDecision(_OrmModel):
    selected_model_id: str
    provider: str = 'openrouter'
    confidence: Optional[float] = None
    estimated_cost: Optional[float] = None
    estimated_latency_ms: Optional[int] = None
    actual_cost: Optional[float] = None
    actual_latency_ms: Optional[int] = None
    fallback_used: bool = False
    fallback_chain: Optional[list[str]] = None
    routing_reason: Optional[str] = None
    system_instruction_profile_id: Optional[UUID] = None


class SystemInstructionProfile(_OrmModel):
    id: Optional[UUID] = None
    title: str
    instructions: str
    temperature: float = 0.7
    thinking_mode: bool = False
    thinking_budget: int = 0
    structured_outputs: bool = False
    code_execution: bool = False
    function_calling: bool = False
    grounding_google_search: bool = False
    grounding_google_maps: bool = False
    url_context: bool = False
    applicable_modalities: Optional[list[str]] = None
    applicable_subjects: Optional[list[str]] = None
    applicable_complexity_levels: Optional[list[str]] = None
    is_default: bool = False
    is_active: bool = True
    priority: int = 0


# ── Analysis bundle (analysis-engine → router-service contract) ──────
class ComplexityAnalysis(BaseModel):
    level: ComplexityLevel
    score: float = Field(ge=0.0, le=1.0)
    reasoning: str
    estimated_steps: int
    requires_chain_of_thought: bool


class SubjectClassification(BaseModel):
    primary: str
    confidence: float = Field(ge=0.0, le=1.0)
    subcategories: list[str] = Field(default_factory=list)
    domain_tags: list[str] = Field(default_factory=list)


class ReasoningAssessment(BaseModel):
    type: ReasoningType
    estimated_steps: int
    requires_chain_of_thought: bool
    key_skills: list[str] = Field(default_factory=list)


class IntentExtraction(BaseModel):
    primary_intent: str
    secondary_intents: list[str] = Field(default_factory=list)
    entities: list[dict[str, str]] = Field(default_factory=list)
    query_reformulation: str


class OutputRequirements(BaseModel):
    format: OutputFormat = OutputFormat.MARKDOWN
    length_estimate: EstimatedLength = EstimatedLength.MEDIUM
    special_requirements: list[str] = Field(default_factory=list)


class AnalysisBundle(BaseModel):
    """The full analysis output passed from analysis-engine to router-service."""

    modality: Modality
    complexity: ComplexityAnalysis
    subject: SubjectClassification
    reasoning: ReasoningAssessment
    intent: IntentExtraction
    output_requirements: OutputRequirements
    system_instruction_profile_id: Optional[UUID] = None
    analysis_time_ms: int = 0
