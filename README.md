# 🍽️ DineBuddy - Restaurant Management System

A modern backend platform for managing restaurant operations built with FastAPI, SQLAlchemy, and PostgreSQL.

---

## 🚀 Quick Start (5 Minutes)

### Local Development

```bash
# 1. Setup environment
cd backend
cp .env.example .env

# 2. Start everything
cd ..
docker-compose up -d

# 3. Test
curl http://localhost:8000/api/v1/health
open http://localhost:8000/api/v1/docs
```

**Done!** Your local dev environment is ready. 🎉

---

## 📖 Documentation

### Getting Started
- **[Quick Start](#-quick-start-5-minutes)** ← You are here
- **[Development Guide](docs/DEVELOPMENT.md)** - Add features, models, APIs

### Deployment  
- **[AWS Lightsail Guide](docs/AWS_LIGHTSAIL.md)** - Deploy for $5/month

---

## 📁 Project Structure

```
DineBuddy/
├── backend/
│   ├── app/
│   │   ├── api/v1/           # API endpoints
│   │   │   └── endpoints/    # Health check (add more here)
│   │   ├── core/             # Config & database
│   │   ├── models/           # SQLAlchemy models (add your models)
│   │   ├── schemas/          # Pydantic schemas (add your schemas)
│   │   ├── services/         # Business logic (add your services)
│   │   └── main.py           # FastAPI app
│   ├── alembic/              # Database migrations
│   ├── requirements.txt      # Dependencies
│   └── Dockerfile
│
├── docs/
│   ├── DEVELOPMENT.md        # How to build features
│   └── AWS_LIGHTSAIL.md      # How to deploy ($5/month)
│
├── scripts/
│   └── deploy_lightsail.sh  # Automated deployment
│
└── docker-compose.yml        # Local development
```

---

## 🛠️ Common Commands

```bash
# Local Development
docker-compose up -d              # Start services
docker-compose logs -f backend    # View logs
docker-compose down               # Stop services

# Database Migrations
docker-compose exec backend alembic revision --autogenerate -m "description"
docker-compose exec backend alembic upgrade head
docker-compose exec backend alembic downgrade -1

# Database Access
docker-compose exec db psql -U postgres -d dinebuddy

# Or use Make shortcuts
make up              # Start services
make down            # Stop services  
make logs            # View logs
make db-migrate      # Create migration
make db-upgrade      # Apply migrations
```

---

## 🧪 Testing

Tests use **pytest** and run the same way for everyone (you and your colleague) via **Make** or **Docker**.

### Run tests on any system (recommended)

From the **repo root**, with Docker (no local Python or `pip install` needed):

```bash
make up              # Start DB + backend (once)
make test            # Run all tests inside the backend container
make test-unit       # Unit tests only
make test-integration # Integration tests only
```

The backend container uses **Python 3.11**, so `psycopg2-binary` and everything else install cleanly. This works on any machine that has Docker and Make.

### Run tests locally (optional)

If you prefer to run pytest on your host (e.g. in your IDE):

1. Use **Python 3.11 or 3.12** so `psycopg2-binary` has pre-built wheels (avoids `pg_config` issues). The repo has a `.python-version` file (3.12) for **pyenv** users.
2. From repo root: `make test-local` (creates `backend/.venv` if needed, installs deps, runs pytest).
3. Or manually:
   ```bash
   cd backend
   python3.12 -m venv .venv   # or python3.11
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   pytest tests/ -v
   ```

**Backend** supports Python **3.11–3.13** (`pyproject.toml`: `requires-python = ">=3.11,<3.14"`). Python 3.14+ may require installing `libpq` for `psycopg2-binary`; using 3.11/3.12 avoids that.

---

## 🔧 Add Your First Feature

Quick example: Add a Restaurant model

### 1. Create Model

```python
# backend/app/models/restaurant.py
from sqlalchemy import Column, String, Boolean
from app.db.base import Base, IDMixin, TimestampMixin

class Restaurant(Base, IDMixin, TimestampMixin):
    __tablename__ = "restaurants"
    
    name = Column(String(255), nullable=False)
    address = Column(String)
    is_active = Column(Boolean, default=True)
```

### 2. Create Migration

```bash
# Import model in app/db/base.py first
echo "from app.models.restaurant import Restaurant  # noqa" >> backend/app/db/base.py

# Create and apply migration
docker-compose exec backend alembic revision --autogenerate -m "add restaurant"
docker-compose exec backend alembic upgrade head
```

### 3. Create Schema

```python
# backend/app/schemas/restaurant.py
from pydantic import BaseModel

class RestaurantCreate(BaseModel):
    name: str
    address: str | None = None

class Restaurant(RestaurantCreate):
    id: int
    is_active: bool
    
    class Config:
        from_attributes = True
```

### 4. Create Endpoint

```python
# backend/app/api/v1/endpoints/restaurants.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.restaurant import Restaurant
from app.schemas.restaurant import RestaurantCreate

router = APIRouter()

@router.post("/", response_model=Restaurant)
def create_restaurant(restaurant: RestaurantCreate, db: Session = Depends(get_db)):
    db_restaurant = Restaurant(**restaurant.model_dump())
    db.add(db_restaurant)
    db.commit()
    db.refresh(db_restaurant)
    return db_restaurant
```

### 5. Register Router

```python
# backend/app/api/v1/router.py
from app.api.v1.endpoints import health, restaurants

api_router.include_router(health.router, tags=["health"])
api_router.include_router(restaurants.router, prefix="/restaurants", tags=["restaurants"])
```

### 6. Test

```bash
curl -X POST http://localhost:8000/api/v1/restaurants \
  -H "Content-Type: application/json" \
  -d '{"name": "Pizza Palace", "address": "123 Main St"}'
```

**For complete examples:** See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

---

## ☁️ Deploy to AWS ($5/month)

### AWS Lightsail Setup

```bash
# 1. Create Lightsail instance (via AWS Console)
#    - Choose Ubuntu 22.04
#    - Choose $5/month plan
#    - https://lightsail.aws.amazon.com/

# 2. SSH into your instance
ssh -i your-key.pem ubuntu@YOUR_INSTANCE_IP

# 3. Clone and deploy
git clone YOUR_REPO_URL DineBuddy
cd DineBuddy
./scripts/deploy_lightsail.sh

# Done! Your API is live at http://YOUR_IP:8000
```

**Full guide:** [docs/AWS_LIGHTSAIL.md](docs/AWS_LIGHTSAIL.md)

---

## 🔐 Environment Variables

### Local (.env file)
```bash
ENVIRONMENT=development
POSTGRES_HOST=db              # Docker service name
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=dinebuddy
SECRET_KEY=local-dev-key
```

### Production (Lightsail)
```bash
ENVIRONMENT=production
POSTGRES_HOST=db              # Still using Docker
POSTGRES_USER=postgres
POSTGRES_PASSWORD=strong-random-password
POSTGRES_DB=dinebuddy
SECRET_KEY=strong-random-key  # Generate: python -c "import secrets; print(secrets.token_urlsafe(32))"
```

The deployment script generates these automatically.

---

## 🏗️ Tech Stack

- **Backend:** FastAPI 0.109 + Python 3.11
- **Database:** PostgreSQL 15 + SQLAlchemy 2.0
- **Migrations:** Alembic 1.13
- **Deployment:** Docker + AWS Lightsail
- **Cost:** $5/month

---

## 📊 What's Included

### ✅ Already Setup
- FastAPI with auto-generated docs
- PostgreSQL database with Alembic migrations
- Docker Compose for local development
- Health check endpoints
- Environment configuration
- AWS Lightsail deployment script
- Makefile for common tasks

### 🔨 Ready to Add
- User authentication (JWT)
- Restaurant management
- Menu management
- Order processing
- Kitchen operations
- Analytics & reporting

---

## 🐛 Troubleshooting

### Port already in use
```bash
lsof -ti:8000 | xargs kill -9
```

### Database connection failed
```bash
docker-compose restart db
docker-compose logs db
```

### Clean restart
```bash
docker-compose down -v
docker-compose up -d
```

### Migration issues
```bash
# Reset database (WARNING: deletes data)
docker-compose down -v
docker-compose up -d
docker-compose exec backend alembic upgrade head
```

### pip install fails on `psycopg2-binary` (pg_config not found)
If pip is building `psycopg2-binary` from source and fails with **"pg_config executable not found"**, install the PostgreSQL client so the build can find headers and libs:

```bash
# macOS (Homebrew)
brew install libpq
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"   # Apple Silicon
# export PATH="/usr/local/opt/libpq/bin:$PATH"    # Intel

# Then retry
pip install -r requirements.txt
```

To make the PATH change permanent, add the `export` line to your `~/.zshrc` or `~/.bash_profile`. Alternatively, install a pre-built wheel from PyPI first: `pip install psycopg2-binary` (then install the rest of your requirements).

---

## 💰 Cost

### Local Development
```
Free (runs on your machine)
```

### Production (AWS Lightsail)
```
Lightsail $5/month includes:
- 1 vCPU, 1 GB RAM
- 40 GB SSD storage
- PostgreSQL in Docker (free)
- Backend API
- Static IP
- 2 TB monthly transfer

Total: $5/month = $60/year
```

---

## 📚 Learn More

- **[Development Guide](docs/DEVELOPMENT.md)** - Complete development workflow
- **[AWS Lightsail Deployment](docs/AWS_LIGHTSAIL.md)** - Production deployment
- **[API Docs](http://localhost:8000/api/v1/docs)** - Interactive API documentation (when running)
- **[FastAPI](https://fastapi.tiangolo.com/)** - Framework documentation
- **[SQLAlchemy](https://docs.sqlalchemy.org/)** - ORM documentation

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/restaurant-management`
2. Make changes
3. Test locally: `docker-compose up -d`
4. Commit: `git commit -m "Add restaurant management"`
5. Push: `git push origin feature/restaurant-management`

---

## 📄 License

MIT License

---

**Built with ❤️ using FastAPI, SQLAlchemy, PostgreSQL, and Docker**

Questions? Check [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) or the [API docs](http://localhost:8000/api/v1/docs).

