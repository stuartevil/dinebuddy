from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import check_restaurant_access, CurrentUser
from app.core.permission import require_roles
from app.models.user import UserRole
from app.schemas.menu_item_variant_schema import (
    MenuItemVariantCreate,
    MenuItemVariantRead,
    MenuItemVariantUpdate,
)
from app.services import menu_item_variant_service, menu_items_service
from app.schemas.menu_items_schema import MenuItemRead
router = APIRouter(
    prefix="/restaurants/{restaurant_id}/menu-items/{item_id}/variants",
    tags=["Menu Item Variants"],
)


# --------------------------------
# LIST MENU ITEMS Varients (PUBLIC)
# --------------------------------
@router.get("/", response_model=list[MenuItemVariantRead])
def list_variants(
    restaurant_id: int,
    item_id: int,
    db: Session = Depends(get_db),
):
    item = menu_items_service.get_menu_item(db, item_id)
    if not item or item.restaurant_id != restaurant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")

    return menu_item_variant_service.list_variants(db, item_id)

# --------------------------------
# CREATE MENU ITEM
# --------------------------------
@router.post("/", response_model=MenuItemVariantRead)
def create_variant(
    restaurant_id: int,
    item_id: int,
    data: MenuItemVariantCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    check_restaurant_access(restaurant_id, current_user, db)

    item = menu_items_service.get_menu_item(db, item_id)
    if not item or item.restaurant_id != restaurant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")

    return menu_item_variant_service.create_variant(db, item_id, data)


# --------------------------------
# UPDATE MENU ITEM
# --------------------------------
@router.patch("/{variant_id}", response_model=MenuItemVariantRead)
def update_variant(
    restaurant_id: int,
    item_id: int,
    variant_id: int,
    data: MenuItemVariantUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    check_restaurant_access(restaurant_id, current_user, db)

    item = menu_items_service.get_menu_item(db, item_id)
    if not item or item.restaurant_id != restaurant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")

    variant = db.get(menu_item_variant_service.MenuItemVariant, variant_id)
    if not variant or variant.item_id != item_id:
        raise HTTPException(status_code=404, detail="Variant not found")

    return menu_item_variant_service.update_variant(db, variant, data)


# --------------------------------
# DELETE MENU ITEM
# --------------------------------
@router.delete("/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_variant(
    restaurant_id: int,
    item_id: int,
    variant_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    check_restaurant_access(restaurant_id, current_user, db)

    item = menu_items_service.get_menu_item(db, item_id)
    if not item or item.restaurant_id != restaurant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")

    variant = db.get(menu_item_variant_service.MenuItemVariant, variant_id)
    if not variant or variant.item_id != item_id:
        raise HTTPException(status_code=404, detail="Variant not found")

    menu_item_variant_service.delete_variant(db, variant)
