"""
Application configuration using Pydantic settings
"""
from typing import List, Optional, Union
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables
    """
    # Project Info
    PROJECT_NAME: str = "DineBuddy"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    
    # Database
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "dinebuddy"
    DATABASE_URL: str = ""

        # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: Optional[str] = None

    
    # CORS - can be comma-separated string or list
    CORS_ORIGINS: Union[List[str], str] = "http://localhost:3000,http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Parse CORS_ORIGINS from comma-separated string or list"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    # JWT / Security (for future use)
    SECRET_KEY: str = "dev-secret-key-change-in-production-use-strong-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # AWS (for future deployment)
    AWS_REGION: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info) -> str:
        """
        Construct DATABASE_URL if not provided
        """
        if isinstance(v, str) and v:
            return v
        
        # Build from components
        data = info.data
        return (
            f"postgresql://{data.get('POSTGRES_USER')}:"
            f"{data.get('POSTGRES_PASSWORD')}@"
            f"{data.get('POSTGRES_HOST')}:"
            f"{data.get('POSTGRES_PORT')}/"
            f"{data.get('POSTGRES_DB')}"
        )
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "allow"
    }


settings = Settings()
