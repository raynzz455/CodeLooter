"""JWT helpers + password hashing (Passlib bcrypt).

Strategi auth:
- Register: simpan email+password hash ke tabel `auth.users` via Supabase Auth
  (Supabase punya endpoint /auth/v1/signup bawaan, tapi kita juga bisa
  simpan manual kalau mau kontrol penuh)
- Login: verifikasi password → buat JWT (sign dengan CL_JWT_SECRET)
- Verify: setiap request protected, parse Bearer token, cek JWT valid
- User identity: JWT payload berisi {sub: user_id, email: ...}
"""
from datetime import datetime, timedelta, timezone
from typing import Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from .config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(subject: str, email: str, extra_claims: dict | None = None) -> str:
    """Buat JWT untuk user. `subject` = user_id dari Supabase auth.users.id."""
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,        # user_id (uuid)
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
        "iss": "codelooter-api",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Decode + verify JWT. Raise HTTPException 401 kalau invalid."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_iss": True},
        )
        if payload.get("iss") != "codelooter-api":
            raise JWTError("Invalid issuer")
        if not payload.get("sub"):
            raise JWTError("Missing subject")
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
