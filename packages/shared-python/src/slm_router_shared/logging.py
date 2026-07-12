"""Structured JSON logging via structlog (rules.md §9.1)."""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog


def configure_logging(level: str = 'info', service: str = 'slm-router') -> structlog.stdlib.BoundLogger:
    """Configure structlog once at process start. Returns a bound logger."""
    log_level = getattr(logging, level.upper(), logging.INFO)

    # Shared timestamper + processors
    processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt='iso'),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    # JSON in production, pretty console otherwise.
    if level.lower() == 'debug':
        processors.append(structlog.dev.ConsoleRenderer(colors=True))
    else:
        processors.append(structlog.processors.JSONRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )

    # Bridge stdlib logging so uvicorn/httpx logs flow through structlog
    logging.basicConfig(level=log_level, stream=sys.stderr, format='%(message)s')

    return structlog.get_logger(service)


def get_logger(service: str = 'slm-router') -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(service)
