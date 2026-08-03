from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.user_restaurant_service import UserRestaurantService
from app.schemas.user_restaurant_schema import UserRestaurantCreate, UserRestaurantResponse
from app.models.user import User
from app.services.restaurant_service import RestaurantService

router = APIRouter(
    prefix="/user-restaurants",
    tags=["user_restaurant"]
)

user_restaurant_service = UserRestaurantService()
restaurant_service = RestaurantService()

@router.post("/", response_model=UserRestaurantResponse, status_code=status.HTTP_201_CREATED)
def assign_user_to_restaurant(
    payload: UserRestaurantCreate,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == payload.user_id).first()
    restaurant = restaurant_service.get_by_id(db, payload.restaurant_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    user_restaurant_service.assign_user_to_restaurant(
        db=db,
        user_id=payload.user_id,
        restaurant_id=payload.restaurant_id,
    )
    return UserRestaurantResponse(
        status=True,
        message="User assigned to restaurant successfully",
    )

@router.delete("/", response_model=UserRestaurantResponse)
def remove_user_from_restaurant(
    user_id: int,
    restaurant_id: int,
    db: Session = Depends(get_db),
):
    user_restaurant_service.remove_user_from_restaurant(
        db=db,
        user_id=user_id,
        restaurant_id=restaurant_id,
    )
    return UserRestaurantResponse(
        status=True,
        message="User removed from restaurant successfully",
    )
