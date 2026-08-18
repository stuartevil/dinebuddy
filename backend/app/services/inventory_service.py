from typing import Optional, List, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models.ingredient import Ingredient
from app.models.recipe_item import RecipeItem
from app.models.stock_transaction import StockTransaction, TransactionType
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.menu_items import MenuItem
from app.schemas.inventory_schema import (
    IngredientCreate,
    IngredientUpdate,
    IngredientRead,
    RecipeItemCreate,
    RecipeItemRead,
    RecipeBulkSaveRequest,
    StockTransactionCreate,
    StockTransactionRead,
    InventorySummaryRead,
)


def build_ingredient_read(ingredient: Ingredient) -> IngredientRead:
    stock = Decimal(str(ingredient.current_stock_qty or 0))
    threshold = Decimal(str(ingredient.reorder_threshold or 0))
    cost = Decimal(str(ingredient.cost_per_unit or 0))

    is_low_stock = (stock <= threshold) and (stock > 0)
    is_out_of_stock = (stock <= 0)
    total_valuation = stock * cost

    return IngredientRead(
        id=ingredient.id,
        restaurant_id=ingredient.restaurant_id,
        name=ingredient.name,
        category=ingredient.category,
        unit=ingredient.unit,
        current_stock_qty=stock,
        reorder_threshold=threshold,
        reorder_qty=Decimal(str(ingredient.reorder_qty or 0)),
        cost_per_unit=cost,
        supplier_name=ingredient.supplier_name,
        supplier_contact=ingredient.supplier_contact,
        track_expiry=ingredient.track_expiry,
        expiry_date=ingredient.expiry_date,
        is_low_stock=is_low_stock,
        is_out_of_stock=is_out_of_stock,
        total_valuation=total_valuation,
        created_at=ingredient.created_at,
        updated_at=ingredient.updated_at,
    )


def create_ingredient(
    db: Session,
    restaurant_id: int,
    data: IngredientCreate,
    staff_id: Optional[int] = None,
) -> IngredientRead:
    ingredient = Ingredient(
        restaurant_id=restaurant_id,
        name=data.name,
        category=data.category,
        unit=data.unit,
        current_stock_qty=data.current_stock_qty,
        reorder_threshold=data.reorder_threshold,
        reorder_qty=data.reorder_qty,
        cost_per_unit=data.cost_per_unit,
        supplier_name=data.supplier_name,
        supplier_contact=data.supplier_contact,
        track_expiry=data.track_expiry,
        expiry_date=data.expiry_date,
    )
    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)

    # If initial stock > 0, log an initial Purchase transaction
    if data.current_stock_qty > Decimal("0"):
        tx = StockTransaction(
            restaurant_id=restaurant_id,
            ingredient_id=ingredient.id,
            type=TransactionType.PURCHASE,
            quantity=data.current_stock_qty,
            stock_after=data.current_stock_qty,
            staff_id=staff_id,
            notes="Initial stock recorded on creation",
        )
        db.add(tx)
        db.commit()

    return build_ingredient_read(ingredient)


def get_ingredient(db: Session, restaurant_id: int, ingredient_id: int) -> Optional[IngredientRead]:
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == ingredient_id,
        Ingredient.restaurant_id == restaurant_id
    ).first()
    if not ingredient:
        return None
    return build_ingredient_read(ingredient)


def get_ingredients(
    db: Session,
    restaurant_id: int,
    category: Optional[str] = None,
    low_stock_only: bool = False,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> Tuple[List[IngredientRead], int]:
    query = db.query(Ingredient).filter(Ingredient.restaurant_id == restaurant_id)

    if category:
        query = query.filter(Ingredient.category == category)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Ingredient.name.ilike(search_pattern),
                Ingredient.category.ilike(search_pattern),
                Ingredient.supplier_name.ilike(search_pattern)
            )
        )

    if low_stock_only:
        query = query.filter(Ingredient.current_stock_qty <= Ingredient.reorder_threshold)

    total = query.count()
    ingredients = query.order_by(Ingredient.name.asc()).offset(skip).limit(limit).all()

    return [build_ingredient_read(ing) for ing in ingredients], total


def update_ingredient(
    db: Session,
    restaurant_id: int,
    ingredient_id: int,
    data: IngredientUpdate,
) -> Optional[IngredientRead]:
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == ingredient_id,
        Ingredient.restaurant_id == restaurant_id
    ).first()

    if not ingredient:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ingredient, field, value)

    db.commit()
    db.refresh(ingredient)
    return build_ingredient_read(ingredient)


