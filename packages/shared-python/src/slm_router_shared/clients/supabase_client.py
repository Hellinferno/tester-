"""Reusable Supabase client (Postgres + Storage + Auth).

Services use the service-role client for privileged operations (inserting OCR/STT/
analysis rows, reading media) and the anon client only when impersonating a user.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from supabase import Client, create_client

from slm_router_shared.settings import get_settings


class SupabaseConfigError(RuntimeError):
    """Raised when Supabase env vars are missing."""


@lru_cache(maxsize=1)
def get_service_client() -> Client:
    """Privileged client using the service-role key. Bypasses RLS. Service use only."""
    s = get_settings()
    if not s.supabase_service_role_key:
        raise SupabaseConfigError('SUPABASE_SERVICE_ROLE_KEY is not set')
    return create_client(s.supabase_url, s.supabase_service_role_key)


@lru_cache(maxsize=1)
def get_anon_client() -> Client:
    """Client using the anon key. Subject to RLS. Used to impersonate users."""
    s = get_settings()
    if not s.supabase_anon_key:
        raise SupabaseConfigError('SUPABASE_ANON_KEY is not set')
    return create_client(s.supabase_url, s.supabase_anon_key)


def upload_media(
    bucket: str,
    key: str,
    data: bytes,
    mime_type: str,
    *,
    client: Client | None = None,
) -> str:
    """Upload bytes to a storage bucket, return the storage key."""
    client = client or get_service_client()
    client.storage.from_(bucket).upload(path=key, file=data, file_options={'content-type': mime_type})
    return key


def signed_media_url(bucket: str, key: str, *, expires_in: int = 300, client: Client | None = None) -> str:
    """Generate a time-limited signed URL for a private object."""
    client = client or get_service_client()
    return client.storage.from_(bucket).create_signed_url(key, expires_in)['signedURL']


def insert_row(table: str, row: dict[str, Any], *, client: Client | None = None) -> dict[str, Any]:
    """Insert one row and return it."""
    client = client or get_service_client()
    resp = client.table(table).insert(row).execute()
    return resp.data[0] if resp.data else {}


def update_row(
    table: str, row_id: str, patch: dict[str, Any], *, pk: str = 'id', client: Client | None = None
) -> dict[str, Any]:
    client = client or get_service_client()
    resp = client.table(table).update(patch).eq(pk, row_id).execute()
    return resp.data[0] if resp.data else {}
