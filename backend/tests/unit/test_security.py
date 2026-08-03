"""
Unit tests for app.core.security (password hashing and verification).
"""
import pytest

from app.core.security import hash_password, verify_password


class TestHashPassword:
    """Tests for hash_password()."""

    def test_returns_non_empty_string(self):
        """Hashed password should be a non-empty string."""
        result = hash_password("my-secret-password")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_same_password_produces_different_hashes(self):
        """Bcrypt uses a salt, so same password should yield different hashes."""
        h1 = hash_password("same-password")
        h2 = hash_password("same-password")
        assert h1 != h2

    def test_hash_is_not_plain_password(self):
        """Hash must not equal the raw password."""
        password = "super-secret"
        hashed = hash_password(password)
        assert hashed != password

    def test_empty_string_is_hashed(self):
        """Empty string can be hashed (edge case)."""
        result = hash_password("")
        assert isinstance(result, str)
        assert len(result) > 0


class TestVerifyPassword:
    """Tests for verify_password()."""

    def test_correct_password_returns_true(self):
        """Verifying the correct password against its hash returns True."""
        password = "correct-horse-battery-staple"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_wrong_password_returns_false(self):
        """Verifying a wrong password returns False."""
        hashed = hash_password("actual-password")
        assert verify_password("wrong-password", hashed) is False

    def test_empty_password_against_real_hash_returns_false(self):
        """Empty string verification against a non-empty password hash is False."""
        hashed = hash_password("something")
        assert verify_password("", hashed) is False

    def test_roundtrip_multiple_passwords(self):
        """Multiple different passwords hash and verify correctly."""
        passwords = ["alpha", "beta", "unicode-日本語", " spaces "]
        for pwd in passwords:
            hashed = hash_password(pwd)
            assert verify_password(pwd, hashed) is True
            assert verify_password(pwd + "x", hashed) is False
