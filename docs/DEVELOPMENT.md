# 🛠️ Development Guide

Complete guide for building features in DineBuddy.

---

## 🏠 Local Setup

### Quick Start

```bash
# 1. Create environment
cp backend/.env.example backend/.env

# 2. Start services
docker-compose up -d

# 3. Verify
curl http://localhost:8000/api/v1/health
open http://localhost:8000/api/v1/docs
```

### Alternative: Local Python Setup

```bash
cd backend

# Virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start database only
docker-compose up -d db

# Update .env: POSTGRES_HOST=localhost

# Run app
uvicorn app.main:app --reload
```

---

## 🔄 Development Workflow

### Example: Restaurant Management Feature

#### 1. Create Model

```python
# backend/app/models/restaurant.py
from sqlalchemy import Column, String, Boolean, Text
from app.db.base import Base, IDMixin, TimestampMixin

class Restaurant(Base, IDMixin, TimestampMixin):
    __tablename__ = "restaurants"
    
    name = Column(String(255), nullable=False, index=True)
    address = Column(Text)
    phone = Column(String(20))
    email = Column(String(255))
    is_active = Column(Boolean, default=True)
```

#### 2. Import in Base (for Alembic)

```python
# backend/app/db/base.py
# Add at bottom:
from app.models.restaurant import Restaurant  # noqa
```

#### 3. Create Migration

```bash
docker-compose exec backend alembic revision --autogenerate -m "add restaurant table"
docker-compose exec backend alembic upgrade head

# Verify
docker-compose exec db psql -U postgres -d dinebuddy -c "\d restaurants"
```

#### 4. Create Schemas

```python
# backend/app/schemas/restaurant.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class RestaurantBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

class RestaurantCreate(RestaurantBase):
    pass

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None

class Restaurant(RestaurantBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

#### 5. Create Service

```python
# backend/app/services/restaurant_service.py
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.restaurant import Restaurant
from app.schemas.restaurant import RestaurantCreate, RestaurantUpdate

def get_restaurants(db: Session, skip: int = 0, limit: int = 100) -> List[Restaurant]:
    return db.query(Restaurant)\
        .filter(Restaurant.is_active == True)\
        .offset(skip).limit(limit).all()

def get_restaurant(db: Session, restaurant_id: int) -> Optional[Restaurant]:
    return db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()

def create_restaurant(db: Session, restaurant: RestaurantCreate) -> Restaurant:
    db_restaurant = Restaurant(**restaurant.model_dump())
    db.add(db_restaurant)
    db.commit()
    db.refresh(db_restaurant)
    return db_restaurant

def update_restaurant(
    db: Session, 
    restaurant_id: int, 
    restaurant_update: RestaurantUpdate
) -> Optional[Restaurant]:
    db_restaurant = get_restaurant(db, restaurant_id)
    if not db_restaurant:
        return None
    
    update_data = restaurant_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_restaurant, field, value)
    
    db.commit()
    db.refresh(db_restaurant)
    return db_restaurant

def delete_restaurant(db: Session, restaurant_id: int) -> bool:
    db_restaurant = get_restaurant(db, restaurant_id)
    if not db_restaurant:
        return False
    db_restaurant.is_active = False
    db.commit()
    return True
```

#### 6. Create Endpoints

```python
# backend/app/api/v1/endpoints/restaurants.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.restaurant import Restaurant, RestaurantCreate, RestaurantUpdate
from app.services import restaurant_service

router = APIRouter()

