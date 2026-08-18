from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from app.models.addon import AddonGroup, AddonOption, MenuItemAddonGroupMap, MenuCategoryAddonGroupMap
from app.models.menu_items import MenuItem
from app.models.menu_category import MenuCategory
from app.schemas.addon_schema import AddonGroupCreate, AddonGroupUpdate, AddonOptionCreate


def _populate_category_ids(db: Session, groups: List[AddonGroup]) -> List[AddonGroup]:
    if not groups:
        return groups
    group_ids = [g.id for g in groups]
    maps = (
        db.query(MenuCategoryAddonGroupMap)
        .filter(MenuCategoryAddonGroupMap.group_id.in_(group_ids))
        .all()
    )
    cat_map: Dict[int, List[int]] = {}
    for m in maps:
        cat_map.setdefault(m.group_id, []).append(m.category_id)

    for g in groups:
        g.category_ids = cat_map.get(g.id, [])
    return groups


def list_addon_groups(db: Session, restaurant_id: int) -> List[AddonGroup]:
    groups = (
        db.query(AddonGroup)
        .filter(AddonGroup.restaurant_id == restaurant_id)
        .order_by(AddonGroup.id.asc())
        .all()
    )
    return _populate_category_ids(db, groups)


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

    if data.category_ids:
        for cat_id in data.category_ids:
            cat = (
                db.query(MenuCategory)
                .filter(
                    MenuCategory.id == cat_id,
                    (MenuCategory.restaurant_id == restaurant_id) | (MenuCategory.is_global == True),
                )
                .first()
            )
            if cat:
                mapping = MenuCategoryAddonGroupMap(category_id=cat_id, group_id=group.id)
                db.add(mapping)

    db.commit()
    db.refresh(group)
    group.category_ids = data.category_ids or []
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

    if data.category_ids is not None:
        db.query(MenuCategoryAddonGroupMap).filter(
            MenuCategoryAddonGroupMap.group_id == group_id
        ).delete()
        for cat_id in data.category_ids:
            cat = (
                db.query(MenuCategory)
                .filter(
                    MenuCategory.id == cat_id,
                    (MenuCategory.restaurant_id == restaurant_id) | (MenuCategory.is_global == True),
                )
                .first()
            )
            if cat:
                mapping = MenuCategoryAddonGroupMap(category_id=cat_id, group_id=group.id)
                db.add(mapping)

    db.commit()
    db.refresh(group)
    return _populate_category_ids(db, [group])[0]


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

    # Clear old direct item maps
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


def attach_addon_groups_to_category(
    db: Session, category_id: int, restaurant_id: int, group_ids: List[int]
) -> List[AddonGroup]:
    cat = (
        db.query(MenuCategory)
        .filter(
            MenuCategory.id == category_id,
            (MenuCategory.restaurant_id == restaurant_id) | (MenuCategory.is_global == True),
        )
        .first()
    )
    if not cat:
        return []

    db.query(MenuCategoryAddonGroupMap).filter(
        MenuCategoryAddonGroupMap.category_id == category_id
    ).delete()

    for gid in group_ids:
        group = (
            db.query(AddonGroup)
            .filter(AddonGroup.id == gid, AddonGroup.restaurant_id == restaurant_id)
            .first()
        )
        if group:
            mapping = MenuCategoryAddonGroupMap(category_id=category_id, group_id=gid)
            db.add(mapping)

    db.commit()
    return get_category_addon_groups(db, category_id, restaurant_id)


def get_category_addon_groups(
    db: Session, category_id: int, restaurant_id: int
) -> List[AddonGroup]:
    groups = (
        db.query(AddonGroup)
        .join(MenuCategoryAddonGroupMap, MenuCategoryAddonGroupMap.group_id == AddonGroup.id)
        .filter(
            MenuCategoryAddonGroupMap.category_id == category_id,
            AddonGroup.restaurant_id == restaurant_id,
            AddonGroup.is_active == True,
        )
        .all()
    )
    return _populate_category_ids(db, groups)


def attach_categories_to_addon_group(
    db: Session, group_id: int, restaurant_id: int, category_ids: List[int]
) -> List[int]:
    group = (
        db.query(AddonGroup)
        .filter(AddonGroup.id == group_id, AddonGroup.restaurant_id == restaurant_id)
        .first()
    )
    if not group:
        return []

    db.query(MenuCategoryAddonGroupMap).filter(
        MenuCategoryAddonGroupMap.group_id == group_id
    ).delete()

    for cat_id in category_ids:
        cat = (
            db.query(MenuCategory)
            .filter(
                MenuCategory.id == cat_id,
                (MenuCategory.restaurant_id == restaurant_id) | (MenuCategory.is_global == True),
            )
            .first()
        )
        if cat:
            mapping = MenuCategoryAddonGroupMap(category_id=cat_id, group_id=group_id)
            db.add(mapping)

    db.commit()
    return get_addon_group_category_ids(db, group_id, restaurant_id)


def get_addon_group_category_ids(
    db: Session, group_id: int, restaurant_id: int
) -> List[int]:
    group = (
        db.query(AddonGroup)
        .filter(AddonGroup.id == group_id, AddonGroup.restaurant_id == restaurant_id)
        .first()
    )
    if not group:
        return []

    maps = (
        db.query(MenuCategoryAddonGroupMap)
        .filter(MenuCategoryAddonGroupMap.group_id == group_id)
        .all()
    )
    return [m.category_id for m in maps]


def get_item_addon_groups(db: Session, item_id: int, restaurant_id: int) -> List[AddonGroup]:
    item = (
        db.query(MenuItem)
        .filter(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant_id)
        .first()
    )
    if not item:
        return []

    # 1. Direct item addon groups
    item_groups = (
        db.query(AddonGroup)
        .join(MenuItemAddonGroupMap, MenuItemAddonGroupMap.group_id == AddonGroup.id)
        .filter(
            MenuItemAddonGroupMap.item_id == item_id,
            AddonGroup.restaurant_id == restaurant_id,
            AddonGroup.is_active == True,
        )
        .all()
    )

    # 2. Inherited category addon groups
    cat_groups = []
    if item.category_id:
        cat_groups = (
            db.query(AddonGroup)
            .join(MenuCategoryAddonGroupMap, MenuCategoryAddonGroupMap.group_id == AddonGroup.id)
            .filter(
                MenuCategoryAddonGroupMap.category_id == item.category_id,
                AddonGroup.restaurant_id == restaurant_id,
                AddonGroup.is_active == True,
            )
            .all()
        )

    # Merge and deduplicate by group ID
    seen_ids = set()
    combined_groups = []
    # We place category groups first, then item specific groups
    for g in cat_groups + item_groups:
        if g.id not in seen_ids:
            seen_ids.add(g.id)
            combined_groups.append(g)

    return _populate_category_ids(db, combined_groups)

