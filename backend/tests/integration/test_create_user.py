"""
Integration tests for POST /api/v1/users/ (create user endpoint).
Requires a real DB when run (e.g. in Docker with make test).
"""
import pytest
from uuid import uuid4

from app.core.database import SessionLocal, get_db
from app.core.dependencies import get_current_user
from app.main import app
from app.models.user import User, UserRole
from app.core.security import hash_password
from fastapi.testclient import TestClient


# Fixed admin user used for create-user tests (reused across runs)
CREATE_USER_ADMIN_EMAIL = "admin-createuser@test.com"


@pytest.fixture
def client_with_admin():
    """
    TestClient with get_db and get_current_user overridden so an admin user
    is the current user. Uses real DB: ensures an admin exists, then overrides
    dependencies so POST /api/v1/users/ runs as that admin.
    """
    session = SessionLocal()
    admin = session.query(User).filter(User.email == CREATE_USER_ADMIN_EMAIL).first()
    if not admin:
        admin = User(
            email=CREATE_USER_ADMIN_EMAIL,
            full_name="Admin for create user tests",
            password_hash=hash_password("admin-secret"),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=False,
        )
        session.add(admin)
        session.commit()
        session.refresh(admin)

    def override_get_db():
        try:
            yield session
        finally:
            pass  # do not close; fixture owns session

    def override_get_current_user():
        return admin

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        session.close()


class TestCreateUserEndpoint:
    """Integration tests for POST /api/v1/users/."""

    def test_create_user_as_admin_returns_201(self, client_with_admin: TestClient):
        """Admin can create a new user; response is 201 with user fields."""
        unique = uuid4().hex[:8]
        payload = {
            "email": f"newstaff-{unique}@example.com",
            "full_name": "New Staff User",
            "password": "secure-password-1",
            "role": "restaurant_staff",
        }
        response = client_with_admin.post("/api/v1/users/", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == payload["email"]
        assert data["full_name"] == payload["full_name"]
        assert data["role"] == "restaurant_staff"
        assert data["is_active"] is True
        assert "id" in data
        assert "password" not in data

    def test_create_user_duplicate_email_returns_400(self, client_with_admin: TestClient):
        """Creating a user with an email that already exists returns 400."""
        unique = uuid4().hex[:8]
        email = f"duplicate-{unique}@example.com"
        payload = {
            "email": email,
            "full_name": "First",
            "password": "pass1",
            "role": "restaurant_staff",
        }
        first = client_with_admin.post("/api/v1/users/", json=payload)
        assert first.status_code == 201

        second_payload = {**payload, "full_name": "Second"}
        second = client_with_admin.post("/api/v1/users/", json=second_payload)
        assert second.status_code == 400
        assert "email" in second.json().get("detail", "").lower() or "already" in second.json().get("detail", "").lower()
