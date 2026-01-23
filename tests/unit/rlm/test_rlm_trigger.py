"""Unit tests for RLMTriggerDetector."""

from __future__ import annotations

import pytest

from src.workers.rlm.trigger import (
    RLMTriggerDetector,
    TriggerReason,
    TriggerResult,
)


class TestTriggerResult:
    """Tests for TriggerResult dataclass."""

    def test_create_trigger_result(self) -> None:
        """Test creating a trigger result."""
        result = TriggerResult(
            should_trigger=True,
            reason=TriggerReason.LARGE_CONTEXT,
            all_reasons=[TriggerReason.LARGE_CONTEXT],
            details={"context_tokens": 150000},
            confidence=0.7,
        )

        assert result.should_trigger is True
        assert result.reason == TriggerReason.LARGE_CONTEXT
        assert result.confidence == 0.7

    def test_trigger_result_to_dict(self) -> None:
        """Test conversion to dictionary."""
        result = TriggerResult(
            should_trigger=True,
            reason=TriggerReason.EXPLICIT_REQUEST,
            all_reasons=[TriggerReason.EXPLICIT_REQUEST, TriggerReason.LARGE_CONTEXT],
            details={"explicit": True},
            confidence=1.0,
        )

        data = result.to_dict()

        assert data["should_trigger"] is True
        assert data["reason"] == "explicit_request"
        assert "large_context" in data["all_reasons"]


class TestRLMTriggerDetectorCreation:
    """Tests for RLMTriggerDetector creation."""

    def test_create_with_defaults(self) -> None:
        """Test creating detector with defaults."""
        detector = RLMTriggerDetector()

        assert detector.context_threshold == 100_000
        assert detector.fail_count_threshold == 4
        assert detector.multi_file_threshold == 10
        assert detector.complex_query_keywords is not None

    def test_create_with_custom_thresholds(self) -> None:
        """Test creating with custom thresholds."""
        detector = RLMTriggerDetector(
            context_threshold=50_000,
            fail_count_threshold=2,
            multi_file_threshold=5,
        )

        assert detector.context_threshold == 50_000
        assert detector.fail_count_threshold == 2
        assert detector.multi_file_threshold == 5

    def test_create_with_custom_keywords(self) -> None:
        """Test creating with custom keywords."""
        keywords = ["custom", "keywords"]
        detector = RLMTriggerDetector(complex_query_keywords=keywords)

        assert detector.complex_query_keywords == keywords


class TestRLMTriggerDetectorExplicitRequest:
    """Tests for explicit RLM request triggering."""

    def test_explicit_request_triggers(self) -> None:
        """Test that explicit request triggers RLM."""
        detector = RLMTriggerDetector()

        result = detector.check(explicit_rlm=True)

        assert result.should_trigger is True
        assert result.reason == TriggerReason.EXPLICIT_REQUEST
        assert TriggerReason.EXPLICIT_REQUEST in result.all_reasons

    def test_explicit_request_highest_priority(self) -> None:
        """Test that explicit request has highest priority."""
        detector = RLMTriggerDetector()

        result = detector.check(
            explicit_rlm=True,
            context_tokens=200_000,  # Also triggers large context
        )

        # Explicit should be first (highest priority)
        assert result.reason == TriggerReason.EXPLICIT_REQUEST


class TestRLMTriggerDetectorContextSize:
    """Tests for context size triggering."""

    def test_large_context_triggers(self) -> None:
        """Test that large context triggers RLM."""
        detector = RLMTriggerDetector(context_threshold=100_000)

        result = detector.check(context_tokens=150_000)

        assert result.should_trigger is True
        assert TriggerReason.LARGE_CONTEXT in result.all_reasons
        assert result.details["context_tokens"] == 150_000

    def test_small_context_does_not_trigger(self) -> None:
        """Test that small context doesn't trigger."""
        detector = RLMTriggerDetector(context_threshold=100_000)

        result = detector.check(context_tokens=50_000)

        assert result.should_trigger is False
        assert TriggerReason.LARGE_CONTEXT not in result.all_reasons

    def test_context_at_threshold_does_not_trigger(self) -> None:
        """Test that context exactly at threshold doesn't trigger."""
        detector = RLMTriggerDetector(context_threshold=100_000)

        result = detector.check(context_tokens=100_000)

        assert result.should_trigger is False

    def test_check_context_size_shortcut(self) -> None:
        """Test the check_context_size shortcut method."""
        detector = RLMTriggerDetector(context_threshold=100_000)

        result = detector.check_context_size(150_000)

        assert result.should_trigger is True
        assert TriggerReason.LARGE_CONTEXT in result.all_reasons


