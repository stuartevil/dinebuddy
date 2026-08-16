import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import engine
from app.db.base import Base
from app.api.v1.router import api_router

UPLOAD_BASE = os.getenv("UPLOAD_BASE", os.path.join(os.getcwd(), "uploads"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    print("🚀 Starting up DineBuddy backend...")
    print(f"📊 Database URL: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else 'Not configured'}")
    
    # Ensure upload directories exist
    os.makedirs(os.path.join(UPLOAD_BASE, "logos"), exist_ok=True)
    print(f"📁 Upload directory ready: {UPLOAD_BASE}")
    
    # Note: We use Alembic migrations for database schema management
    # Tables are created by running: alembic upgrade head
    # (handled automatically in docker-compose.yml startup command)
    
    yield
    
    # Shutdown
    print("👋 Shutting down DineBuddy backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Restaurant Management System API",
    version=settings.VERSION,
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Serve uploaded files as static assets
os.makedirs(UPLOAD_BASE, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOAD_BASE), name="static")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to DineBuddy API",
        "version": settings.VERSION,
        "docs": f"{settings.API_V1_PREFIX}/docs"
    }
