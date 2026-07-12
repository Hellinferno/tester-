"""Standard error codes + Problem Details helpers (RFC 7807, rules.md §2.2/§8)."""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base app error carrying an error code and HTTP status."""

    code: str = 'INTERNAL_ERROR'
    status: int = 500
    message: str = 'Internal error'

    def __init__(self, message: str | None = None, *, details: dict[str, Any] | None = None):
        self.message = message or self.__class__.message
        self.details = details or {}
        super().__init__(self.message)


class InvalidModalityError(AppError):
    code = 'INVALID_MODALITY'
    status = 400


class MissingMediaError(AppError):
    code = 'MISSING_MEDIA'
    status = 400


class MissingTextError(AppError):
    code = 'MISSING_TEXT'
    status = 400


class FileTooLargeError(AppError):
    code = 'FILE_TOO_LARGE'
    status = 413


class UnsupportedFormatError(AppError):
    code = 'UNSUPPORTED_FORMAT'
    status = 415


class RateLimitExceededError(AppError):
    code = 'RATE_LIMIT_EXCEEDED'
    status = 429


class UnauthorizedError(AppError):
    code = 'UNAUTHORIZED'
    status = 401


class ModelUnavailableError(AppError):
    code = 'MODEL_UNAVAILABLE'
    status = 503


class OcrFailedError(AppError):
    code = 'OCR_FAILED'
    status = 422


class SttFailedError(AppError):
    code = 'STT_FAILED'
    status = 422


class RoutingError(AppError):
    code = 'ROUTING_ERROR'
    status = 500


class OpenRouterError(AppError):
    code = 'OPENROUTER_ERROR'
    status = 502


class AnalysisFailedError(AppError):
    code = 'ANALYSIS_FAILED'
    status = 500


def problem_detail(err: AppError, request_id: str) -> dict[str, Any]:
    """Build the API error envelope (06-api-contracts.md §4.2)."""
    from datetime import datetime, timezone

    return {
        'error': {
            'code': err.code,
            'message': err.message,
            'details': err.details,
            'request_id': request_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }
    }
