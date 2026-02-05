"""Unit tests for PerformanceReviewer.

Tests for the performance-focused code reviewer implementation.
"""

from __future__ import annotations

import pytest


class TestPerformanceReviewer:
    """Tests for PerformanceReviewer class."""

    def test_performance_reviewer_is_importable(self) -> None:
        """Test that PerformanceReviewer can be imported."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        assert PerformanceReviewer is not None

    def test_performance_reviewer_can_be_instantiated(self) -> None:
        """Test that PerformanceReviewer can be instantiated."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert reviewer is not None

    def test_performance_reviewer_implements_protocol(self) -> None:
        """Test that PerformanceReviewer implements SpecializedReviewer protocol."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert isinstance(reviewer, SpecializedReviewer)

    def test_reviewer_type_is_performance(self) -> None:
        """Test that reviewer_type is 'performance'."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert reviewer.reviewer_type == "performance"

    def test_focus_areas_contains_algorithmic_complexity(self) -> None:
        """Test that focus_areas includes algorithmic_complexity."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "algorithmic_complexity" in reviewer.focus_areas

    def test_focus_areas_contains_memory_usage(self) -> None:
        """Test that focus_areas includes memory_usage."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "memory_usage" in reviewer.focus_areas

    def test_focus_areas_contains_database_queries(self) -> None:
        """Test that focus_areas includes database_queries."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "database_queries" in reviewer.focus_areas

    def test_focus_areas_contains_caching(self) -> None:
        """Test that focus_areas includes caching."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "caching" in reviewer.focus_areas

    def test_focus_areas_contains_async_patterns(self) -> None:
        """Test that focus_areas includes async_patterns."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "async_patterns" in reviewer.focus_areas

    def test_focus_areas_contains_resource_leaks(self) -> None:
        """Test that focus_areas includes resource_leaks."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "resource_leaks" in reviewer.focus_areas

    def test_focus_areas_has_six_items(self) -> None:
        """Test that focus_areas has exactly six items."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert len(reviewer.focus_areas) == 6

    def test_severity_weights_contains_algorithmic_complexity(self) -> None:
        """Test that severity_weights includes algorithmic_complexity."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "algorithmic_complexity" in reviewer.severity_weights
        assert reviewer.severity_weights["algorithmic_complexity"] == 0.9

    def test_severity_weights_contains_database_queries(self) -> None:
        """Test that severity_weights includes database_queries."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "database_queries" in reviewer.severity_weights
        assert reviewer.severity_weights["database_queries"] == 0.9

    def test_severity_weights_contains_resource_leaks(self) -> None:
        """Test that severity_weights includes resource_leaks."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "resource_leaks" in reviewer.severity_weights
        assert reviewer.severity_weights["resource_leaks"] == 0.8

    def test_severity_weights_contains_memory_usage(self) -> None:
        """Test that severity_weights includes memory_usage."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "memory_usage" in reviewer.severity_weights
        assert reviewer.severity_weights["memory_usage"] == 0.7

    def test_severity_weights_contains_caching(self) -> None:
        """Test that severity_weights includes caching."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "caching" in reviewer.severity_weights
        assert reviewer.severity_weights["caching"] == 0.6

    def test_severity_weights_contains_async_patterns(self) -> None:
        """Test that severity_weights includes async_patterns."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        assert "async_patterns" in reviewer.severity_weights
        assert reviewer.severity_weights["async_patterns"] == 0.6

    def test_get_system_prompt_returns_non_empty_string(self) -> None:
        """Test that get_system_prompt returns a non-empty string."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        prompt = reviewer.get_system_prompt()

        assert isinstance(prompt, str)
        assert len(prompt) > 0

    def test_get_system_prompt_mentions_performance(self) -> None:
        """Test that system prompt mentions performance."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        prompt = reviewer.get_system_prompt().lower()

        assert "performance" in prompt

    def test_get_system_prompt_mentions_efficiency(self) -> None:
        """Test that system prompt mentions efficiency or optimization."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        prompt = reviewer.get_system_prompt().lower()

        assert "efficien" in prompt or "optim" in prompt

    def test_get_system_prompt_mentions_complexity(self) -> None:
        """Test that system prompt mentions complexity."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        prompt = reviewer.get_system_prompt().lower()

        assert "complex" in prompt

    def test_get_checklist_returns_list(self) -> None:
        """Test that get_checklist returns a list."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        checklist = reviewer.get_checklist()

        assert isinstance(checklist, list)

    def test_get_checklist_returns_non_empty_list(self) -> None:
        """Test that get_checklist returns a non-empty list."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        checklist = reviewer.get_checklist()

        assert len(checklist) > 0

    def test_get_checklist_items_are_strings(self) -> None:
        """Test that all checklist items are strings."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        checklist = reviewer.get_checklist()

        for item in checklist:
            assert isinstance(item, str)

    def test_get_checklist_includes_complexity_check(self) -> None:
        """Test that checklist includes a check for algorithmic complexity."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_complexity_check = any(
            "complex" in item or "o(n" in item or "big o" in item
            for item in checklist_lower
        )
        assert has_complexity_check

    def test_get_checklist_includes_n_plus_one_check(self) -> None:
        """Test that checklist includes a check for N+1 queries."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_n_plus_one_check = any(
            "n+1" in item or "n + 1" in item for item in checklist_lower
        )
        assert has_n_plus_one_check

    def test_get_checklist_includes_memory_check(self) -> None:
        """Test that checklist includes a check for memory usage."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_memory_check = any("memory" in item for item in checklist_lower)
        assert has_memory_check

    def test_get_checklist_includes_caching_check(self) -> None:
        """Test that checklist includes a check for caching opportunities."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_caching_check = any("cach" in item for item in checklist_lower)
        assert has_caching_check

    def test_get_checklist_includes_async_check(self) -> None:
        """Test that checklist includes a check for async patterns."""
        from src.workers.swarm.reviewers.performance import PerformanceReviewer

        reviewer = PerformanceReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_async_check = any(
            "async" in item or "blocking" in item for item in checklist_lower
        )
        assert has_async_check
