from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import add_audit, current_user
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    token_hash,
    verify_password,
)
from app.db.session import get_db
from app.models import RefreshSession, User
from app.schemas.api import LoginInput, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
_REFRESH_COOKIE = "mediflow_refresh"


def _set_refresh_cookie(response: Response, value: str, max_age: int) -> None:
    response.set_cookie(
        _REFRESH_COOKIE,
        value,
        max_age=max_age,
        httponly=True,
        secure=get_settings().app_env.lower() == "production",
        samesite="lax",
        path="/api/auth",
    )


def _issue_session(db: Session, user: User) -> tuple[str, int, str, int]:
    settings = get_settings()
    access_token, access_ttl = create_access_token(user.id, user.role.value)
    expiry = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days)
    session_id = uuid4()
    refresh_token = create_refresh_token(user.id, session_id, expiry)
    db.add(
        RefreshSession(
            id=session_id,
            user_id=user.id,
            token_hash=token_hash(refresh_token),
            expires_at=expiry,
        )
    )
    return access_token, access_ttl, refresh_token, settings.refresh_token_days * 24 * 60 * 60


@router.post("/login", response_model=TokenOut)
def login(payload: LoginInput, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    access_token, access_ttl, refresh_token, refresh_ttl = _issue_session(db, user)
    add_audit(db, user.id, "auth.login", "user", user.id)
    db.commit()
    _set_refresh_cookie(response, refresh_token, refresh_ttl)
    return TokenOut(
        access_token=access_token,
        expires_in=access_ttl,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenOut)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    token = request.cookies.get(_REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session required.")
    try:
        claims = decode_token(token)
        if claims.get("type") != "refresh":
            raise ValueError("wrong token type")
        user_id, session_id = UUID(claims["sub"]), UUID(claims["sid"])
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh session.") from None

    session = db.scalar(
        select(RefreshSession).where(
            RefreshSession.id == session_id,
            RefreshSession.user_id == user_id,
            RefreshSession.token_hash == token_hash(token),
            RefreshSession.revoked_at.is_(None),
            RefreshSession.expires_at > datetime.now(timezone.utc),
        )
    )
    user = db.scalar(select(User).where(User.id == user_id, User.is_active.is_(True)))
    if session is None or user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session expired or revoked.")

    session.revoked_at = datetime.now(timezone.utc)
    access_token, access_ttl, new_refresh, refresh_ttl = _issue_session(db, user)
    db.commit()
    _set_refresh_cookie(response, new_refresh, refresh_ttl)
    return TokenOut(
        access_token=access_token,
        expires_in=access_ttl,
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> Response:
    token = request.cookies.get(_REFRESH_COOKIE)
    if token:
        try:
            claims = decode_token(token)
            session_id = UUID(claims["sid"])
            session = db.get(RefreshSession, session_id)
            if session and session.token_hash == token_hash(token) and session.revoked_at is None:
                session.revoked_at = datetime.now(timezone.utc)
                add_audit(db, session.user_id, "auth.logout", "user", session.user_id)
                db.commit()
        except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
            db.rollback()
    response.delete_cookie(_REFRESH_COOKIE, path="/api/auth", httponly=True, samesite="lax")
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut.model_validate(user)
