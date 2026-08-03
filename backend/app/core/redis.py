import redis
from app.core.config import settings


def get_redis_client() -> redis.Redis:

    if settings.REDIS_URL:
        return redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )

    return redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True,
    )


redis_client = get_redis_client()
