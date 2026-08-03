from fastapi import APIRouter, HTTPException, Query, status
from app.models.user import UserRole
from app.core.dependencies import (
    DBSession,
    CurrentUser,
    AdminUser,
    RestaurantAccess,
)
from app.services.restaurant_service import RestaurantService
from app.services.restaurant_setting_service import RestaurantSettingsService
from app.schemas.restaurant import (
    RestaurantCreateRequest,
    RestaurantUpdateRequest,
    RestaurantProfileUpdateRequest,
    RestaurantStaffAddRequest,
    RestaurantRead,
    RestaurantResponse,
    RestaurantListResponse,
    RestaurantDetailResponse,
)
from app.schemas.restaurant_setting_schema import (
    RestaurantSettingsUpdateRequest,
    RestaurantSettingsRead,
)

router = APIRouter(prefix="/restaurants", tags=["restaurants"])

service = RestaurantService()
settings_service = RestaurantSettingsService()


# =========================================================
# Create Restaurant (ADMIN only)
# =========================================================

@router.post(
    "/",
    response_model=RestaurantResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_restaurant(
    payload: RestaurantCreateRequest,
    user: AdminUser,
    db: DBSession,
):
    restaurant = service.create(db, payload)

    return RestaurantResponse(
        status=True,
        message="Restaurant created successfully",
        data=RestaurantRead.model_validate(restaurant),
    )


# =========================================================
# List Restaurants
# =========================================================

@router.get("/", response_model=RestaurantListResponse)
def get_restaurants(
    user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    skip = (page - 1) * limit

    restaurants, total = service.get_all(
        db=db,
        user=user,
        skip=skip,
        limit=limit,
    )

    return RestaurantListResponse(
        status=True,
        message="Restaurant list fetched",
        data=[RestaurantRead.model_validate(r) for r in restaurants],
        meta={"page": page, "limit": limit, "total": total},
    )


# =========================================================
# Get Restaurant by ID
# =========================================================

@router.get("/{restaurant_id}", response_model=RestaurantDetailResponse)
def get_restaurant(
    restaurant_id: int,
    user: CurrentUser,
    db: DBSession,
    _: RestaurantAccess,
):
    restaurant = service.get_by_id(db, restaurant_id)

    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )

    return RestaurantDetailResponse(
        status=True,
        message="Restaurant fetched successfully",
        data=RestaurantRead.model_validate(restaurant),
    )


# =========================================================
# Update Restaurant
# =========================================================

@router.patch("/{restaurant_id}", response_model=RestaurantDetailResponse)
def update_restaurant(
    restaurant_id: int,
    payload: RestaurantUpdateRequest,
    user: CurrentUser,
    db: DBSession,
    _: RestaurantAccess,
):
    if user.role not in [UserRole.ADMIN, UserRole.RESTAURANT_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Restaurant Admin access required",
        )

    restaurant = service.update(db, restaurant_id, payload)

    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )

    return RestaurantDetailResponse(
        status=True,
        message="Restaurant updated successfully",
        data=RestaurantRead.model_validate(restaurant),
    )


# =========================================================
# Update Restaurant Profile
# =========================================================

@router.patch("/{restaurant_id}/profile", response_model=RestaurantDetailResponse)
def update_restaurant_profile(
    restaurant_id: int,
    payload: RestaurantProfileUpdateRequest,
    user: CurrentUser,
    db: DBSession,
    _: RestaurantAccess,
):
    if user.role not in [UserRole.ADMIN, UserRole.RESTAURANT_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Restaurant Admin access required",
        )

    restaurant = service.update(db, restaurant_id, payload)

    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )

    return RestaurantDetailResponse(
        status=True,
        message="Restaurant profile updated successfully",
        data=RestaurantRead.model_validate(restaurant),
    )


# =========================================================
# Delete Restaurant (ADMIN only)
# =========================================================

@router.delete("/{restaurant_id}", response_model=RestaurantDetailResponse)
def delete_restaurant(
    restaurant_id: int,
    user: AdminUser,
    db: DBSession,
):
    deleted = service.delete(db, restaurant_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )

    return RestaurantDetailResponse(
        status=True,
        message="Restaurant deleted successfully",
        data=None,
    )


# =========================================================
# Add Staff to Restaurant
# =========================================================

@router.post("/{restaurant_id}/staff", response_model=RestaurantDetailResponse)
def add_restaurant_staff(
    restaurant_id: int,
    payload: RestaurantStaffAddRequest,
    user: CurrentUser,
    db: DBSession,
    _: RestaurantAccess,
):
    if user.role not in [UserRole.ADMIN, UserRole.RESTAURANT_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Restaurant Admin access required",
        )

    restaurant = service.add_staff(
        db=db,
        restaurant_id=restaurant_id,
        staff_user_id=payload.user_id,
    )

    return RestaurantDetailResponse(
        status=True,
        message="Staff assigned to restaurant",
        data=RestaurantRead.model_validate(restaurant),
    )


# =========================================================
# Restaurant Settings
# =========================================================

@router.get(
    "/{restaurant_id}/settings",
    response_model=RestaurantSettingsRead,
)
def get_restaurant_settings(
    restaurant_id: int,
    user: CurrentUser,
    db: DBSession,
    _: RestaurantAccess,
):
    if user.role not in [UserRole.ADMIN, UserRole.RESTAURANT_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Restaurant Admin access required",
        )

    settings = settings_service.get_or_create(db, restaurant_id)
    return RestaurantSettingsRead.model_validate(settings)


@router.patch(
    "/{restaurant_id}/settings",
    response_model=RestaurantSettingsRead,
)
def update_restaurant_settings(
    restaurant_id: int,
    payload: RestaurantSettingsUpdateRequest,
    user: CurrentUser,
    db: DBSession,
    _: RestaurantAccess,
):
    if user.role not in [UserRole.ADMIN, UserRole.RESTAURANT_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Restaurant Admin access required",
        )

    settings = settings_service.update(db, restaurant_id, payload)
    return RestaurantSettingsRead.model_validate(settings)
