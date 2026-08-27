"""Supabase client — singleton lazy-initialized."""
from supabase import create_client, Client
from .config import settings

_client: Client | None = None
_admin_client: Client | None = None


def get_supabase() -> Client:
    """Anon client — mengikuti RLS (Row Level Security) Supabase.
    Pakai anon key untuk operasi baca public + operasi user-scope (dengan token user).
    """
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_anon_key)
    return _client


def get_supabase_admin() -> Client:
    """Service-role client — bypass RLS. HANYA untuk operasi server-side yang
    butuh write tabel public.* (mis. insert snippet atas nama user tertentu).

    Penting: jangan pernah expose service-role key ke client!
    """
    global _admin_client
    if _admin_client is None:
        if not settings.supabase_service_role_key:
            raise RuntimeError("CL_SUPABASE_SERVICE_ROLE_KEY not set")
        _admin_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _admin_client
