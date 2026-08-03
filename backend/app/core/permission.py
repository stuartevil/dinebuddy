from fastapi import HTTPException, status
from app.models.user import User, UserRole


def require_roles(
    user: User,
    allowed_roles: tuple[UserRole, ...],
    message: str = "Not allowed",
):
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message,
        )
