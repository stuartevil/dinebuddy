from datetime import datetime, timedelta
from typing import Optional

from jose import jwt, JWTError
from app.core.config import settings
# from env import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS  # type: ignore


# ======================================================
# Create Tokens
# ======================================================
def _create_token(
    data: dict,
    expires_delta: timedelta,
) -> str:
    to_encode = data.copy()
    expire = datetime.now() + expires_delta
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return encoded_jwt


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:

    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    # Mark token type for clarity (optional but useful)
    data = {**data, "type": "access"}
    return _create_token(data, expires_delta)


def create_refresh_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:

    if expires_delta is None:
        expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    data = {**data, "type": "refresh"}
    return _create_token(data, expires_delta)


# ======================================================
# Decode Token (access or refresh)
# ======================================================
def decode_access_token(token: str) -> dict | None:

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload

    except JWTError:
        return None
