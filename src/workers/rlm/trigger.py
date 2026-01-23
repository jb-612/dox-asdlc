"""RLM trigger detection for determining when to use RLM mode.

Analyzes task context to decide if RLM exploration should be triggered.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class TriggerReason(Enum):
    """Reasons for triggering RLM mode."""

    LARGE_CONTEXT = "large_context"
    MULTI_FILE_DEPENDENCY = "multi_file_dependency"
    DEBUGGER_FAIL_COUNT = "debugger_fail_count"
    EXPLICIT_REQUEST = "explicit_request"
    COMPLEX_QUERY = "complex_query"
    NONE = "none"


@dataclass
class TriggerResult:
    """Result from trigger detection.

    Attributes:
        should_trigger: Whether RLM mode should be activated
        reason: Primary reason for triggering (or NONE)
        all_reasons: All matching trigger reasons
        details: Additional details about the trigger decision
        confidence: Confidence in the trigger decision (0.0-1.0)
    """

    should_trigger: bool
    reason: TriggerReason
    all_reasons: list[TriggerReason]
    details: dict[str, Any]
    confidence: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "should_trigger": self.should_trigger,
            "reason": self.reason.value,
            "all_reasons": [r.value for r in self.all_reasons],
            "details": self.details,
            "confidence": self.confidence,
        }


@dataclass
class RLMTriggerDetector:
    """Detects when RLM mode should be triggered.

    Analyzes task context against configurable thresholds to determine
    if RLM exploration would be beneficial.

    Attributes:
        context_threshold: Token count threshold for large context
        fail_count_threshold: Debugger fail count before triggering
        multi_file_threshold: Number of files that indicates multi-file task
        complex_query_keywords: Keywords indicating complex queries

    Example:
        detector = RLMTriggerDetector(
            context_threshold=100_000,
            fail_count_threshold=4,
        )

        result = detector.check(
            context_tokens=150_000,
            query="How does the authentication system work?",
        )

        if result.should_trigger:
            # Use RLM mode
            pass
    """

    context_threshold: int = 100_000
    fail_count_threshold: int = 4
    multi_file_threshold: int = 10
    complex_query_keywords: list[str] | None = None

    def __post_init__(self) -> None:
        """Initialize default complex query keywords."""
        if self.complex_query_keywords is None:
            self.complex_query_keywords = [
                "how does",
                "explain the",
                "architecture",
                "flow",
                "trace",
                "all usages",
                "dependencies",
                "relationship between",
                "impact of",
                "refactor",
            ]

    def check(
        self,
        context_tokens: int = 0,
        query: str = "",
        file_count: int = 0,
        fail_count: int = 0,
        explicit_rlm: bool = False,
        agent_type: str = "",
    ) -> TriggerResult:
        """Check if RLM mode should be triggered.

        Args:
            context_tokens: Number of tokens in the current context
            query: The user's query or task description
            file_count: Number of files involved in the task
            fail_count: Number of failed attempts (for Debugger agent)
            explicit_rlm: Whether user explicitly requested RLM mode
            agent_type: Type of agent making the check

        Returns:
            TriggerResult with decision and reasons
        """
        reasons: list[TriggerReason] = []
        details: dict[str, Any] = {}

        # Check explicit request first (highest priority)
        if explicit_rlm:
            reasons.append(TriggerReason.EXPLICIT_REQUEST)
            details["explicit_request"] = True

        # Check context size
        if context_tokens > self.context_threshold:
            reasons.append(TriggerReason.LARGE_CONTEXT)
            details["context_tokens"] = context_tokens
            details["context_threshold"] = self.context_threshold

        # Check multi-file dependency
        if file_count > self.multi_file_threshold:
            reasons.append(TriggerReason.MULTI_FILE_DEPENDENCY)
            details["file_count"] = file_count
            details["multi_file_threshold"] = self.multi_file_threshold

        # Check debugger fail count
        if agent_type.lower() == "debugger" and fail_count > self.fail_count_threshold:
            reasons.append(TriggerReason.DEBUGGER_FAIL_COUNT)
            details["fail_count"] = fail_count
            details["fail_count_threshold"] = self.fail_count_threshold

        # Check for complex query
        if self._is_complex_query(query):
            reasons.append(TriggerReason.COMPLEX_QUERY)
            details["complex_query_detected"] = True

        # Determine result
        should_trigger = len(reasons) > 0
        primary_reason = reasons[0] if reasons else TriggerReason.NONE

        # Calculate confidence based on number of matching reasons
        confidence = min(1.0, len(reasons) * 0.3 + 0.4) if reasons else 0.0

        result = TriggerResult(
            should_trigger=should_trigger,
            reason=primary_reason,
            all_reasons=reasons,
            details=details,
            confidence=confidence,
        )

        logger.debug(
            f"Trigger check: should_trigger={should_trigger}, "
            f"reason={primary_reason.value}, confidence={confidence:.2f}"
        )

        return result

    def _is_complex_query(self, query: str) -> bool:
        """Check if query indicates complex exploration need.

        Args:
            query: The query to check

        Returns:
            True if query appears to need complex exploration
        """
        if not query:
            return False

        query_lower = query.lower()
        return any(
            keyword in query_lower
            for keyword in (self.complex_query_keywords or [])
        )

    def check_context_size(self, context_tokens: int) -> TriggerResult:
        """Quick check for context size only.

        Args:
            context_tokens: Number of tokens in context

        Returns:
            TriggerResult based on context size
        """
        return self.check(context_tokens=context_tokens)

    def check_debugger_fails(self, fail_count: int) -> TriggerResult:
        """Quick check for debugger fail count.

        Args:
            fail_count: Number of failed debug attempts

        Returns:
            TriggerResult based on fail count
        """
        return self.check(fail_count=fail_count, agent_type="debugger")

    def check_query_complexity(self, query: str) -> TriggerResult:
        """Quick check for query complexity.

        Args:
            query: The query to analyze

        Returns:
            TriggerResult based on query complexity
        """
        return self.check(query=query)

    def add_complex_keyword(self, keyword: str) -> None:
        """Add a keyword to the complex query detection list.

        Args:
            keyword: Keyword to add (will be matched case-insensitively)
        """
        if self.complex_query_keywords is None:
            self.complex_query_keywords = []
        if keyword.lower() not in [k.lower() for k in self.complex_query_keywords]:
            self.complex_query_keywords.append(keyword.lower())

    def remove_complex_keyword(self, keyword: str) -> bool:
        """Remove a keyword from the complex query detection list.

        Args:
            keyword: Keyword to remove

        Returns:
            True if keyword was removed, False if not found
        """
        if self.complex_query_keywords is None:
            return False

        keyword_lower = keyword.lower()
        for i, k in enumerate(self.complex_query_keywords):
            if k.lower() == keyword_lower:
                del self.complex_query_keywords[i]
                return True
        return False

    def get_thresholds(self) -> dict[str, Any]:
        """Get current threshold configuration.

        Returns:
            Dictionary of threshold settings
        """
        return {
            "context_threshold": self.context_threshold,
            "fail_count_threshold": self.fail_count_threshold,
            "multi_file_threshold": self.multi_file_threshold,
            "complex_keywords": list(self.complex_query_keywords or []),
        }

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"RLMTriggerDetector("
            f"context={self.context_threshold}, "
            f"fails={self.fail_count_threshold}, "
            f"files={self.multi_file_threshold})"
        )
