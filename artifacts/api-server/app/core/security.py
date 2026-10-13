import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import get_settings

_password_hasher = PasswordHasher()
_JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (InvalidHashError, VerificationError, VerifyMismatchError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(user_id: UUID, role: str) -> tuple[str, int]:
    settings = get_settings()
    ttl = settings.access_token_minutes * 60
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"sub": str(user_id), "role": role, "type": "access", "iat": now, "exp": now + timedelta(seconds=ttl)},
        settings.jwt_secret,
        algorithm=_JWT_ALGORITHM,
    )
    return token, ttl


def create_refresh_token(user_id: UUID, session_id: UUID, expires_at: datetime) -> str:
    settings = get_settings()
    return jwt.encode(
        {
            "sub": str(user_id),
            "sid": str(session_id),
            "type": "refresh",
            "nonce": secrets.token_urlsafe(16),
            "iat": datetime.now(timezone.utc),
            "exp": expires_at,
        },
        settings.jwt_secret,
        algorithm=_JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, get_settings().jwt_secret, algorithms=[_JWT_ALGORITHM])