def delete_ingredient(db: Session, restaurant_id: int, ingredient_id: int) -> bool:
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == ingredient_id,
        Ingredient.restaurant_id == restaurant_id
    ).first()

    if not ingredient:
        return False

    db.delete(ingredient)
    db.commit()
    return True


def record_stock_transaction(
    db: Session,
    restaurant_id: int,
    ingredient_id: int,
    type: TransactionType,
    quantity: Decimal,
    reference_id: Optional[str] = None,
    staff_id: Optional[int] = None,
    notes: Optional[str] = None,
) -> Optional[StockTransactionRead]:
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == ingredient_id,
        Ingredient.restaurant_id == restaurant_id
    ).with_for_update().first()

    if not ingredient:
        return None

    current_stock = Decimal(str(ingredient.current_stock_qty or 0))
    new_stock = current_stock + Decimal(str(quantity))

    # Allow current_stock to drop below zero or cap as needed; setting updated stock
    ingredient.current_stock_qty = new_stock

    tx = StockTransaction(
        restaurant_id=restaurant_id,
        ingredient_id=ingredient_id,
        type=type,
        quantity=quantity,
        stock_after=new_stock,
        reference_id=reference_id,
        staff_id=staff_id,
        notes=notes,
    )

    db.add(tx)
    db.commit()
    db.refresh(tx)

    # Check low stock threshold alert condition
    threshold = Decimal(str(ingredient.reorder_threshold or 0))
    alert_triggered = new_stock <= threshold
    alert_message = None

    if new_stock <= Decimal("0"):
        alert_message = f"CRITICAL: {ingredient.name} is OUT OF STOCK! Current stock is {new_stock} {ingredient.unit}."
    elif alert_triggered:
        alert_message = f"WARNING: {ingredient.name} is LOW ON STOCK! Current stock ({new_stock} {ingredient.unit}) has reached or dropped below your set minimum threshold ({threshold} {ingredient.unit})."

    return StockTransactionRead(
        id=tx.id,
        restaurant_id=tx.restaurant_id,
        ingredient_id=tx.ingredient_id,
        ingredient_name=ingredient.name,
        type=tx.type,
        quantity=Decimal(str(tx.quantity)),
        stock_after=Decimal(str(tx.stock_after)),
        reference_id=tx.reference_id,
        staff_id=tx.staff_id,
        notes=tx.notes,
        alert_triggered=alert_triggered,
        alert_message=alert_message,
        created_at=tx.created_at,
    )


def update_ingredient_threshold(
    db: Session,
    restaurant_id: int,
    ingredient_id: int,
    threshold_data: "IngredientThresholdUpdate",
) -> Optional[IngredientRead]:
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == ingredient_id,
        Ingredient.restaurant_id == restaurant_id
    ).first()

    if not ingredient:
        return None

    ingredient.reorder_threshold = threshold_data.reorder_threshold
    if threshold_data.reorder_qty is not None:
        ingredient.reorder_qty = threshold_data.reorder_qty

    db.commit()
    db.refresh(ingredient)
    return build_ingredient_read(ingredient)


def get_active_stock_alerts(db: Session, restaurant_id: int) -> List["StockAlertItem"]:
    from app.schemas.inventory_schema import StockAlertItem

    ingredients = db.query(Ingredient).filter(
        Ingredient.restaurant_id == restaurant_id,
        Ingredient.current_stock_qty <= Ingredient.reorder_threshold
    ).order_by(Ingredient.current_stock_qty.asc()).all()

    alerts = []
    for ing in ingredients:
        stock = Decimal(str(ing.current_stock_qty or 0))
        threshold = Decimal(str(ing.reorder_threshold or 0))
        reorder_qty = Decimal(str(ing.reorder_qty or 0))

        if stock <= Decimal("0"):
            severity = "CRITICAL"
            msg = f"Out of Stock Alert! {ing.name} has 0 {ing.unit} remaining. Suggested reorder: {reorder_qty} {ing.unit}."
        else:
            severity = "WARNING"
            msg = f"Low Stock Alert! {ing.name} level ({stock} {ing.unit}) reached set minimum threshold ({threshold} {ing.unit}). Suggested reorder: {reorder_qty} {ing.unit}."

        alerts.append(
            StockAlertItem(
                ingredient_id=ing.id,
                ingredient_name=ing.name,
                category=ing.category,
                unit=ing.unit,
                current_stock_qty=stock,
                reorder_threshold=threshold,
                severity=severity,
                alert_message=msg,
                suggested_reorder_qty=reorder_qty,
            )
        )

    return alerts



