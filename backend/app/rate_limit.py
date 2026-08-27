"""Rate limiting via slowapi.

Limits:
- /api/extract: 10 request/jam per IP (extract berat, OCR bisa 60+ detik)
- /api/auth/login: 5 request/menit per IP (anti brute-force)
- /api/auth/register: 3 request/jam per IP (anti spam akun)
- Default: 60 request/menit per IP
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request, Response
from fastapi.responses import JSONResponse


limiter = Limiter(key_func=get_remote_address)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Custom handler supaya response format match dengan FastAPI error style."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}. Coba lagi nanti.",
            "retry_after": getattr(exc, "retry_after", 60),
        },
        headers={
            "Retry-After": str(getattr(exc, "retry_after", 60)),
            "X-RateLimit-Limit": str(getattr(exc, "limit", "")),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": str(getattr(exc, "reset", "")),
        },
    )


def setup_rate_limiting(app):
    """Attach limiter + middleware ke FastAPI app."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
