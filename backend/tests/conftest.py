"""
Shared pytest fixtures for unit and integration tests.
"""
import sys
from pathlib import Path

# Ensure app package is importable when running tests from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient for integration tests (uses real app and dependencies)."""
    return TestClient(app)

