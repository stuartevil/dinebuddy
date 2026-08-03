from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.models.user import User, UserRole
from app.models.user_restaurant_map import UserRestaurant
from app.models.restaurant import Restaurant
from app.utils.slug_generator import generate_unique_slug
from app.utils.validators import validate_business_hours_format
from app.core.security import hash_password


class RestaurantService:

    @staticmethod
    def validate_business_hours(business_hours: dict | None) -> dict | None:
        """
        Validate business hours format (service-level validation).
        Raises HTTPException for FastAPI error handling.
        """
        try:
            return validate_business_hours_format(business_hours)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

    def create(self, db: Session, payload):
        # Validate business_hours format
        validated_business_hours = self.validate_business_hours(payload.business_hours)
        
        slug = generate_unique_slug(db, payload.name)

        restaurant = Restaurant(
            name=payload.name,
            slug=slug,
            address=payload.address,
            phone=payload.phone,
            email=payload.email,
            logo_url=payload.logo_url,
            timezone=payload.timezone,
            currency=payload.currency,
            business_hours=validated_business_hours,
            description=payload.description,
            cuisine_type=payload.cuisine_type,
            is_active=True
        )

        db.add(restaurant)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Restaurant with this name or slug already exists"
            )

        db.refresh(restaurant)

        # 👑 Auto-create and link Restaurant Admin User if owner details provided
        owner_email = getattr(payload, 'owner_email', None)
        if owner_email:
            owner_email = owner_email.strip().lower()
            owner_user = db.query(User).filter(User.email == owner_email).first()

            if not owner_user:
                raw_password = getattr(payload, 'owner_password', None) or "Owner@123"
                hashed_pass = hash_password(raw_password)
                owner_name = getattr(payload, 'owner_name', None) or f"{payload.name} Owner"

                owner_user = User(
                    email=owner_email,
                    full_name=owner_name,
                    password_hash=hashed_pass,
                    role=UserRole.RESTAURANT_ADMIN,
                    is_active=True,
                    is_verified=True,
                )
                db.add(owner_user)
                db.commit()
                db.refresh(owner_user)

            # Link owner to restaurant
            existing_map = (
                db.query(UserRestaurant)
                .filter(
                    UserRestaurant.user_id == owner_user.id,
                    UserRestaurant.restaurant_id == restaurant.id
                )
                .first()
            )
            if not existing_map:
                user_map = UserRestaurant(
                    user_id=owner_user.id,
                    restaurant_id=restaurant.id
                )
                db.add(user_map)
                db.commit()

        return restaurant

    def get_all(
        self,
        db: Session,
        user: User,
        skip: int = 0,
        limit: int = 10,
        is_active: bool | None = None,
        search: str | None = None,
    ):
        query = db.query(Restaurant)

        # 🔐 STAFF: only their restaurants
        if not user.is_admin:
            query = query.join(Restaurant.users).filter(
                User.id == user.id
            )

        if is_active is not None:
            query = query.filter(Restaurant.is_active == is_active)

        if search:
            query = query.filter(Restaurant.name.ilike(f"%{search}%"))

        total = query.count()

        restaurants = (
            query
            .order_by(Restaurant.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return restaurants, total


    def get_by_id(self, db: Session, restaurant_id: int):
        return (
            db.query(Restaurant)
            .filter(Restaurant.id == restaurant_id)
            .first()
        )

    def update(self, db: Session, restaurant_id: int, payload):
        restaurant = self.get_by_id(db, restaurant_id)
        if not restaurant:
            return None

        data = payload.model_dump(exclude_unset=True)


        # Validate business_hours if it's being updated
        if "business_hours" in data:
            data["business_hours"] = self.validate_business_hours(data["business_hours"])

        # Regenerate slug only if name changes
        if "name" in data:
            restaurant.name = data["name"]
            restaurant.slug = generate_unique_slug(
                db,
                data["name"],
                exclude_id=restaurant.id
            )

        for key, value in data.items():
            if key != "name":
                setattr(restaurant, key, value)

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Restaurant with this name or slug already exists"
            )

        db.refresh(restaurant)
        return restaurant

    def delete(self, db: Session, restaurant_id: int):
        restaurant = self.get_by_id(db, restaurant_id)
        if not restaurant:
            return False

        db.delete(restaurant)
        db.commit()
        return True

    def add_staff(
        self,
        db: Session,
        restaurant_id: int,
        staff_user_id: int,
    ):
        """Assign a staff user to a restaurant."""
        restaurant = self.get_by_id(db, restaurant_id)
        if not restaurant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant not found",
            )

        staff_user = db.query(User).filter(User.id == staff_user_id).first()
        if not staff_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Automatically update user's role to RESTAURANT_STAFF if not already
        if staff_user.role != UserRole.RESTAURANT_STAFF:
            staff_user.role = UserRole.RESTAURANT_STAFF

        # Check existing mapping
        existing = (
            db.query(UserRestaurant)
            .filter(
                UserRestaurant.user_id == staff_user_id,
                UserRestaurant.restaurant_id == restaurant_id,
            )
            .first()
        )
        if existing:
            # If role was updated, commit that change
            db.commit()
            return restaurant  # Already assigned; idempotent

        # Create mapping in user_restaurants_map table
        mapping = UserRestaurant(
            user_id=staff_user_id,
            restaurant_id=restaurant_id,
        )
        db.add(mapping)
        db.commit()  # Commit both role update (if any) and mapping together
        return restaurant
