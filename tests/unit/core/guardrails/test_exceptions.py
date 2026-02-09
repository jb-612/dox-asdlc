"""Unit tests for guardrails exception hierarchy.

Tests guardrails-specific exceptions, their inheritance chain,
and serialization via to_dict().
"""

from __future__ import annotations

import pytest

from src.core.exceptions import ASDLCError
from src.core.guardrails.exceptions import (
    GuardrailsError,
    GuidelineConflictError,
    GuidelineNotFoundError,
    GuidelineValidationError,
)


class TestGuardrailsError:
    """Tests for GuardrailsError base exception."""

    def test_inherits_from_asdlc_error(self) -> None:
        """GuardrailsError should inherit from ASDLCError."""
        error = GuardrailsError("guardrails failure")
        assert isinstance(error, ASDLCError)
        assert isinstance(error, Exception)

    def test_instantiation_with_message(self) -> None:
        """GuardrailsError should store message and default empty details."""
        error = GuardrailsError("something went wrong")
        assert error.message == "something went wrong"
        assert str(error) == "something went wrong"
        assert error.details == {}

    def test_instantiation_with_details(self) -> None:
        """GuardrailsError should accept optional details dict."""
        details = {"component": "evaluator", "action": "evaluate"}
        error = GuardrailsError("failure", details=details)
        assert error.message == "failure"
        assert error.details == details
        assert error.details["component"] == "evaluator"

    def test_to_dict(self) -> None:
        """GuardrailsError.to_dict() should return correct structure."""
        error = GuardrailsError("test error", details={"key": "value"})
        result = error.to_dict()

        assert result["error"] == "GuardrailsError"
        assert result["message"] == "test error"
        assert result["details"] == {"key": "value"}

    def test_to_dict_without_details(self) -> None:
        """GuardrailsError.to_dict() should include empty details when none given."""
        error = GuardrailsError("minimal")
        result = error.to_dict()

        assert result["error"] == "GuardrailsError"
        assert result["message"] == "minimal"
        assert result["details"] == {}


class TestGuidelineNotFoundError:
    """Tests for GuidelineNotFoundError."""

    def test_inherits_from_guardrails_error(self) -> None:
        """GuidelineNotFoundError should inherit from GuardrailsError."""
        error = GuidelineNotFoundError("guideline-abc-123")
        assert isinstance(error, GuardrailsError)
        assert isinstance(error, ASDLCError)
        assert isinstance(error, Exception)

    def test_message_includes_guideline_id(self) -> None:
        """GuidelineNotFoundError message should include the guideline ID."""
        error = GuidelineNotFoundError("guideline-abc-123")
        assert "guideline-abc-123" in error.message
        assert "not found" in error.message.lower()

    def test_details_include_guideline_id(self) -> None:
        """GuidelineNotFoundError details should contain guideline_id."""
        error = GuidelineNotFoundError("guideline-abc-123")
        assert error.details["guideline_id"] == "guideline-abc-123"

    def test_to_dict(self) -> None:
        """GuidelineNotFoundError.to_dict() should include correct fields."""
        error = GuidelineNotFoundError("g-42")
        result = error.to_dict()

        assert result["error"] == "GuidelineNotFoundError"
        assert "g-42" in result["message"]
        assert result["details"]["guideline_id"] == "g-42"

    def test_can_be_caught_as_guardrails_error(self) -> None:
        """GuidelineNotFoundError should be catchable as GuardrailsError."""
        with pytest.raises(GuardrailsError):
            raise GuidelineNotFoundError("some-id")

    def test_can_be_caught_as_asdlc_error(self) -> None:
        """GuidelineNotFoundError should be catchable as ASDLCError."""
        with pytest.raises(ASDLCError):
            raise GuidelineNotFoundError("some-id")


