"""
Integration tests for API: root endpoint and auth (no real DB required for these).
"""
import pytest
from unittest.mock import MagicMock

from app.core.database import get_db
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Default TestClient using real app (DB required for auth endpoints)."""
    return TestClient(app)


@pytest.fixture
def client_no_db():
    """
    TestClient with get_db overridden so no real DB is needed.
    Auth endpoints will see "no user found" and return 401.
    """
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_filter = MagicMock()
    mock_filter.first.return_value = None  # No user found
    mock_query.filter.return_value = mock_filter
    mock_db.query.return_value = mock_query

    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


class TestRootEndpoint:
    """Integration tests for GET /."""

    def test_root_returns_200(self, client: TestClient):
        """Root endpoint returns 200 OK."""
        response = client.get("/")
        assert response.status_code == 200

    def test_root_returns_welcome_message(self, client: TestClient):
        """Root response includes welcome message and version."""
        response = client.get("/")
        data = response.json()
        assert "message" in data
        assert "DineBuddy" in data.get("message", "")
        assert "version" in data
        assert "docs" in data


class TestAuthLoginEndpoint:
    """Integration tests for POST /api/v1/auth/login."""

    def test_login_with_invalid_credentials_returns_401(self, client_no_db: TestClient):
        """Login with unknown user returns 401 Unauthorized (no DB needed)."""
        response = client_no_db.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "wrong"},
        )
        assert response.status_code == 401

    def test_login_with_malformed_body_returns_422(self, client_no_db: TestClient):
        """Login with missing required fields returns 422."""
        response = client_no_db.post(
            "/api/v1/auth/login",
            json={"email": "only-email@example.com"},
        )
        assert response.status_code == 422
