from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.menu_category import MenuCategory
from app.models.user import User
from app.core.dependencies import check_restaurant_access
from app.schemas.menu_category_schema import (
    MenuCategoryCreate,
    MenuCategoryUpdate,
)


class MenuCategoryService:
    """
    Service layer for Menu Categories
    Follows the same pattern as RestaurantService
    """

    # =========================================================
    # CREATE
    # =========================================================
    def create(
        self,
        db: Session,
        restaurant_id: int,
        data: MenuCategoryCreate,
        user: User,
    ) -> MenuCategory:

        # Global category → admin only
        if data.is_global:
            if not user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only admin can create global categories",
                )
            restaurant_id = None
        else:
            check_restaurant_access(restaurant_id, user, db)

        category = MenuCategory(
            restaurant_id=restaurant_id,
            name=data.name,
            description=data.description,
            display_order=data.display_order,
            is_active=data.is_active,
            is_global=data.is_global,
        )

        db.add(category)
        db.commit()
        db.refresh(category)

        return category
    # =========================================================
    # LIST
    # =========================================================
    def list(
        self,
        db: Session,
        restaurant_id: int,
    ) -> list[MenuCategory]:
        return (
            db.query(MenuCategory)
            .filter(
                MenuCategory.is_active.is_(True),
                (MenuCategory.restaurant_id == restaurant_id)
                | (MenuCategory.is_global.is_(True)),
            )
            .order_by(MenuCategory.display_order)
            .all()
        )

    # =========================================================
    # INTERNAL FETCH (USED BY UPDATE / DELETE)
    # =========================================================
    def _get_active_category(
        self,
        db: Session,
        category_id: int,
        user: User,
    ) -> MenuCategory:
        category = (
            db.query(MenuCategory)
            .filter(
                MenuCategory.id == category_id,
                MenuCategory.is_active.is_(True),
            )
            .first()
        )

        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Menu category not found",
            )

        if not category.is_global:
            check_restaurant_access(category.restaurant_id, user, db)

        return category

    # =========================================================
    # UPDATE
    # =========================================================
    def update(
        self,
        db: Session,
        category_id: int,
        data: MenuCategoryUpdate,
        user: User,
    ) -> MenuCategory:
        category = self._get_active_category(db, category_id, user)

        if category.is_global and not user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can update global categories",
            )

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(category, field, value)

        db.commit()
        db.refresh(category)
        return category

    # =========================================================
    # DELETE
    # =========================================================
    def delete(
        self,
        db: Session,
        category_id: int,
        user: User,
    ) -> None:
        category = self._get_active_category(db, category_id, user)

        if category.is_global and not user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can delete global categories",
            )

        category.is_active = False
        db.commit()
