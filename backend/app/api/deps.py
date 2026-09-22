"""
Alpha India - FastAPI Authentication & Authorization Dependencies
Sprint 36.5 Production Auth
Enforces JWT validation, active user checks, and RBAC across protected API endpoints.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.database import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=True,
)

oauth2_optional_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates JWT token and resolves the authenticated User.
    Raises HTTP 401 if token is expired, invalid, or user does not exist.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise credentials_exception

    try:
        uid = int(user_id)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or suspended.",
        )

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency ensuring user is active.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user account.")
    return current_user


def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    RBAC dependency requiring admin or superadmin privileges.
    """
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to access this resource.",
        )
    return current_user


def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_optional_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Resolves authenticated user if Bearer token is provided;
    otherwise returns None without raising an HTTP exception.
    Enables hybrid endpoints that support both public browsing and authenticated personalization.
    """
    if not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    try:
        uid = int(user_id)
        user = db.query(User).filter(User.id == uid, User.is_active.is_(True)).first()
        return user
    except Exception:
        return None
