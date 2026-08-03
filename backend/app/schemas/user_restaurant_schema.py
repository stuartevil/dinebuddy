from pydantic import BaseModel

class UserRestaurantCreate(BaseModel):
    user_id: int
    restaurant_id: int


class UserRestaurantResponse(BaseModel):
    status: bool
    message: str
