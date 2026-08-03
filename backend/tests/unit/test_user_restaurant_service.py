"""
Unit tests for UserRestaurantService.assign_user_to_restaurant.
"""
import pytest
from unittest.mock import MagicMock
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from app.services.user_restaurant_service import UserRestaurantService


class TestAssignUserToRestaurant:
    """Tests for assign_user_to_restaurant()."""

    @pytest.fixture
    def service(self):
        return UserRestaurantService()

    def test_assign_user_to_restaurant_success(self, service: UserRestaurantService):
        """Assigning a user to a restaurant adds the mapping and returns True."""
        db = MagicMock()
        user_id = 1
        restaurant_id = 10

        result = service.assign_user_to_restaurant(db, user_id=user_id, restaurant_id=restaurant_id)

        assert result is True
        db.add.assert_called_once()
        call_args = db.add.call_args[0][0]
        assert call_args.user_id == user_id
        assert call_args.restaurant_id == restaurant_id
        db.commit.assert_called_once()

    def test_assign_user_to_restaurant_duplicate_raises_400(self, service: UserRestaurantService):
        """Assigning the same user to the same restaurant again raises HTTP 400."""
        db = MagicMock()
        db.commit.side_effect = IntegrityError("stmt", "params", "orig")

        with pytest.raises(HTTPException) as exc_info:
            service.assign_user_to_restaurant(db, user_id=1, restaurant_id=10)

        assert exc_info.value.status_code == 400
        assert "already assigned" in exc_info.value.detail.lower() or "invalid" in exc_info.value.detail.lower()
        db.rollback.assert_called_once()