def get_stock_transactions(
    db: Session,
    restaurant_id: int,
    ingredient_id: Optional[int] = None,
    tx_type: Optional[TransactionType] = None,
    skip: int = 0,
    limit: int = 100,
) -> Tuple[List[StockTransactionRead], int]:
    query = db.query(StockTransaction, Ingredient.name).join(
        Ingredient, StockTransaction.ingredient_id == Ingredient.id
    ).filter(StockTransaction.restaurant_id == restaurant_id)

    if ingredient_id:
        query = query.filter(StockTransaction.ingredient_id == ingredient_id)

    if tx_type:
        query = query.filter(StockTransaction.type == tx_type)

    total = query.count()
    results = query.order_by(StockTransaction.created_at.desc()).offset(skip).limit(limit).all()

    tx_list = []
    for tx, ing_name in results:
        tx_list.append(
            StockTransactionRead(
                id=tx.id,
                restaurant_id=tx.restaurant_id,
                ingredient_id=tx.ingredient_id,
                ingredient_name=ing_name,
                type=tx.type,
                quantity=Decimal(str(tx.quantity)),
                stock_after=Decimal(str(tx.stock_after)),
                reference_id=tx.reference_id,
                staff_id=tx.staff_id,
                notes=tx.notes,
                created_at=tx.created_at,
            )
        )

    return tx_list, total


def get_inventory_summary(db: Session, restaurant_id: int) -> InventorySummaryRead:
    ingredients = db.query(Ingredient).filter(Ingredient.restaurant_id == restaurant_id).all()

    total_ingredients = len(ingredients)
    total_valuation = Decimal("0.00")
    low_stock_count = 0
    out_of_stock_count = 0

    for ing in ingredients:
        stock = Decimal(str(ing.current_stock_qty or 0))
        threshold = Decimal(str(ing.reorder_threshold or 0))
        cost = Decimal(str(ing.cost_per_unit or 0))

        total_valuation += stock * cost

        if stock <= Decimal("0"):
            out_of_stock_count += 1
        elif stock <= threshold:
            low_stock_count += 1

    return InventorySummaryRead(
        total_ingredients=total_ingredients,
        total_valuation=total_valuation,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
    )


# ------------------------------------------------------------------
# RECIPE (BOM) MANAGEMENT
# ------------------------------------------------------------------

def create_or_update_recipe_item(
    db: Session,
    restaurant_id: int,
    menu_item_id: int,
    data: RecipeItemCreate,
) -> RecipeItemRead:
    # Check if ingredient exists
    ingredient = db.query(Ingredient).filter(
        Ingredient.id == data.ingredient_id,
        Ingredient.restaurant_id == restaurant_id
    ).first()
    if not ingredient:
        raise ValueError(f"Ingredient ID {data.ingredient_id} not found for this restaurant")

    recipe_item = db.query(RecipeItem).filter(
        RecipeItem.restaurant_id == restaurant_id,
        RecipeItem.menu_item_id == menu_item_id,
        RecipeItem.ingredient_id == data.ingredient_id,
    ).first()

    if recipe_item:
        recipe_item.quantity_used = data.quantity_used
    else:
        recipe_item = RecipeItem(
            restaurant_id=restaurant_id,
            menu_item_id=menu_item_id,
            ingredient_id=data.ingredient_id,
            quantity_used=data.quantity_used,
        )
        db.add(recipe_item)

    db.commit()
    db.refresh(recipe_item)

    return RecipeItemRead(
        id=recipe_item.id,
        restaurant_id=recipe_item.restaurant_id,
        menu_item_id=recipe_item.menu_item_id,
        ingredient_id=recipe_item.ingredient_id,
        ingredient_name=ingredient.name,
        ingredient_unit=ingredient.unit,
        quantity_used=Decimal(str(recipe_item.quantity_used)),
        created_at=recipe_item.created_at,
        updated_at=recipe_item.updated_at,
    )