@router.get("/", response_model=List[Restaurant])
def list_restaurants(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return restaurant_service.get_restaurants(db, skip=skip, limit=limit)

@router.get("/{restaurant_id}", response_model=Restaurant)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = restaurant_service.get_restaurant(db, restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant

@router.post("/", response_model=Restaurant, status_code=status.HTTP_201_CREATED)
def create_restaurant(restaurant: RestaurantCreate, db: Session = Depends(get_db)):
    return restaurant_service.create_restaurant(db, restaurant)

@router.put("/{restaurant_id}", response_model=Restaurant)
def update_restaurant(
    restaurant_id: int,
    restaurant_update: RestaurantUpdate,
    db: Session = Depends(get_db)
):
    restaurant = restaurant_service.update_restaurant(db, restaurant_id, restaurant_update)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant

@router.delete("/{restaurant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    if not restaurant_service.delete_restaurant(db, restaurant_id):
        raise HTTPException(status_code=404, detail="Restaurant not found")
```

#### 7. Register Router

```python
# backend/app/api/v1/router.py
from app.api.v1.endpoints import health, restaurants

api_router.include_router(health.router, tags=["health"])
api_router.include_router(restaurants.router, prefix="/restaurants", tags=["restaurants"])
```

#### 8. Test

```bash
# Create
curl -X POST http://localhost:8000/api/v1/restaurants \
  -H "Content-Type: application/json" \
  -d '{"name": "Pizza Palace", "address": "123 Main St", "phone": "555-1234"}'

# List
curl http://localhost:8000/api/v1/restaurants

# Or use Swagger UI
open http://localhost:8000/api/v1/docs
```

---

## 🗄️ Database Migrations

### Create Migration

```bash
# After changing models
docker-compose exec backend alembic revision --autogenerate -m "description"
```

### Apply Migrations

```bash
# Upgrade to latest
docker-compose exec backend alembic upgrade head
```

### Rollback

```bash
# Downgrade one version
docker-compose exec backend alembic downgrade -1
```

### View History

```bash
docker-compose exec backend alembic history
docker-compose exec backend alembic current
```

---

## 💡 Best Practices

### Keep Endpoints Thin

```python
# ❌ Bad: Logic in endpoint
@router.post("/")
def create_restaurant(restaurant: RestaurantCreate, db: Session = Depends(get_db)):
    db_restaurant = Restaurant(**restaurant.model_dump())
    db.add(db_restaurant)
    db.commit()
    return db_restaurant

# ✅ Good: Logic in service
@router.post("/")
def create_restaurant(restaurant: RestaurantCreate, db: Session = Depends(get_db)):
    return restaurant_service.create_restaurant(db, restaurant)
```

### Use Type Hints

```python
def get_restaurant(db: Session, restaurant_id: int) -> Optional[Restaurant]:
    return db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
```

### Handle Errors

```python
@router.get("/{id}")
def get_restaurant(id: int, db: Session = Depends(get_db)):
    restaurant = restaurant_service.get_restaurant(db, id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Not found")
    return restaurant
```

### Validate with Pydantic

```python
from pydantic import BaseModel, Field, EmailStr

class RestaurantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    phone: str = Field(..., pattern=r'^\d{3}-\d{4}$')
```

### Soft Deletes

```python
# ✅ Good: Soft delete
def delete_restaurant(db: Session, id: int):
    restaurant.is_active = False
    db.commit()
```

---

## 🔧 Useful Commands

```bash
# Development
docker-compose up -d
docker-compose logs -f backend
docker-compose restart backend
docker-compose down

# Database
docker-compose exec backend alembic upgrade head
docker-compose exec db psql -U postgres -d dinebuddy

# Debugging
docker-compose exec backend python -c "from app.core.config import settings; print(settings.DATABASE_URL)"
docker-compose exec backend bash
```

---

## 🐛 Common Issues

### Import Errors

```python
# ❌ Bad
from models.restaurant import Restaurant

# ✅ Good
from app.models.restaurant import Restaurant
```

### Alembic Not Detecting Changes

Make sure models are imported in `app/db/base.py`:

```python
from app.models.restaurant import Restaurant  # noqa
```

### Database Connection

```bash
# Check if database is running
docker-compose ps db

# Test connection
docker-compose exec backend python -c "
from app.core.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    print('Connected!', conn.execute(text('SELECT 1')).fetchone())
"
```

---

## 📂 Code Organization

```
backend/app/
├── api/v1/
│   ├── endpoints/        # Keep thin, delegate to services
│   └── router.py
│
├── core/
│   ├── config.py        # Settings
│   └── database.py      # DB connection
│
├── models/              # SQLAlchemy models
│   └── restaurant.py
│
├── schemas/             # Pydantic schemas
│   └── restaurant.py
│
├── services/            # Business logic
│   └── restaurant_service.py
│
└── main.py
```

---

## 📚 Resources

- **FastAPI:** https://fastapi.tiangolo.com/
- **SQLAlchemy:** https://docs.sqlalchemy.org/
- **Alembic:** https://alembic.sqlalchemy.org/
- **Pydantic:** https://docs.pydantic.dev/

---

**Happy coding!** For deployment, see [AWS_LIGHTSAIL.md](AWS_LIGHTSAIL.md).
