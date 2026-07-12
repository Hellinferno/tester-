"""Clients re-exports."""
from slm_router_shared.clients.openrouter_client import OpenRouterClient, OpenRouterError
from slm_router_shared.clients.redis_client import cache_get, cache_set, get_redis, rate_limit_hit
from slm_router_shared.clients.supabase_client import (
    SupabaseConfigError,
    get_anon_client,
    get_service_client,
    insert_row,
    signed_media_url,
    update_row,
    upload_media,
)

__all__ = [
    'OpenRouterClient',
    'OpenRouterError',
    'SupabaseConfigError',
    'get_anon_client',
    'get_service_client',
    'insert_row',
    'update_row',
    'upload_media',
    'signed_media_url',
    'get_redis',
    'cache_get',
    'cache_set',
    'rate_limit_hit',
]
