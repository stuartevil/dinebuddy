from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.menu_item_variant import MenuItemVariant
from app.schemas.menu_item_variant_schema import (
    MenuItemVariantCreate,
    MenuItemVariantUpdate,
)


# ------------------------------------------------
# LIST
# ------------------------------------------------
def list_variants(db: Session, item_id: int) -> list[MenuItemVariant]:
    return (
        db.query(MenuItemVariant)
        .filter(MenuItemVariant.item_id == item_id)
        .order_by(MenuItemVariant.price_adjustment.asc())
        .all()
    )


# ------------------------------------------------
# CREATE
# ------------------------------------------------
def create_variant(
    db: Session,
    item_id: int,
    data: MenuItemVariantCreate,
) -> MenuItemVariant:

    # Unique variant name per item (DB will also enforce)
    exists = (
        db.query(MenuItemVariant)
        .filter(
            MenuItemVariant.item_id == item_id,
            MenuItemVariant.name == data.name,
        )
        .first()
    )
    if exists:
        raise HTTPException(
            status_code=400,
            detail="Variant name already exists for this item",
        )

    # If default → unset existing default
    if data.is_default:
        db.query(MenuItemVariant).filter(
            MenuItemVariant.item_id == item_id,
            MenuItemVariant.is_default.is_(True),
        ).update({"is_default": False})

    variant = MenuItemVariant(
        item_id=item_id,
        name=data.name,
        price_adjustment=data.price_adjustment,
        is_default=data.is_default,
    )

    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


# ------------------------------------------------
# UPDATE
# ------------------------------------------------
def update_variant(
    db: Session,
    variant: MenuItemVariant,
    data: MenuItemVariantUpdate,
) -> MenuItemVariant:

    # Name uniqueness check
    if data.name and data.name != variant.name:
        exists = (
            db.query(MenuItemVariant)
            .filter(
                MenuItemVariant.item_id == variant.item_id,
                MenuItemVariant.name == data.name,
                MenuItemVariant.id != variant.id,
            )
            .first()
        )
        if exists:
            raise HTTPException(
                status_code=400,
                detail="Variant name already exists for this item",
            )

    # Default handling
    if data.is_default is True:
        db.query(MenuItemVariant).filter(
            MenuItemVariant.item_id == variant.item_id,
            MenuItemVariant.is_default.is_(True),
            MenuItemVariant.id != variant.id,
        ).update({"is_default": False})

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(variant, field, value)

    db.commit()
    db.refresh(variant)
    return variant


# ------------------------------------------------
# DELETE
# ------------------------------------------------
def delete_variant(db: Session, variant: MenuItemVariant) -> None:
    db.delete(variant)
    db.commit()
