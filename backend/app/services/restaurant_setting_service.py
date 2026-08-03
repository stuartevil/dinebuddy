from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.restaurant_settings import RestaurantSettings
from app.models.restaurant import Restaurant


class RestaurantSettingsService:

    def get_by_restaurant_id(
        self,
        db: Session,
        restaurant_id: int,
    ) -> RestaurantSettings | None:
        return (
            db.query(RestaurantSettings)
            .filter(RestaurantSettings.restaurant_id == restaurant_id)
            .first()
        )

    def create_default(
        self,
        db: Session,
        restaurant_id: int,
    ) -> RestaurantSettings:
        """
        Create default settings for a restaurant.
        Called when restaurant is created or first accessed.
        """

        # Ensure restaurant exists
        restaurant = (
            db.query(Restaurant)
            .filter(Restaurant.id == restaurant_id)
            .first()
        )

        if not restaurant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant not found",
            )

        settings = RestaurantSettings(
            restaurant_id=restaurant_id,
            auto_accept_orders=False,
        )

        db.add(settings)
        db.commit()
        db.refresh(settings)

        return settings

    def get_or_create(
        self,
        db: Session,
        restaurant_id: int,
    ) -> RestaurantSettings:
        """
        Fetch settings or create them if they don't exist.
        """

        settings = self.get_by_restaurant_id(db, restaurant_id)
        if settings:
            return settings

        return self.create_default(db, restaurant_id)

    def update(
        self,
        db: Session,
        restaurant_id: int,
        payload,
    ) -> RestaurantSettings:
        """
        Partial update of restaurant settings.
        """

        settings = self.get_or_create(db, restaurant_id)

        data = payload.model_dump(exclude_unset=True)

        for key, value in data.items():
            setattr(settings, key, value)

        db.commit()
        db.refresh(settings)

        return settings

