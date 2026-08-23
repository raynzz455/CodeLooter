"""Auth router: register, login, me.

Kita pakai kombinasi Supabase Auth (untuk tabel auth.users managed) +
JWT sendiri (untuk BE-FE session). Ini karena:
- Supabase Auth handle password hashing & user management bawaan
- Tapi JWT Supabase expired cepat (1 jam), dan kita mau session 7 hari
- Jadi login = panggil Supabase Auth → dapat session → buat JWT sendiri

Untuk simplicity V1, kita bisa skip Supabase Auth dan kelola tabel
`users` sendiri di schema public. Tapi tidak ada RLS otomatis.
Schema SQL sudah handle ini via tabel `public.profiles`.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from supabase import Client
from ..auth import hash_password, verify_password, create_access_token, decode_access_token
from ..supabase_client import get_supabase, get_supabase_admin
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

# ─── Dependency: extract user_id from Bearer token ───
# Harus didefinisikan SEBELUM dipakai di endpoint `me`.
_bearer = HTTPBearer(auto_error=False)


def get_current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Extract user_id dari Authorization: Bearer <jwt>.

    Dipakai sebagai dependency di endpoint yang butuh auth.
    """
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(creds.credentials)
    return payload["sub"]


# ─── Schemas ───
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=100)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None = None


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── Routes ───
@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn):
    """Register user baru. Password di-hash bcrypt dan disimpan ke Supabase."""
    admin = get_supabase_admin()

    # Cek apakah email sudah terpakai
    existing = admin.table("profiles").select("id").eq("email", payload.email.lower()).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar. Silakan login."
        )

    # Insert user baru
    hashed = hash_password(payload.password)
    result = admin.table("profiles").insert({
        "email": payload.email.lower(),
        "password_hash": hashed,
        "name": payload.name,
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal mendaftarkan user"
        )

    user = result.data[0]
    token = create_access_token(subject=user["id"], email=user["email"], extra_claims={"name": user.get("name")})
    return AuthOut(
        access_token=token,
        user=UserOut(id=user["id"], email=user["email"], name=user.get("name"))
    )


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn):
    """Login user. Verifikasi password, lalu issue JWT."""
    admin = get_supabase_admin()
    result = admin.table("profiles").select("*").eq("email", payload.email.lower()).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah"
        )

    user = result.data[0]
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah"
        )

    token = create_access_token(subject=user["id"], email=user["email"], extra_claims={"name": user.get("name")})
    return AuthOut(
        access_token=token,
        user=UserOut(id=user["id"], email=user["email"], name=user.get("name"))
    )


@router.get("/me", response_model=UserOut)
def me(user_id: str = Depends(get_current_user_id)):
    """Get current user profile."""
    admin = get_supabase_admin()
    result = admin.table("profiles").select("id,email,name").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    u = result.data[0]
    return UserOut(**u)
