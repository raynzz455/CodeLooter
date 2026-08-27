"""App config — baca dari env var.

PENTING: semua secret diambil dari env var, JANGAN hardcode di sini.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ─── Supabase ───
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""  # server-only, bypass RLS untuk write

    # ─── JWT ───
    jwt_secret: str = "change-me-in-production-min-32-chars-please"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 hari

    # ─── CORS ───
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # Tambahkan URL Vercel Anda di env production:
        # https://codelooter.vercel.app
    ]

    # ─── File upload ───
    max_upload_mb: int = 50

    model_config = SettingsConfigDict(env_file=".env", env_prefix="CL_")  # CL_SUPABASE_URL, dll


settings = Settings()
