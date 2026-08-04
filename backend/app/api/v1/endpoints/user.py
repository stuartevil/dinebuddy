from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.schemas.user_schema import UserCreate, UserRead
from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.core.permission import require_roles
from app.models.user import User, UserRole
from app.services.user_service import create_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def get_current_user_profile(
    current_user: CurrentUser,
):
    """
    Get profile details of the currently authenticated user.
    """
    return current_user


@router.get("/", response_model=List[UserRead])
def list_users_endpoint(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """
    List all platform users (Superadmin only).
    """
    require_roles(current_user, (UserRole.ADMIN,))
    return db.query(User).order_by(User.id.asc()).all()


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user_endpoint(
    payload: UserCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    # Only allow ADMIN and RESTAURANT_ADMIN to hit this endpoint at all
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    return create_user(db, payload, current_user)
