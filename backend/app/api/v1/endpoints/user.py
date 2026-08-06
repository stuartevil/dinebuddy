from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.schemas.user_schema import UserCreate, UserRead, UserStatusUpdate
from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.core.permission import require_roles
from app.models.user import User, UserRole
from app.services.user_service import (
    create_user,
    get_users_for_caller,
    update_user_status,
    delete_user_staff,
)

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
    restaurant_id: Optional[int] = Query(None, description="Optional restaurant ID filter"),
    db: Session = Depends(get_db),
):
    """
    List platform users (Superadmin sees all or filtered by restaurant; Restaurant Admin sees only staff of their restaurant).
    """
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    return get_users_for_caller(db, current_user, restaurant_id)


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user_endpoint(
    payload: UserCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    # Only allow ADMIN and RESTAURANT_ADMIN to create users/staff
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    return create_user(db, payload, current_user)


@router.patch("/{user_id}/status", response_model=UserRead)
def update_user_status_endpoint(
    user_id: int,
    payload: UserStatusUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Toggle active/inactive status of a staff member."""
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    return update_user_status(db, user_id, payload.is_active, current_user)


@router.delete("/{user_id}")
def delete_user_endpoint(
    user_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Delete a staff member."""
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    return delete_user_staff(db, user_id, current_user)
