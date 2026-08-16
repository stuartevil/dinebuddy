from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.addon import AddonGroup, AddonOption, MenuItemAddonGroupMap
from app.models.menu_items import MenuItem
from app.schemas.addon_schema import AddonGroupCreate, AddonGroupUpdate, AddonOptionCreate


def list_addon_groups(db: Session, restaurant_id: int) -> List[AddonGroup]:
    return (
        db.query(AddonGroup)
        .filter(AddonGroup.restaurant_id == restaurant_id)
        .order_by(AddonGroup.id.asc())
        .all()
    )


def create_addon_group(db: Session, restaurant_id: int, data: AddonGroupCreate) -> AddonGroup:
    group = AddonGroup(
        restaurant_id=restaurant_id,
        name=data.name,
        min_selectable=data.min_selectable,
        max_selectable=data.max_selectable,
        is_active=data.is_active,
    )
    db.add(group)
    db.flush()

    if data.options:
        for opt in data.options:
            option = AddonOption(
                group_id=group.id,
                name=opt.name,
                price=opt.price,
                is_available=opt.is_available,
            )
            db.add(option)

    db.commit()
    db.refresh(group)
    return group


def update_addon_group(
    db: Session, group_id: int, restaurant_id: int, data: AddonGroupUpdate
) -> Optional[AddonGroup]:
    group = (
        db.query(AddonGroup)
        .filter(AddonGroup.id == group_id, AddonGroup.restaurant_id == restaurant_id)
        .first()
    )
    if not group:
        return None

    if data.name is not None:
        group.name = data.name
    if data.min_selectable is not None:
        group.min_selectable = data.min_selectable
    if data.max_selectable is not None:
        group.max_selectable = data.max_selectable
    if data.is_active is not None:
        group.is_active = data.is_active

    db.commit()
    db.refresh(group)
    return group


def delete_addon_group(db: Session, group_id: int, restaurant_id: int) -> bool:
    group = (
        db.query(AddonGroup)
        .filter(AddonGroup.id == group_id, AddonGroup.restaurant_id == restaurant_id)
        .first()
    )
    if not group:
        return False

    db.delete(group)
    db.commit()
    return True


def add_addon_option(
    db: Session, group_id: int, restaurant_id: int, data: AddonOptionCreate
) -> Optional[AddonOption]:
    group = (
        db.query(AddonGroup)
        .filter(AddonGroup.id == group_id, AddonGroup.restaurant_id == restaurant_id)
        .first()
    )
    if not group:
        return None

    option = AddonOption(
        group_id=group.id,
        name=data.name,
        price=data.price,
        is_available=data.is_available,
    )
    db.add(option)
    db.commit()
    db.refresh(option)
    return option


def delete_addon_option(db: Session, option_id: int, restaurant_id: int) -> bool:
    option = (
        db.query(AddonOption)
        .join(AddonGroup, AddonOption.group_id == AddonGroup.id)
        .filter(AddonOption.id == option_id, AddonGroup.restaurant_id == restaurant_id)
        .first()
    )
    if not option:
        return False

    db.delete(option)
    db.commit()
    return True


def attach_addon_groups_to_item(
    db: Session, item_id: int, restaurant_id: int, group_ids: List[int]
) -> List[AddonGroup]:
    # Check item exists
    item = (
        db.query(MenuItem)
        .filter(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant_id)
        .first()
    )
    if not item:
        return []

    # Clear old maps
    db.query(MenuItemAddonGroupMap).filter(MenuItemAddonGroupMap.item_id == item_id).delete()

    # Add new maps
    for gid in group_ids:
        # verify group belongs to restaurant
        group = (
            db.query(AddonGroup)
            .filter(AddonGroup.id == gid, AddonGroup.restaurant_id == restaurant_id)
            .first()
        )
        if group:
            mapping = MenuItemAddonGroupMap(item_id=item_id, group_id=gid)
            db.add(mapping)

    db.commit()
    return get_item_addon_groups(db, item_id, restaurant_id)


def get_item_addon_groups(db: Session, item_id: int, restaurant_id: int) -> List[AddonGroup]:
    return (
        db.query(AddonGroup)
        .join(MenuItemAddonGroupMap, MenuItemAddonGroupMap.group_id == AddonGroup.id)
        .filter(
            MenuItemAddonGroupMap.item_id == item_id,
            AddonGroup.restaurant_id == restaurant_id,
            AddonGroup.is_active == True,
        )
        .all()
    )