class TestRLMTriggerDetectorMultiFile:
    """Tests for multi-file dependency triggering."""

    def test_multi_file_triggers(self) -> None:
        """Test that many files triggers RLM."""
        detector = RLMTriggerDetector(multi_file_threshold=10)

        result = detector.check(file_count=15)

        assert result.should_trigger is True
        assert TriggerReason.MULTI_FILE_DEPENDENCY in result.all_reasons
        assert result.details["file_count"] == 15

    def test_few_files_does_not_trigger(self) -> None:
        """Test that few files doesn't trigger."""
        detector = RLMTriggerDetector(multi_file_threshold=10)

        result = detector.check(file_count=5)

        assert result.should_trigger is False
        assert TriggerReason.MULTI_FILE_DEPENDENCY not in result.all_reasons


class TestRLMTriggerDetectorDebuggerFails:
    """Tests for debugger fail count triggering."""

    def test_debugger_fail_count_triggers(self) -> None:
        """Test that high fail count triggers for debugger."""
        detector = RLMTriggerDetector(fail_count_threshold=4)

        result = detector.check(fail_count=5, agent_type="debugger")

        assert result.should_trigger is True
        assert TriggerReason.DEBUGGER_FAIL_COUNT in result.all_reasons

    def test_low_fail_count_does_not_trigger(self) -> None:
        """Test that low fail count doesn't trigger."""
        detector = RLMTriggerDetector(fail_count_threshold=4)

        result = detector.check(fail_count=2, agent_type="debugger")

        assert result.should_trigger is False

    def test_fail_count_only_for_debugger(self) -> None:
        """Test that fail count only triggers for debugger agent."""
        detector = RLMTriggerDetector(fail_count_threshold=4)

        # High fail count but not debugger agent
        result = detector.check(fail_count=10, agent_type="coding")

        assert TriggerReason.DEBUGGER_FAIL_COUNT not in result.all_reasons

    def test_check_debugger_fails_shortcut(self) -> None:
        """Test the check_debugger_fails shortcut method."""
        detector = RLMTriggerDetector(fail_count_threshold=4)

        result = detector.check_debugger_fails(5)

        assert result.should_trigger is True
        assert TriggerReason.DEBUGGER_FAIL_COUNT in result.all_reasons


class TestRLMTriggerDetectorComplexQuery:
    """Tests for complex query detection."""

    def test_complex_query_triggers(self) -> None:
        """Test that complex query triggers RLM."""
        detector = RLMTriggerDetector()

        result = detector.check(query="How does the authentication system work?")

        assert result.should_trigger is True
        assert TriggerReason.COMPLEX_QUERY in result.all_reasons

    def test_simple_query_does_not_trigger(self) -> None:
        """Test that simple query doesn't trigger."""
        detector = RLMTriggerDetector()

        result = detector.check(query="Fix the bug in line 42")

        assert result.should_trigger is False

    def test_architecture_keyword_triggers(self) -> None:
        """Test that 'architecture' keyword triggers."""
        detector = RLMTriggerDetector()

        result = detector.check(query="Explain the architecture of the system")

        assert TriggerReason.COMPLEX_QUERY in result.all_reasons

    def test_dependencies_keyword_triggers(self) -> None:
        """Test that 'dependencies' keyword triggers."""
        detector = RLMTriggerDetector()

        result = detector.check(query="What are the dependencies between modules?")

        assert TriggerReason.COMPLEX_QUERY in result.all_reasons

    def test_check_query_complexity_shortcut(self) -> None:
        """Test the check_query_complexity shortcut method."""
        detector = RLMTriggerDetector()

        result = detector.check_query_complexity("Trace the flow of data")

        assert result.should_trigger is True
        assert TriggerReason.COMPLEX_QUERY in result.all_reasons

    def test_case_insensitive_keywords(self) -> None:
        """Test that keyword matching is case-insensitive."""
        detector = RLMTriggerDetector()

        result = detector.check(query="HOW DOES the auth WORK?")

        assert TriggerReason.COMPLEX_QUERY in result.all_reasons

    def test_empty_query_does_not_trigger(self) -> None:
        """Test that empty query doesn't trigger."""
        detector = RLMTriggerDetector()

        result = detector.check(query="")

        assert TriggerReason.COMPLEX_QUERY not in result.all_reasons


