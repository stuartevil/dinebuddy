from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, check_restaurant_access

from app.models.user import User
from app.models.stock_transaction import TransactionType
from app.schemas.inventory_schema import (
    IngredientCreate,
    IngredientUpdate,
    IngredientRead,
    IngredientThresholdUpdate,
    StockAlertItem,
    RecipeItemCreate,
    RecipeItemRead,
    StockTransactionCreate,
    StockTransactionRead,
    InventorySummaryRead,
)
from app.services import inventory_service

router = APIRouter(
    prefix="/restaurants/{restaurant_id}/inventory",
    tags=["Inventory Management"],
)



# ------------------------------------------------------------------
# INGREDIENT CRUD
# ------------------------------------------------------------------

@router.post(
    "/ingredients",
    response_model=IngredientRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a raw stock ingredient",
)
def create_ingredient(
    restaurant_id: int,
    data: IngredientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new ingredient in raw stock for the restaurant."""
    check_restaurant_access(restaurant_id, current_user, db)
    return inventory_service.create_ingredient(
        db=db,
        restaurant_id=restaurant_id,
        data=data,
        staff_id=current_user.id,
    )



@router.get(
    "/ingredients",
    response_model=List[IngredientRead],
    summary="List ingredients with optional filters and low-stock flag",
)
def list_ingredients(
    restaurant_id: int,
    category: Optional[str] = Query(None, description="Filter by category (Dairy, Coffee, etc.)"),
    low_stock_only: bool = Query(False, description="Filter ingredients at or below reorder threshold"),
    search: Optional[str] = Query(None, description="Search by name, category or supplier"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all stock ingredients for a restaurant with low-stock flags and valuation."""
    ingredients, _ = inventory_service.get_ingredients(
        db=db,
        restaurant_id=restaurant_id,
        category=category,
        low_stock_only=low_stock_only,
        search=search,
        skip=skip,
        limit=limit,
    )
    return ingredients


@router.get(
    "/ingredients/{ingredient_id}",
    response_model=IngredientRead,
    summary="Get single ingredient details",
)
def get_ingredient(
    restaurant_id: int,
    ingredient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch details of a single ingredient."""
    ingredient = inventory_service.get_ingredient(
        db=db,
        restaurant_id=restaurant_id,
        ingredient_id=ingredient_id,
    )
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingredient ID {ingredient_id} not found",
        )
    return ingredient


@router.put(
    "/ingredients/{ingredient_id}",
    response_model=IngredientRead,
    summary="Update ingredient details",
)
def update_ingredient(
    restaurant_id: int,
    ingredient_id: int,
    data: IngredientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update properties of an existing ingredient."""
    updated = inventory_service.update_ingredient(
        db=db,
        restaurant_id=restaurant_id,
        ingredient_id=ingredient_id,
        data=data,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingredient ID {ingredient_id} not found",
        )
    return updated


@router.delete(
    "/ingredients/{ingredient_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an ingredient",
)
def delete_ingredient(
    restaurant_id: int,
    ingredient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an ingredient from stock."""
    success = inventory_service.delete_ingredient(
        db=db,
        restaurant_id=restaurant_id,
        ingredient_id=ingredient_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingredient ID {ingredient_id} not found",
        )


@router.patch(
    "/ingredients/{ingredient_id}/threshold",
    response_model=IngredientRead,
    summary="Set custom minimum stock alert threshold for an ingredient",
)
def set_ingredient_alert_threshold(
    restaurant_id: int,
    ingredient_id: int,
    data: IngredientThresholdUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set custom minimum stock threshold (reorder_threshold) and reorder quantity for low stock alerts."""
    updated = inventory_service.update_ingredient_threshold(
        db=db,
        restaurant_id=restaurant_id,
        ingredient_id=ingredient_id,
        threshold_data=data,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingredient ID {ingredient_id} not found",
        )
    return updated


@router.get(
    "/alerts",
    response_model=List[StockAlertItem],
    summary="Get active low-stock & out-of-stock alerts",
)
def get_active_stock_alerts(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch all current low stock and out-of-stock alert notifications."""
    return inventory_service.get_active_stock_alerts(
        db=db,
        restaurant_id=restaurant_id,
    )



# ------------------------------------------------------------------
# STOCK TRANSACTIONS (PURCHASE / WASTAGE / ADJUSTMENT)
# ------------------------------------------------------------------

@router.post(
    "/ingredients/{ingredient_id}/transactions",
    response_model=StockTransactionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record stock movement (Purchase, Wastage, Adjustment)",
)
def record_stock_transaction(
    restaurant_id: int,
    ingredient_id: int,
    data: StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log manual stock transaction such as purchase restock, wastage, or audit adjustment."""
    if data.ingredient_id != ingredient_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ingredient ID mismatch in request body and path",
        )

    tx = inventory_service.record_stock_transaction(
        db=db,
        restaurant_id=restaurant_id,
        ingredient_id=ingredient_id,
        type=data.type,
        quantity=data.quantity,
        reference_id=data.reference_id,
        staff_id=current_user.id,
        notes=data.notes,
    )
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingredient ID {ingredient_id} not found",
        )
    return tx


@router.get(
    "/transactions",
    response_model=List[StockTransactionRead],
    summary="Get stock transaction history (Audit log)",
)
def list_stock_transactions(
    restaurant_id: int,
    ingredient_id: Optional[int] = Query(None, description="Filter by ingredient ID"),
    tx_type: Optional[TransactionType] = Query(None, description="Filter by transaction type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full audit log of all stock movements."""
    transactions, _ = inventory_service.get_stock_transactions(
        db=db,
        restaurant_id=restaurant_id,
        ingredient_id=ingredient_id,
        tx_type=tx_type,
        skip=skip,
        limit=limit,
    )
    return transactions


# ------------------------------------------------------------------
# SUMMARY & ALERTS
# ------------------------------------------------------------------

@router.get(
    "/summary",
    response_model=InventorySummaryRead,
    summary="Get summary metrics (Valuation & Low-Stock Alerts)",
)
def get_inventory_summary(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get high-level summary of total ingredients, total stock valuation (COGS), and low stock counts."""
    return inventory_service.get_inventory_summary(
        db=db,
        restaurant_id=restaurant_id,
    )


# ------------------------------------------------------------------
# RECIPE (BOM) MANAGEMENT
# ------------------------------------------------------------------

@router.post(
    "/recipes/{menu_item_id}",
    response_model=RecipeItemRead,
    status_code=status.HTTP_201_CREATED,
    summary="Map ingredient recipe to a menu item",
)
def add_or_update_recipe_item(
    restaurant_id: int,
    menu_item_id: int,
    data: RecipeItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add or update an ingredient requirement for a menu item (Bill of Materials)."""
    try:
        return inventory_service.create_or_update_recipe_item(
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


@router.get(
    "/recipes/{menu_item_id}",
    response_model=List[RecipeItemRead],
    summary="Get recipe ingredients for a menu item",
)
def get_menu_item_recipe(
    restaurant_id: int,
    menu_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all recipe ingredients required for a menu item."""
    return inventory_service.get_recipe_for_menu_item(
        db=db,
        restaurant_id=restaurant_id,
        menu_item_id=menu_item_id,
    )


@router.delete(
    "/recipes/{menu_item_id}/{recipe_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove an ingredient from a menu item recipe",
)
def delete_recipe_item(
    restaurant_id: int,
    menu_item_id: int,
    recipe_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a recipe item mapping."""
    success = inventory_service.delete_recipe_item(
        db=db,
        restaurant_id=restaurant_id,
        menu_item_id=menu_item_id,
        recipe_item_id=recipe_item_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe item ID {recipe_item_id} not found for menu item {menu_item_id}",
        )
