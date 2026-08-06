from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.models.user_restaurant_map import UserRestaurant
from app.schemas.user_schema import UserCreate
from app.core.security import hash_password
from app.core.security import verify_password
from app.core.jwt import create_access_token, create_refresh_token, decode_access_token


def create_user(db: Session, payload: UserCreate, current_user: User) -> User:
    target_restaurant_id = None

    if current_user.is_admin:
        # Admin can create any role and optionally specify target restaurant_id
        target_restaurant_id = payload.restaurant_id
    elif current_user.is_restaurant_admin:
        if payload.role != UserRole.RESTAURANT_STAFF:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Restaurant admins can only create staff users",
            )
        # Find restaurant(s) of current restaurant admin
        admin_map = db.query(UserRestaurant).filter(UserRestaurant.user_id == current_user.id).first()
        if not admin_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Restaurant admin is not associated with any active restaurant",
            )
        target_restaurant_id = payload.restaurant_id or admin_map.restaurant_id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create users",
        )

    # ---------- Uniqueness checks ----------
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
        
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
        is_verified=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Map user to restaurant strictly if target_restaurant_id is available
    if target_restaurant_id:
        existing_map = db.query(UserRestaurant).filter(
            UserRestaurant.user_id == user.id,
            UserRestaurant.restaurant_id == target_restaurant_id,
        ).first()
        if not existing_map:
            mapping = UserRestaurant(
                user_id=user.id,
                restaurant_id=target_restaurant_id,
            )
            db.add(mapping)
            db.commit()

    return user


def get_users_for_caller(
    db: Session,
    current_user: User,
    restaurant_id: Optional[int] = None,
) -> List[User]:
    """
    Returns users isolated per caller:
    - Superadmin: sees all users or filtered by restaurant_id
    - Restaurant Admin: sees only staff associated with their restaurant(s)
    """
    if current_user.is_admin:
        if restaurant_id:
            staff_ids = [
                r[0] for r in db.query(UserRestaurant.user_id).filter(
                    UserRestaurant.restaurant_id == restaurant_id
                ).all()
            ]
            return db.query(User).filter(User.id.in_(staff_ids)).order_by(User.id.asc()).all()
        return db.query(User).order_by(User.id.asc()).all()

    if current_user.is_restaurant_admin:
        # Get all restaurant IDs belonging to this admin
        admin_rest_ids = [
            r[0] for r in db.query(UserRestaurant.restaurant_id).filter(
                UserRestaurant.user_id == current_user.id
            ).all()
        ]
        if not admin_rest_ids:
            return []

        target_rest_id = restaurant_id if (restaurant_id and restaurant_id in admin_rest_ids) else admin_rest_ids[0]
        
        staff_user_ids = [
            r[0] for r in db.query(UserRestaurant.user_id).filter(
                UserRestaurant.restaurant_id == target_rest_id
            ).all()
        ]
        
        # Include current_user and mapped staff users only
        allowed_ids = set(staff_user_ids)
        allowed_ids.add(current_user.id)
        
        return db.query(User).filter(User.id.in_(list(allowed_ids))).order_by(User.id.asc()).all()

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to view staff users",
    )


def update_user_status(
    db: Session,
    user_id: int,
    is_active: bool,
    current_user: User,
) -> User:
    """Update active/inactive status of a staff member."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User ID {user_id} not found",
        )

    if not current_user.is_admin:
        # Check if caller shares a restaurant with target user
        caller_rests = set(r[0] for r in db.query(UserRestaurant.restaurant_id).filter(UserRestaurant.user_id == current_user.id).all())
        target_rests = set(r[0] for r in db.query(UserRestaurant.restaurant_id).filter(UserRestaurant.user_id == user_id).all())
        if not caller_rests.intersection(target_rests):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to modify users outside your restaurant",
            )

    target_user.is_active = is_active
    db.commit()
    db.refresh(target_user)
    return target_user


def delete_user_staff(
    db: Session,
    user_id: int,
    current_user: User,
):
    """Delete a staff member or remove from restaurant."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User ID {user_id} not found",
        )

    if not current_user.is_admin:
        caller_rests = set(r[0] for r in db.query(UserRestaurant.restaurant_id).filter(UserRestaurant.user_id == current_user.id).all())
        target_rests = set(r[0] for r in db.query(UserRestaurant.restaurant_id).filter(UserRestaurant.user_id == user_id).all())
        if not caller_rests.intersection(target_rests):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete users outside your restaurant",
            )

    # Delete mapping and user record
    db.query(UserRestaurant).filter(UserRestaurant.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    return {"message": f"User ID {user_id} deleted successfully"}


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> User:

    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive",
        )

    return user


def login_user(db: Session, email: str, password: str) -> str:

    user = authenticate_user(db, email, password)

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role.value,
        }
    )

    refresh_token = create_refresh_token(
        data={
            "sub": str(user.id),
            "role": user.role.value,
        }
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def refresh_tokens(db: Session, refresh_token: str) -> dict:
    """
    Validate a refresh token and return a new token pair.
    """

    payload = decode_access_token(refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role.value,
        }
    )

    new_refresh_token = create_refresh_token(
        data={
            "sub": str(user.id),
            "role": user.role.value,
        }
    )

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }
