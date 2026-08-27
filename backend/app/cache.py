"""Cache untuk extract result pakai Redis (kalau tersedia) atau in-memory fallback.

Cache key: hash dari file content. Kalau user extract file yang sama 2x,
langsung return dari cache, tidak perlu panggil sidecar lagi.

Cache TTL: 24 jam (file tidak akan berubah, tapi jangan cache selamanya
supaya tidak penuh memory).
"""
import os
import json
import hashlib
import time
from typing import Any, Optional

# Coba import redis, fallback ke in-memory kalau tidak ada
try:
    import redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False


# In-memory cache (fallback kalau Redis tidak terkonfigurasi)
# Format: {cache_key: {"data": ..., "expires": timestamp}}
_memory_cache: dict[str, dict] = {}
_MEMORY_TTL = 24 * 60 * 60  # 24 jam dalam detik
_MAX_MEMORY_ENTRIES = 100  # limit supaya memory tidak bengkak


# Redis client (lazy init)
_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is None:
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        try:
            _redis_client = redis.from_url(redis_url, decode_responses=True)
            _redis_client.ping()  # test koneksi
        except Exception:
            _redis_client = None  # fallback ke memory
    return _redis_client


def _hash_file(content: bytes) -> str:
    """SHA256 hash dari file content, dipakai sebagai cache key."""
    return hashlib.sha256(content).hexdigest()


def get_cached(content: bytes) -> Optional[dict]:
    """Ambil hasil extract dari cache. Return None kalau tidak ada/expired."""
    key = _hash_file(content)

    # Coba Redis dulu
    if HAS_REDIS:
        r = _get_redis()
        if r is not None:
            try:
                cached = r.get(f"extract:{key}")
                if cached:
                    return json.loads(cached)
            except Exception:
                pass  # fallback ke memory

    # Fallback ke memory
    entry = _memory_cache.get(key)
    if entry is None:
        return None
    if time.time() > entry["expires"]:
        # expired, hapus
        _memory_cache.pop(key, None)
        return None
    return entry["data"]


def set_cached(content: bytes, data: dict) -> None:
    """Simpan hasil extract ke cache."""
    key = _hash_file(content)

    # Coba Redis dulu
    if HAS_REDIS:
        r = _get_redis()
        if r is not None:
            try:
                r.setex(f"extract:{key}", _MEMORY_TTL, json.dumps(data))
                return
            except Exception:
                pass  # fallback ke memory

    # Fallback ke memory
    # Evict kalau cache penuh
    if len(_memory_cache) >= _MAX_MEMORY_ENTRIES:
        # Hapus yang paling lama expires
        oldest_key = min(_memory_cache.keys(), key=lambda k: _memory_cache[k]["expires"])
        _memory_cache.pop(oldest_key, None)

    _memory_cache[key] = {
        "data": data,
        "expires": time.time() + _MEMORY_TTL,
    }


def clear_cache() -> int:
    """Hapus semua cache. Return jumlah entry yang dihapus."""
    count = 0

    if HAS_REDIS:
        r = _get_redis()
        if r is not None:
            try:
                keys = r.keys("extract:*")
                if keys:
                    r.delete(*keys)
                    count = len(keys)
            except Exception:
                pass

    count += len(_memory_cache)
    _memory_cache.clear()

    return count


def get_cache_stats() -> dict:
    """Stats cache untuk debugging."""
    if HAS_REDIS:
        r = _get_redis()
        if r is not None:
            try:
                keys = r.keys("extract:*")
                return {
                    "backend": "redis",
                    "entries": len(keys),
                    "ttl_seconds": _MEMORY_TTL,
                }
            except Exception:
                pass

    return {
        "backend": "memory",
        "entries": len(_memory_cache),
        "max_entries": _MAX_MEMORY_ENTRIES,
        "ttl_seconds": _MEMORY_TTL,
    }
