"""
Alpha India - User Authentication & Identity Router
Sprint 36.5 Production Auth
Endpoints for user registration, secure login, JWT issuance, and profile inspection.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserResponse, TokenResponse

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication & Identity"],
)


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new trader / institutional user",
)
def register(
    payload: UserRegister,
    db: Session = Depends(get_db),
):
    """
    Registers a new user, hashes credentials with bcrypt, and issues an active JWT token.
    """
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    hashed_pwd = hash_password(payload.password)
    user = User(
        email=payload.email,
        hashed_password=hashed_pwd,
        full_name=payload.full_name,
        role="trader",
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role},
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate credentials and obtain JWT access token",
)
def login(
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    """
    Authenticates user with email and password, issuing an institutional JWT token.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended or inactive. Please contact support.",
        )

    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role},
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve current authenticated profile",
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the identity and roles of the currently authenticated user.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )
