"""CodeLooter Backend API — FastAPI main app.

Run locally: uvicorn app.main:app --reload --port 8000
Deploy to Render: render.yaml sudah konfigur
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import auth, extract, snippets


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"[CodeLooter] Starting API...")
    print(f"[CodeLooter] CORS origins: {settings.cors_origins}")
    print(f"[CodeLooter] Supabase URL: {settings.supabase_url[:40]}...")
    yield
    # Shutdown
    print("[CodeLooter] Shutting down...")


app = FastAPI(
    title="CodeLooter API",
    description="Ekstrak kode dari dokumen & manajemen snippet user",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS — Vercel FE akan panggil dari origin berbeda
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # penting supaya cookie JWT terkirim
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(extract.router, prefix="/api")
app.include_router(snippets.router, prefix="/api")


@app.get("/")
def health():
    return {
        "name": "CodeLooter API",
        "version": "0.2.0",
        "status": "ok",
        "docs": "/docs",
        "endpoints": [
            "POST /api/auth/register",
            "POST /api/auth/login",
            "GET  /api/auth/me",
            "POST /api/extract",
            "POST /api/snippets",
            "GET  /api/snippets",
            "GET  /api/snippets/{id}",
            "DELETE /api/snippets/{id}",
            "GET  /api/snippets/{id}/download?block=-1",
        ],
    }


@app.get("/health")
def health_simple():
    return {"status": "ok"}
