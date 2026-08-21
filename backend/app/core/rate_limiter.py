"""
Lightweight In-Memory Rate Limiter for FastAPI
---------------------------------------------
Zero external dependencies (uses standard library time & collections).
Protects sensitive endpoints against brute-force attacks and request flooding.
Compatible with AWS EC2, Docker, and local development.
"""
import time
from collections import defaultdict
from threading import Lock
from typing import Callable
from fastapi import Request, HTTPException, status


class InMemoryRateLimiter:
    """
    Sliding window rate limiter per client IP.
    Automatically purges expired timestamps to avoid memory leaks.
    """

    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._records = defaultdict(list)
        self._lock = Lock()
        self._last_cleanup = time.time()

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _cleanup_old_records(self, now: float) -> None:
        """Periodic cleanup every 5 minutes to reclaim memory."""
        if now - self._last_cleanup > 300:
            threshold = now - self.window_seconds
            keys_to_delete = []
            for ip, timestamps in list(self._records.items()):
                valid_timestamps = [t for t in timestamps if t > threshold]
                if valid_timestamps:
                    self._records[ip] = valid_timestamps
                else:
                    keys_to_delete.append(ip)
            for k in keys_to_delete:
                self._records.pop(k, None)
            self._last_cleanup = now

    def __call__(self, request: Request) -> None:
        now = time.time()
        client_ip = self._get_client_ip(request)
        threshold = now - self.window_seconds

        with self._lock:
            self._cleanup_old_records(now)
            timestamps = self._records[client_ip]
            # Keep only timestamps within the current window
            timestamps = [t for t in timestamps if t > threshold]
            
            if len(timestamps) >= self.max_requests:
                retry_after = int(self.window_seconds - (now - timestamps[0]))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many requests. Please try again in {max(1, retry_after)} seconds.",
                    headers={"Retry-After": str(max(1, retry_after))}
                )

            timestamps.append(now)
            self._records[client_ip] = timestamps


# Pre-configured rate limiters for sensitive endpoints
login_rate_limiter = InMemoryRateLimiter(max_requests=15, window_seconds=60)  # 15 attempts / min
public_order_rate_limiter = InMemoryRateLimiter(max_requests=30, window_seconds=60)  # 30 orders / min