class TestRLMTriggerDetectorMultipleReasons:
    """Tests for multiple trigger reasons."""

    def test_multiple_reasons_captured(self) -> None:
        """Test that multiple matching reasons are captured."""
        detector = RLMTriggerDetector()

        result = detector.check(
            context_tokens=150_000,
            query="How does the system architecture work?",
            file_count=20,
        )

        assert result.should_trigger is True
        assert len(result.all_reasons) >= 2
        assert TriggerReason.LARGE_CONTEXT in result.all_reasons
        assert TriggerReason.COMPLEX_QUERY in result.all_reasons

    def test_confidence_increases_with_reasons(self) -> None:
        """Test that confidence increases with more reasons."""
        detector = RLMTriggerDetector()

        # Single reason
        result1 = detector.check(context_tokens=150_000)

        # Multiple reasons
        result2 = detector.check(
            context_tokens=150_000,
            query="How does the architecture work?",
            file_count=20,
        )

        assert result2.confidence > result1.confidence


class TestRLMTriggerDetectorNoTrigger:
    """Tests for non-triggering scenarios."""

    def test_no_trigger_returns_none_reason(self) -> None:
        """Test that no trigger returns NONE reason."""
        detector = RLMTriggerDetector()

        result = detector.check()

        assert result.should_trigger is False
        assert result.reason == TriggerReason.NONE
        assert len(result.all_reasons) == 0

    def test_no_trigger_zero_confidence(self) -> None:
        """Test that no trigger has zero confidence."""
        detector = RLMTriggerDetector()

        result = detector.check()

        assert result.confidence == 0.0


class TestRLMTriggerDetectorKeywordManagement:
    """Tests for keyword management."""

    def test_add_complex_keyword(self) -> None:
        """Test adding a complex keyword."""
        detector = RLMTriggerDetector()
        original_count = len(detector.complex_query_keywords or [])

        detector.add_complex_keyword("investigate")

        assert "investigate" in detector.complex_query_keywords

    def test_add_duplicate_keyword_ignored(self) -> None:
        """Test that duplicate keywords are ignored."""
        detector = RLMTriggerDetector()
        detector.add_complex_keyword("test_keyword")
        count_after_first = len(detector.complex_query_keywords or [])

        detector.add_complex_keyword("TEST_KEYWORD")  # Same, different case

        assert len(detector.complex_query_keywords or []) == count_after_first

    def test_remove_complex_keyword(self) -> None:
        """Test removing a complex keyword."""
        detector = RLMTriggerDetector()
        detector.add_complex_keyword("to_remove")

        removed = detector.remove_complex_keyword("to_remove")

        assert removed is True
        assert "to_remove" not in detector.complex_query_keywords

    def test_remove_nonexistent_keyword(self) -> None:
        """Test removing nonexistent keyword."""
        detector = RLMTriggerDetector()

        removed = detector.remove_complex_keyword("nonexistent_keyword_xyz")

        assert removed is False


class TestRLMTriggerDetectorThresholds:
    """Tests for threshold configuration."""

    def test_get_thresholds(self) -> None:
        """Test getting threshold configuration."""
        detector = RLMTriggerDetector(
            context_threshold=50_000,
            fail_count_threshold=3,
            multi_file_threshold=8,
        )

        thresholds = detector.get_thresholds()

        assert thresholds["context_threshold"] == 50_000
        assert thresholds["fail_count_threshold"] == 3
        assert thresholds["multi_file_threshold"] == 8
        assert "complex_keywords" in thresholds


class TestRLMTriggerDetectorRepr:
    """Tests for string representation."""

    def test_repr(self) -> None:
        """Test string representation."""
        detector = RLMTriggerDetector(
            context_threshold=100_000,
            fail_count_threshold=4,
            multi_file_threshold=10,
        )

        repr_str = repr(detector)

        assert "RLMTriggerDetector" in repr_str
        assert "context=100000" in repr_str
        assert "fails=4" in repr_str
        assert "files=10" in repr_str
