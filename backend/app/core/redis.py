# backend/app/core/redis.py
import redis.asyncio as aioredis
from app.core.config import get_settings

_pool = None


async def get_redis() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(
            get_settings().redis_url,
            decode_responses=True,
            max_connections=20,
        )
    return _pool


async def close_redis():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
