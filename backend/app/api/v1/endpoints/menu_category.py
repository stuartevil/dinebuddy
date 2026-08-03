from typing import List

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import true

from app.core.dependencies import (
    DBSession,
    CurrentUser,
    RestaurantAccess,
)
from app.schemas.menu_category_schema import (
    MenuCategoryCreate,
    MenuCategoryRead,
    MenuCategoryUpdate,
)
from app.services.menu_category_service import MenuCategoryService

router = APIRouter(
    prefix="/restaurants/{restaurant_id}/menu-categories",
    tags=["Menu Categories"],
)

menu_category_service = MenuCategoryService()


# =========================================================
# CREATE MENU CATEGORY
# =========================================================
@router.post(
    "/",
    response_model=MenuCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_menu_category(
    restaurant_id: int,
    payload: MenuCategoryCreate,
    db: DBSession,
    user: CurrentUser,
    _: RestaurantAccess,
):
    return menu_category_service.create(
        db=db,
        restaurant_id=restaurant_id,
        data=payload,
        user=user,
    )


# =========================================================
# LIST MENU CATEGORIES
# =========================================================
@router.get(
    "/",
    response_model=List[MenuCategoryRead],
)
def list_menu_categories(
    restaurant_id: int,
    db: DBSession,
    _: RestaurantAccess,
):
    """
    ADMIN / RESTAURANT_ADMIN:
      - See restaurant categories
      - See global categories
    """

    return menu_category_service.list(
        db=db,
        restaurant_id=restaurant_id,
    )


# =========================================================
# UPDATE MENU CATEGORY
# =========================================================
@router.patch(
    "/{category_id}",
    response_model=MenuCategoryRead,
)
def update_menu_category(
    restaurant_id: int,
    category_id: int,
    payload: MenuCategoryUpdate,
    db: DBSession,
    user: CurrentUser,
    _: RestaurantAccess,
):
    """
    ADMIN:
      - Can update any category

    RESTAURANT_ADMIN:
      - Can update only their restaurant categories
      - Cannot update global categories
    """

    return menu_category_service.update(
        db=db,
        category_id=category_id,
        data=payload,
        user=user,
    )


# =========================================================
# DELETE MENU CATEGORY
# =========================================================
@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_menu_category(
    restaurant_id: int,
    category_id: int,
    db: DBSession,
    user: CurrentUser,
    _: RestaurantAccess,
):
    """
    ADMIN:
      - Can delete any category

    RESTAURANT_ADMIN:
      - Can delete only their restaurant categories
      - Cannot delete global categories
    """

    menu_category_service.delete(
        db=db,
        category_id=category_id,
        user=user,
    )