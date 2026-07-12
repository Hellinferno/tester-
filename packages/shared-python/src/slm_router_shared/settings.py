"""Typed environment configuration via pydantic-settings.

All services import `get_settings()` to read validated env vars. Never read
os.environ directly in service code.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore',
        case_sensitive=False,
    )

    # ── Core ─────────────────────────────────────────────────────
    app_env: str = Field(default='development')
    log_level: str = Field(default='info')

    # ── Supabase ─────────────────────────────────────────────────
    supabase_url: str = Field(default='http://localhost:54321')
    supabase_anon_key: str = Field(default='')
    supabase_service_role_key: str = Field(default='')
    database_url: Optional[str] = Field(default=None)

    # ── Redis / Upstash ──────────────────────────────────────────
    redis_url: str = Field(default='redis://localhost:6379/0')
    upstash_redis_rest_url: Optional[str] = Field(default=None)
    upstash_redis_rest_token: Optional[str] = Field(default=None)

    # ── Service URLs ─────────────────────────────────────────────
    orchestrator_url: str = Field(default='http://localhost:8001')
    ocr_service_url: str = Field(default='http://localhost:8002')
    stt_service_url: str = Field(default='http://localhost:8003')
    analysis_engine_url: str = Field(default='http://localhost:8004')
    router_service_url: str = Field(default='http://localhost:8005')
    service_auth_token: str = Field(default='dev-only-change-me')

    # ── OpenRouter ───────────────────────────────────────────────
    openrouter_api_key: Optional[str] = Field(default=None)
    openrouter_api_keys: Optional[str] = Field(default=None)  # comma-separated, for rotation
    openrouter_base_url: str = Field(default='https://openrouter.ai/api/v1')
    analysis_slm_model: str = Field(default='meta-llama/llama-3.1-8b-instruct')
    openrouter_timeout_ms: int = Field(default=30_000)
    openrouter_max_retries: int = Field(default=3)

    # ── Deepgram ─────────────────────────────────────────────────
    deepgram_api_key: Optional[str] = Field(default=None)

    # ── Google grounding ─────────────────────────────────────────
    google_search_api_key: Optional[str] = Field(default=None)
    google_search_cx: Optional[str] = Field(default=None)
    google_maps_api_key: Optional[str] = Field(default=None)

    # ── Limits (PRD FR-02..04) ───────────────────────────────────
    max_image_size_bytes: int = Field(default=20 * 1024 * 1024)
    max_voice_duration_seconds: int = Field(default=300)
    max_text_length: int = Field(default=32_000)
    rate_limit_per_minute: int = Field(default=100)
    rate_limit_api_key_per_minute: int = Field(default=1000)

    # ── Storage ──────────────────────────────────────────────────
    storage_bucket_images: str = Field(default='images')
    storage_bucket_audio: str = Field(default='audio')

    # ── CORS ─────────────────────────────────────────────────────
    cors_allowed_origins: str = Field(default='http://localhost:3000')

    @property
    def openrouter_keys_list(self) -> list[str]:
        """All OpenRouter keys available for rotation."""
        keys: list[str] = []
        if self.openrouter_api_key:
            keys.append(self.openrouter_api_key)
        if self.openrouter_api_keys:
            keys.extend(k.strip() for k in self.openrouter_api_keys.split(',') if k.strip())
        return keys

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(',') if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton settings; read env once per process."""
    return Settings()
