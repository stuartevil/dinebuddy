from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import CurrentUser, check_restaurant_access
from app.core.permission import require_roles
from app.models.user import UserRole
from app.schemas.addon_schema import (
    AddonGroupCreate,
    AddonGroupRead,
    AddonGroupUpdate,
    AddonOptionCreate,
    AddonOptionRead,
    AttachAddonGroupsToItem,
)
from app.services import addon_service

router = APIRouter(
    prefix="/restaurants/{restaurant_id}",
    tags=["Menu Add-ons & Modifiers"],
)


@router.get("/addon-groups", response_model=List[AddonGroupRead])
def list_addon_groups(
    restaurant_id: int,
    db: Session = Depends(get_db),
):
    """List all add-on groups and their options for a restaurant."""
    return addon_service.list_addon_groups(db, restaurant_id)


@router.post("/addon-groups", response_model=AddonGroupRead, status_code=status.HTTP_201_CREATED)
def create_addon_group(
    restaurant_id: int,
    data: AddonGroupCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Create a new add-on group (e.g. Extra Toppings, Milk Options) with options."""
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    check_restaurant_access(restaurant_id, current_user, db)
    return addon_service.create_addon_group(db, restaurant_id, data)


@router.put("/addon-groups/{group_id}", response_model=AddonGroupRead)
def update_addon_group(
    restaurant_id: int,
    group_id: int,
    data: AddonGroupUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Update add-on group settings."""
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    check_restaurant_access(restaurant_id, current_user, db)
    group = addon_service.update_addon_group(db, group_id, restaurant_id, data)
    if not group:
        raise HTTPException(status_code=404, detail="Add-on group not found")
    return group


@router.delete("/addon-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_addon_group(
    restaurant_id: int,
    group_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Delete an add-on group and its options."""
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    check_restaurant_access(restaurant_id, current_user, db)
    success = addon_service.delete_addon_group(db, group_id, restaurant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Add-on group not found")


@router.post("/addon-groups/{group_id}/options", response_model=AddonOptionRead, status_code=status.HTTP_201_CREATED)
def add_addon_option(
    restaurant_id: int,
    group_id: int,
    data: AddonOptionCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Add a new option to an existing add-on group (e.g. Extra Cheese +50)."""
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    check_restaurant_access(restaurant_id, current_user, db)
    option = addon_service.add_addon_option(db, group_id, restaurant_id, data)
    if not option:
        raise HTTPException(status_code=404, detail="Add-on group not found")
    return option


@router.delete("/addon-groups/options/{option_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_addon_option(
    restaurant_id: int,
    option_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Delete an option from an add-on group."""
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    check_restaurant_access(restaurant_id, current_user, db)
    success = addon_service.delete_addon_option(db, option_id, restaurant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Add-on option not found")


@router.post("/menu-items/{item_id}/addon-groups", response_model=List[AddonGroupRead])
def attach_addon_groups_to_item(
    restaurant_id: int,
    item_id: int,
    payload: AttachAddonGroupsToItem,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Attach/Link add-on groups to a specific menu dish."""
    require_roles(current_user, (UserRole.ADMIN, UserRole.RESTAURANT_ADMIN))
    check_restaurant_access(restaurant_id, current_user, db)
    return addon_service.attach_addon_groups_to_item(db, item_id, restaurant_id, payload.group_ids)


@router.get("/menu-items/{item_id}/addon-groups", response_model=List[AddonGroupRead])
def get_item_addon_groups(
    restaurant_id: int,
    item_id: int,
    db: Session = Depends(get_db),
):
    """Get active add-on groups linked to a specific menu dish."""
    return addon_service.get_item_addon_groups(db, item_id, restaurant_id)
