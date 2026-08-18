from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, check_restaurant_access
from app.models.user import User
from app.schemas.inventory_schema import (
    RecipeItemRead,
    RecipeBulkSaveRequest,
)
from app.services import inventory_service

router = APIRouter(
    prefix="/restaurants/{restaurant_id}/recipes",
    tags=["Recipe & BOM Management"],
)


@router.get(
    "",
    response_model=List[RecipeItemRead],
    summary="Get all recipes (BOM) configured for this restaurant",
)
def get_all_restaurant_recipes(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch all recipe items across all menu dishes for this restaurant."""
    check_restaurant_access(restaurant_id, current_user, db)
    return inventory_service.get_all_recipes_for_restaurant(
        db=db,
        restaurant_id=restaurant_id,
    )


@router.get(
    "/{menu_item_id}",
    response_model=List[RecipeItemRead],
    summary="Get recipe and BOM for a specific menu item",
)
def get_menu_item_recipe(
    restaurant_id: int,
    menu_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch all ingredients linked to a specific dish."""
    check_restaurant_access(restaurant_id, current_user, db)
    return inventory_service.get_recipe_for_menu_item(
        db=db,
        restaurant_id=restaurant_id,
        menu_item_id=menu_item_id,
    )


@router.post(
    "/{menu_item_id}/bulk",
    response_model=List[RecipeItemRead],
    summary="Bulk save or update recipe, BOM, description and preparation time for a dish",
)
def bulk_save_dish_recipe(
    restaurant_id: int,
    menu_item_id: int,
    data: RecipeBulkSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save raw ingredients BOM, cooking description and prep time for a menu item."""
    check_restaurant_access(restaurant_id, current_user, db)
    try:
        return inventory_service.bulk_save_recipe_for_menu_item(
            db=db,
            restaurant_id=restaurant_id,
            menu_item_id=menu_item_id,
            data=data,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/{menu_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete entire recipe configuration for a dish",
)
def delete_entire_dish_recipe(
    restaurant_id: int,
    menu_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove all ingredient links for a specific menu item."""
    check_restaurant_access(restaurant_id, current_user, db)
    inventory_service.delete_all_recipe_items_for_menu_item(
        db=db,
        restaurant_id=restaurant_id,
        menu_item_id=menu_item_id,
    )


@router.delete(
    "/{menu_item_id}/items/{recipe_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a single ingredient item from a dish recipe",
)
def delete_single_dish_recipe_item(
    restaurant_id: int,
    menu_item_id: int,
    recipe_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove one ingredient from a dish's recipe."""
    check_restaurant_access(restaurant_id, current_user, db)
    success = inventory_service.delete_recipe_item(
        db=db,
        restaurant_id=restaurant_id,
        menu_item_id=menu_item_id,
        recipe_item_id=recipe_item_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe item ID {recipe_item_id} not found",
        )