class TestGuidelineValidationError:
    """Tests for GuidelineValidationError."""

    def test_inherits_from_guardrails_error(self) -> None:
        """GuidelineValidationError should inherit from GuardrailsError."""
        error = GuidelineValidationError("invalid data")
        assert isinstance(error, GuardrailsError)
        assert isinstance(error, ASDLCError)
        assert isinstance(error, Exception)

    def test_message_only(self) -> None:
        """GuidelineValidationError should work with just a message."""
        error = GuidelineValidationError("Name is required")
        assert error.message == "Name is required"
        assert error.details == {}

    def test_with_field(self) -> None:
        """GuidelineValidationError should include field in details when provided."""
        error = GuidelineValidationError("Priority must be 0-1000", field="priority")
        assert error.message == "Priority must be 0-1000"
        assert error.details["field"] == "priority"

    def test_without_field(self) -> None:
        """GuidelineValidationError should omit field from details when not provided."""
        error = GuidelineValidationError("General validation error")
        assert "field" not in error.details

    def test_to_dict_with_field(self) -> None:
        """GuidelineValidationError.to_dict() should include field when provided."""
        error = GuidelineValidationError("Invalid value", field="category")
        result = error.to_dict()

        assert result["error"] == "GuidelineValidationError"
        assert result["message"] == "Invalid value"
        assert result["details"]["field"] == "category"

    def test_to_dict_without_field(self) -> None:
        """GuidelineValidationError.to_dict() should have empty details without field."""
        error = GuidelineValidationError("Something is wrong")
        result = error.to_dict()

        assert result["error"] == "GuidelineValidationError"
        assert result["message"] == "Something is wrong"
        assert result["details"] == {}

    def test_can_be_caught_as_guardrails_error(self) -> None:
        """GuidelineValidationError should be catchable as GuardrailsError."""
        with pytest.raises(GuardrailsError):
            raise GuidelineValidationError("bad data")

    def test_can_be_caught_as_asdlc_error(self) -> None:
        """GuidelineValidationError should be catchable as ASDLCError."""
        with pytest.raises(ASDLCError):
            raise GuidelineValidationError("bad data")


class TestGuidelineConflictError:
    """Tests for GuidelineConflictError (optimistic locking)."""

    def test_inherits_from_guardrails_error(self) -> None:
        """GuidelineConflictError should inherit from GuardrailsError."""
        error = GuidelineConflictError("g-1", expected_version=2, actual_version=3)
        assert isinstance(error, GuardrailsError)
        assert isinstance(error, ASDLCError)
        assert isinstance(error, Exception)

    def test_message_includes_version_info(self) -> None:
        """GuidelineConflictError message should describe the version conflict."""
        error = GuidelineConflictError("g-1", expected_version=2, actual_version=5)
        assert "g-1" in error.message
        assert "2" in error.message
        assert "5" in error.message

    def test_details_include_all_version_info(self) -> None:
        """GuidelineConflictError details should contain all conflict metadata."""
        error = GuidelineConflictError("g-42", expected_version=1, actual_version=3)
        assert error.details["guideline_id"] == "g-42"
        assert error.details["expected_version"] == 1
        assert error.details["actual_version"] == 3

    def test_to_dict(self) -> None:
        """GuidelineConflictError.to_dict() should include all conflict fields."""
        error = GuidelineConflictError("g-99", expected_version=10, actual_version=11)
        result = error.to_dict()

        assert result["error"] == "GuidelineConflictError"
        assert "g-99" in result["message"]
        assert result["details"]["guideline_id"] == "g-99"
        assert result["details"]["expected_version"] == 10
        assert result["details"]["actual_version"] == 11

    def test_can_be_caught_as_guardrails_error(self) -> None:
        """GuidelineConflictError should be catchable as GuardrailsError."""
        with pytest.raises(GuardrailsError):
            raise GuidelineConflictError("id", expected_version=1, actual_version=2)

    def test_can_be_caught_as_asdlc_error(self) -> None:
        """GuidelineConflictError should be catchable as ASDLCError."""
        with pytest.raises(ASDLCError):
            raise GuidelineConflictError("id", expected_version=1, actual_version=2)


class TestGuardrailsExceptionHierarchy:
    """Tests for the overall guardrails exception hierarchy."""

    def test_hierarchy_chain(self) -> None:
        """All guardrails exceptions should form correct inheritance chain."""
        # GuardrailsError -> ASDLCError -> Exception
        assert issubclass(GuardrailsError, ASDLCError)
        assert issubclass(GuardrailsError, Exception)

        # Specific errors -> GuardrailsError
        assert issubclass(GuidelineNotFoundError, GuardrailsError)
        assert issubclass(GuidelineValidationError, GuardrailsError)
        assert issubclass(GuidelineConflictError, GuardrailsError)

    def test_all_exceptions_have_to_dict(self) -> None:
        """All guardrails exceptions should support to_dict() serialization."""
        exceptions = [
            GuardrailsError("test"),
            GuidelineNotFoundError("id-1"),
            GuidelineValidationError("bad"),
            GuidelineConflictError("id-1", expected_version=1, actual_version=2),
        ]

        for exc in exceptions:
            result = exc.to_dict()
            assert "error" in result
            assert "message" in result
            assert "details" in result

    def test_all_exceptions_catchable_as_asdlc_error(self) -> None:
        """All guardrails exceptions should be catchable as ASDLCError."""
        exceptions_to_raise = [
            GuardrailsError("test"),
            GuidelineNotFoundError("id-1"),
            GuidelineValidationError("bad"),
            GuidelineConflictError("id-1", expected_version=1, actual_version=2),
        ]

        for exc in exceptions_to_raise:
            with pytest.raises(ASDLCError):
                raise exc
