from fastapi import APIRouter, Depends
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.schemas.user_schema import UserLogin, Token, UserCreate
from app.services.user_service import login_user, refresh_tokens
from app.core.database import get_db
from app.core.security import hash_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    tokens = login_user(
        db,
        payload.email,
        payload.password,
    )

    return tokens


@router.post("/refresh", response_model=Token)
def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db),
):
    """
    Exchange a valid refresh token for a new access + refresh token pair.
    """

    return refresh_tokens(db, refresh_token)


@router.post("/setup-admin", status_code=status.HTTP_201_CREATED)
def create_first_admin(
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    """
    TEMPORARY ENDPOINT (DEV ONLY)

    Creates the first admin user if none exists.
    """

    # Check if any admin already exists
    existing_admin = (
        db.query(User)
        .filter(User.role == UserRole.ADMIN)
        .first()
    )

    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin already exists. Setup is locked.",
        )

    # Force role to ADMIN (ignore payload role)
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "First admin created successfully",
        "email": user.email,
    }