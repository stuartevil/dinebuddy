import hashlib
import bcrypt


def _sha256_bytes(password: str) -> bytes:
    # sha256 hexdigest is 64 characters long, safely under bcrypt's 72-byte limit
    return hashlib.sha256(password.encode("utf-8")).hexdigest()[:72].encode("utf-8")


def hash_password(password: str) -> str:
    pwd_bytes = _sha256_bytes(password)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """Return True if password matches hash, False otherwise. Never raises for invalid input."""
    try:
        pwd_bytes = _sha256_bytes(password)
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False
