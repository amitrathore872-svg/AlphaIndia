"""
Alpha India - Resilient Redis & Hybrid Async Cache
Sprint 39 — Velocity Burst Elite Infrastructure
Provides sub-millisecond caching via Redis (redis-py async client)
with transparent in-memory TTL fallback when Redis is offline.
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from typing import Any, Callable, Dict, Optional, Tuple, TypeVar, Union
from functools import wraps

try:
    import redis.asyncio as aioredis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

from app.core.config import settings

logger = logging.getLogger("alpha_india.redis_cache")
T = TypeVar("T")


class InMemoryFallbackCache:
    """Thread-safe and async-safe local memory cache with TTL eviction."""

    def __init__(self):
        self._store: Dict[str, Tuple[float, str]] = {}
        self._lock = asyncio.Lock()
        self._sync_lock = threading.RLock()

    async def get(self, key: str) -> Optional[str]:
        with self._sync_lock:
            if key not in self._store:
                return None
            expiry, val = self._store[key]
            if time.time() > expiry:
                del self._store[key]
                return None
            return val

    async def set(self, key: str, value: str, ex: int = 300) -> bool:
        with self._sync_lock:
            self._store[key] = (time.time() + ex, value)
            if len(self._store) > 5000:
                now = time.time()
                keys_to_del = [k for k, (exp, _) in self._store.items() if now > exp]
                for k in keys_to_del:
                    self._store.pop(k, None)
            return True

    def get_sync(self, key: str) -> Optional[str]:
        with self._sync_lock:
            if key not in self._store:
                return None
            expiry, val = self._store[key]
            if time.time() > expiry:
                del self._store[key]
                return None
            return val

    def set_sync(self, key: str, value: str, ex: int = 300) -> bool:
        with self._sync_lock:
            self._store[key] = (time.time() + ex, value)
            if len(self._store) > 5000:
                now = time.time()
                keys_to_del = [k for k, (exp, _) in self._store.items() if now > exp]
                for k in keys_to_del:
                    self._store.pop(k, None)
            return True

    async def delete(self, key: str) -> bool:
        with self._sync_lock:
            return self._store.pop(key, None) is not None

    def delete_sync(self, key: str) -> bool:
        with self._sync_lock:
            return self._store.pop(key, None) is not None

    async def clear_prefix(self, prefix: str) -> int:
        with self._sync_lock:
            matching = [k for k in self._store.keys() if k.startswith(prefix)]
            for k in matching:
                del self._store[k]
            return len(matching)

    def clear_prefix_sync(self, prefix: str) -> int:
        with self._sync_lock:
            matching = [k for k in self._store.keys() if k.startswith(prefix)]
            for k in matching:
                del self._store[k]
            return len(matching)


class VelocityCacheManager:
    """
    Institutional Caching Engine.
    Attempts connection to Redis. If Redis is unreachable or fails,
    seamlessly routes queries through the high-performance local memory fallback.
    """

    def __init__(self):
        self._redis_client: Optional[Any] = None
        self._is_redis_available = False
        self._local_cache = InMemoryFallbackCache()
        self._connect_lock = asyncio.Lock()
        self._last_connect_attempt = 0.0

    async def _get_redis(self):
        if not HAS_REDIS:
            return None

        now = time.time()
        # Avoid retrying connection too aggressively (every 30 seconds max if down)
        if self._redis_client is None and (now - self._last_connect_attempt > 30):
            async with self._connect_lock:
                if self._redis_client is None:
                    self._last_connect_attempt = now
                    try:
                        client = aioredis.from_url(
                            settings.REDIS_URL,
                            decode_responses=True,
                            socket_connect_timeout=1.5,
                            socket_timeout=2.0,
                        )
                        await client.ping()
                        self._redis_client = client
                        self._is_redis_available = True
                        logger.info(f"[RedisCache] Successfully connected to Redis at {settings.REDIS_URL}")
                    except Exception as e:
                        self._is_redis_available = False
                        self._redis_client = None
                        logger.debug(f"[RedisCache] Redis not available, using in-memory fallback: {e}")
        return self._redis_client if self._is_redis_available else None

    async def get(self, key: str) -> Optional[str]:
        client = await self._get_redis()
        if client:
            try:
                return await client.get(key)
            except Exception as e:
                logger.debug(f"[RedisCache] Redis get failed for key '{key}', trying memory cache: {e}")
                self._is_redis_available = False
        return await self._local_cache.get(key)

    async def set(self, key: str, value: str, expire_seconds: int = 300) -> bool:
        client = await self._get_redis()
        if client:
            try:
                await client.set(key, value, ex=expire_seconds)
                # Keep local in sync for instant zero-roundtrip reads
                await self._local_cache.set(key, value, ex=expire_seconds)
                return True
            except Exception as e:
                logger.debug(f"[RedisCache] Redis set failed: {e}")
                self._is_redis_available = False
        return await self._local_cache.set(key, value, ex=expire_seconds)

    async def get_json(self, key: str) -> Optional[Any]:
        raw = await self.get(key)
        if raw is not None:
            try:
                return json.loads(raw)
            except Exception:
                return None
        return None

    async def set_json(self, key: str, data: Any, expire_seconds: int = 300) -> bool:
        try:
            serialized = json.dumps(data, default=str)
            return await self.set(key, serialized, expire_seconds=expire_seconds)
        except Exception as e:
            logger.error(f"[RedisCache] Failed to JSON serialize key '{key}': {e}")
            return False

    async def delete(self, key: str) -> bool:
        client = await self._get_redis()
        if client:
            try:
                await client.delete(key)
            except Exception:
                pass
        return await self._local_cache.delete(key)

    async def clear_prefix(self, prefix: str) -> int:
        count = 0
        client = await self._get_redis()
        if client:
            try:
                keys = await client.keys(f"{prefix}*")
                if keys:
                    count = await client.delete(*keys)
            except Exception:
                pass
        local_count = await self._local_cache.clear_prefix(prefix)
        return max(count, local_count)

    def clear_prefix_sync(self, prefix: str) -> int:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(self.clear_prefix(prefix), loop)
            else:
                return loop.run_until_complete(self.clear_prefix(prefix))
        except Exception:
            pass
        return 0

    def get_sync(self, key: str) -> Optional[str]:
        return self._local_cache.get_sync(key)

    def set_sync(self, key: str, value: str, expire_seconds: int = 300) -> bool:
        return self._local_cache.set_sync(key, value, ex=expire_seconds)

    def get_json_sync(self, key: str) -> Optional[Any]:
        raw = self.get_sync(key)
        if raw is not None:
            try:
                return json.loads(raw)
            except Exception:
                return None
        return None

    def set_json_sync(self, key: str, data: Any, expire_seconds: int = 300) -> bool:
        try:
            serialized = json.dumps(data, default=str)
            return self.set_sync(key, serialized, expire_seconds=expire_seconds)
        except Exception as e:
            logger.error(f"[RedisCache] Failed to JSON serialize key '{key}': {e}")
            return False

    def is_connected(self) -> bool:
        return self._is_redis_available


# Global singleton
cache = VelocityCacheManager()


def cached(prefix: str, ttl: int = 60):
    """
    Decorator to cache async FastAPI controller results.
    """
    def decorator(fn: Callable[..., Any]):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            # Compute cache key from prefix and sorted kwargs
            clean_kwargs = {k: v for k, v in kwargs.items() if not str(type(v)).startswith("<class 'sqlalchemy")}
            raw_key = f"{prefix}:{fn.__name__}:{json.dumps(clean_kwargs, sort_keys=True, default=str)}"
            hit = await cache.get_json(raw_key)
            if hit is not None:
                return hit
            res = await fn(*args, **kwargs)
            await cache.set_json(raw_key, res, expire_seconds=ttl)
            return res
        return wrapper
    return decorator
