"""Guardrails-specific exceptions.

All exceptions inherit from GuardrailsError, which inherits from ASDLCError,
ensuring consistent error handling across the guardrails subsystem.
"""

from __future__ import annotations

from src.core.exceptions import ASDLCError


class GuardrailsError(ASDLCError):
    """Base exception for all guardrails errors."""


class GuidelineNotFoundError(GuardrailsError):
    """Raised when a guideline is not found."""

    def __init__(self, guideline_id: str) -> None:
        super().__init__(
            message=f"Guideline not found: {guideline_id}",
            details={"guideline_id": guideline_id},
        )


class GuidelineValidationError(GuardrailsError):
    """Raised when guideline data is invalid."""

    def __init__(self, message: str, field: str | None = None) -> None:
        details: dict = {}
        if field:
            details["field"] = field
        super().__init__(message=message, details=details)


class GuidelineConflictError(GuardrailsError):
    """Raised on version conflict during update (optimistic locking)."""

    def __init__(
        self,
        guideline_id: str,
        expected_version: int,
        actual_version: int,
    ) -> None:
        super().__init__(
            message=(
                f"Version conflict for guideline {guideline_id}: "
                f"expected {expected_version}, got {actual_version}"
            ),
            details={
                "guideline_id": guideline_id,
                "expected_version": expected_version,
                "actual_version": actual_version,
            },
        )
