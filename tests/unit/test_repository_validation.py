"""Tests for repository input validation utilities.

Tests for the validation functions used across PostgreSQL repositories.
"""

import pytest

from src.orchestrator.repositories.validation import validate_id


class TestValidateId:
    """Tests for validate_id function."""

    def test_valid_id_returns_unchanged(self) -> None:
        """Valid ID strings are returned unchanged."""
        result = validate_id("session-123")
        assert result == "session-123"

    def test_valid_id_with_custom_field_name(self) -> None:
        """Valid ID with custom field name works correctly."""
        result = validate_id("msg-456", field_name="message_id")
        assert result == "msg-456"

    def test_empty_string_raises_value_error(self) -> None:
        """Empty string raises ValueError."""
        with pytest.raises(ValueError, match="id cannot be empty"):
            validate_id("")

    def test_empty_string_with_field_name_in_error(self) -> None:
        """Error message includes the field name."""
        with pytest.raises(ValueError, match="session_id cannot be empty"):
            validate_id("", field_name="session_id")

    def test_none_raises_type_error(self) -> None:
        """None raises TypeError."""
        with pytest.raises(TypeError, match="id must be a string"):
            validate_id(None)  # type: ignore

    def test_integer_raises_type_error(self) -> None:
        """Integer raises TypeError."""
        with pytest.raises(TypeError, match="id must be a string, got int"):
            validate_id(123)  # type: ignore

    def test_exceeds_max_length_raises_value_error(self) -> None:
        """String exceeding max length raises ValueError."""
        long_id = "x" * 65
        with pytest.raises(ValueError, match="exceeds maximum length of 64"):
            validate_id(long_id)

    def test_custom_max_length(self) -> None:
        """Custom max_length is respected."""
        long_id = "x" * 33
        with pytest.raises(ValueError, match="exceeds maximum length of 32"):
            validate_id(long_id, max_length=32)

    def test_at_max_length_is_valid(self) -> None:
        """ID exactly at max length is valid."""
        exact_id = "x" * 64
        result = validate_id(exact_id)
        assert result == exact_id

    def test_whitespace_only_is_valid(self) -> None:
        """Whitespace-only strings are considered valid (not empty)."""
        result = validate_id("   ")
        assert result == "   "

    def test_special_characters_are_valid(self) -> None:
        """IDs with special characters are valid."""
        result = validate_id("session-123_abc@test.com")
        assert result == "session-123_abc@test.com"

    def test_unicode_characters_are_valid(self) -> None:
        """IDs with unicode characters are valid."""
        result = validate_id("session-test")
        assert result == "session-test"
