"""Redis / Upstash client wrapper.

Uses the URL-based client for local Docker Redis, and the REST client when
Upstash REST env vars are set (Vercel serverless friendly).
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Optional

import redis

from slm_router_shared.settings import get_settings


@lru_cache(maxsize=1)
def get_redis() -> redis.Redis:
    s = get_settings()
    return redis.from_url(s.redis_url, decode_responses=True)


def cache_get(key: str, *, r: Optional[redis.Redis] = None) -> Optional[Any]:
    """Get + JSON-decode a cached value, or None on miss."""
    r = r or get_redis()
    raw = r.get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


def cache_set(key: str, value: Any, ttl_seconds: int, *, r: Optional[redis.Redis] = None) -> None:
    """JSON-encode and set a value with TTL."""
    r = r or get_redis()
    r.setex(key, ttl_seconds, json.dumps(value, default=str))


def rate_limit_hit(key: str, limit: int, window_seconds: int = 60, *, r: Optional[redis.Redis] = None) -> bool:
    """Increment a sliding counter. Returns True if the limit is exceeded."""
    r = r or get_redis()
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, window_seconds, nx=True)
    count, _ = pipe.execute()
    return int(count) > limit