def get_all_recipes_for_restaurant(
    db: Session,
    restaurant_id: int,
) -> List[RecipeItemRead]:
    results = db.query(RecipeItem, Ingredient.name, Ingredient.unit, Ingredient.cost_per_unit).join(
        Ingredient, RecipeItem.ingredient_id == Ingredient.id
    ).filter(
        RecipeItem.restaurant_id == restaurant_id,
    ).all()

    recipe_list = []
    for item, ing_name, ing_unit, ing_cost in results:
        recipe_list.append(
            RecipeItemRead(
                id=item.id,
                restaurant_id=item.restaurant_id,
                menu_item_id=item.menu_item_id,
                ingredient_id=item.ingredient_id,
                ingredient_name=ing_name,
                ingredient_unit=ing_unit,
                ingredient_cost_per_unit=Decimal(str(ing_cost or 0)),
                quantity_used=Decimal(str(item.quantity_used)),
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
        )
    return recipe_list


def get_recipe_for_menu_item(
    db: Session,
    restaurant_id: int,
    menu_item_id: int,
) -> List[RecipeItemRead]:
    results = db.query(RecipeItem, Ingredient.name, Ingredient.unit, Ingredient.cost_per_unit).join(
        Ingredient, RecipeItem.ingredient_id == Ingredient.id
    ).filter(
        RecipeItem.restaurant_id == restaurant_id,
        RecipeItem.menu_item_id == menu_item_id,
    ).all()

    recipe_list = []
    for item, ing_name, ing_unit, ing_cost in results:
        recipe_list.append(
            RecipeItemRead(
                id=item.id,
                restaurant_id=item.restaurant_id,
                menu_item_id=item.menu_item_id,
                ingredient_id=item.ingredient_id,
                ingredient_name=ing_name,
                ingredient_unit=ing_unit,
                ingredient_cost_per_unit=Decimal(str(ing_cost or 0)),
                quantity_used=Decimal(str(item.quantity_used)),
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
        )

    return recipe_list


def bulk_save_recipe_for_menu_item(
    db: Session,
    restaurant_id: int,
    menu_item_id: int,
    data: RecipeBulkSaveRequest,
) -> List[RecipeItemRead]:
    # Update MenuItem description & preparation time if provided
    menu_item = db.query(MenuItem).filter(
        MenuItem.id == menu_item_id,
        MenuItem.restaurant_id == restaurant_id,
    ).first()

    if not menu_item:
        raise ValueError(f"Menu Item ID {menu_item_id} not found for this restaurant")

    if data.description is not None:
        menu_item.description = data.description
    if data.preparation_time_minutes is not None:
        menu_item.preparation_time_minutes = data.preparation_time_minutes

    # Remove existing recipe items for this dish
    db.query(RecipeItem).filter(
        RecipeItem.restaurant_id == restaurant_id,
        RecipeItem.menu_item_id == menu_item_id,
    ).delete(synchronize_session=False)

    # Insert new recipe items
    for it in data.items:
        new_item = RecipeItem(
            restaurant_id=restaurant_id,
            menu_item_id=menu_item_id,
            ingredient_id=it.ingredient_id,
            quantity_used=it.quantity_used,
        )
        db.add(new_item)

    db.commit()
    return get_recipe_for_menu_item(db, restaurant_id, menu_item_id)


def delete_all_recipe_items_for_menu_item(
    db: Session,
    restaurant_id: int,
    menu_item_id: int,
) -> bool:
    count = db.query(RecipeItem).filter(
        RecipeItem.restaurant_id == restaurant_id,
        RecipeItem.menu_item_id == menu_item_id,
    ).delete(synchronize_session=False)
    db.commit()
    return count > 0


def delete_recipe_item(
    db: Session,
    restaurant_id: int,
    menu_item_id: int,
    recipe_item_id: int,
) -> bool:
    recipe_item = db.query(RecipeItem).filter(
        RecipeItem.id == recipe_item_id,
        RecipeItem.menu_item_id == menu_item_id,
        RecipeItem.restaurant_id == restaurant_id,
    ).first()

    if not recipe_item:
        return False

    db.delete(recipe_item)
    db.commit()
    return True


# ------------------------------------------------------------------
# AUTO-DEDUCTION ENGINE FOR ORDERS
# ------------------------------------------------------------------

def deduct_inventory_for_order(
    db: Session,
    restaurant_id: int,
    order_id: int,
    staff_id: Optional[int] = None,
) -> List[StockTransactionRead]:
    order_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    if not order_items:
        return []

    created_transactions = []

    for item in order_items:
        menu_item_id = item.menu_item_id
        item_qty = item.quantity or 1

        recipe_items = db.query(RecipeItem).filter(
            RecipeItem.restaurant_id == restaurant_id,
            RecipeItem.menu_item_id == menu_item_id,
        ).all()

        for recipe in recipe_items:
            deduct_qty = Decimal(str(recipe.quantity_used)) * Decimal(str(item_qty))

            tx = record_stock_transaction(
                db=db,
                restaurant_id=restaurant_id,
                ingredient_id=recipe.ingredient_id,
                type=TransactionType.SALE_DEDUCTION,
                quantity=-deduct_qty,  # Negative for deduction
                reference_id=str(order_id),
                staff_id=staff_id,
                notes=f"Auto-deduction for order #{order_id} ({item_qty}x menu_item #{menu_item_id})",
            )
            if tx:
                created_transactions.append(tx)

    return created_transactions
