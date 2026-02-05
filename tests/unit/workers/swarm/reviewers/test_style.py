"""Unit tests for StyleReviewer.

Tests for the style-focused code reviewer implementation.
"""

from __future__ import annotations

import pytest


class TestStyleReviewer:
    """Tests for StyleReviewer class."""

    def test_style_reviewer_is_importable(self) -> None:
        """Test that StyleReviewer can be imported."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        assert StyleReviewer is not None

    def test_style_reviewer_can_be_instantiated(self) -> None:
        """Test that StyleReviewer can be instantiated."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert reviewer is not None

    def test_style_reviewer_implements_protocol(self) -> None:
        """Test that StyleReviewer implements SpecializedReviewer protocol."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert isinstance(reviewer, SpecializedReviewer)

    def test_reviewer_type_is_style(self) -> None:
        """Test that reviewer_type is 'style'."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert reviewer.reviewer_type == "style"

    def test_focus_areas_contains_naming_conventions(self) -> None:
        """Test that focus_areas includes naming_conventions."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "naming_conventions" in reviewer.focus_areas

    def test_focus_areas_contains_code_organization(self) -> None:
        """Test that focus_areas includes code_organization."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "code_organization" in reviewer.focus_areas

    def test_focus_areas_contains_documentation(self) -> None:
        """Test that focus_areas includes documentation."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "documentation" in reviewer.focus_areas

    def test_focus_areas_contains_type_hints(self) -> None:
        """Test that focus_areas includes type_hints."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "type_hints" in reviewer.focus_areas

    def test_focus_areas_contains_error_handling_patterns(self) -> None:
        """Test that focus_areas includes error_handling_patterns."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "error_handling_patterns" in reviewer.focus_areas

    def test_focus_areas_contains_test_coverage(self) -> None:
        """Test that focus_areas includes test_coverage."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "test_coverage" in reviewer.focus_areas

    def test_focus_areas_has_six_items(self) -> None:
        """Test that focus_areas has exactly six items."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert len(reviewer.focus_areas) == 6

    def test_severity_weights_contains_error_handling_patterns(self) -> None:
        """Test that severity_weights includes error_handling_patterns."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "error_handling_patterns" in reviewer.severity_weights
        assert reviewer.severity_weights["error_handling_patterns"] == 0.7

    def test_severity_weights_contains_type_hints(self) -> None:
        """Test that severity_weights includes type_hints."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "type_hints" in reviewer.severity_weights
        assert reviewer.severity_weights["type_hints"] == 0.5

    def test_severity_weights_contains_naming_conventions(self) -> None:
        """Test that severity_weights includes naming_conventions."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "naming_conventions" in reviewer.severity_weights
        assert reviewer.severity_weights["naming_conventions"] == 0.4

    def test_severity_weights_contains_code_organization(self) -> None:
        """Test that severity_weights includes code_organization."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "code_organization" in reviewer.severity_weights
        assert reviewer.severity_weights["code_organization"] == 0.4

    def test_severity_weights_contains_documentation(self) -> None:
        """Test that severity_weights includes documentation."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "documentation" in reviewer.severity_weights
        assert reviewer.severity_weights["documentation"] == 0.3

    def test_severity_weights_contains_test_coverage(self) -> None:
        """Test that severity_weights includes test_coverage."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        assert "test_coverage" in reviewer.severity_weights
        assert reviewer.severity_weights["test_coverage"] == 0.3

    def test_get_system_prompt_returns_non_empty_string(self) -> None:
        """Test that get_system_prompt returns a non-empty string."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        prompt = reviewer.get_system_prompt()

        assert isinstance(prompt, str)
        assert len(prompt) > 0

    def test_get_system_prompt_mentions_style(self) -> None:
        """Test that system prompt mentions style or code quality."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        prompt = reviewer.get_system_prompt().lower()

        assert "style" in prompt or "quality" in prompt

    def test_get_system_prompt_mentions_readability(self) -> None:
        """Test that system prompt mentions readability or maintainability."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        prompt = reviewer.get_system_prompt().lower()

        assert "readab" in prompt or "maintain" in prompt

    def test_get_system_prompt_mentions_conventions(self) -> None:
        """Test that system prompt mentions conventions or standards."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        prompt = reviewer.get_system_prompt().lower()

        assert "convention" in prompt or "standard" in prompt

    def test_get_checklist_returns_list(self) -> None:
        """Test that get_checklist returns a list."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        checklist = reviewer.get_checklist()

        assert isinstance(checklist, list)

    def test_get_checklist_returns_non_empty_list(self) -> None:
        """Test that get_checklist returns a non-empty list."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        checklist = reviewer.get_checklist()

        assert len(checklist) > 0

    def test_get_checklist_items_are_strings(self) -> None:
        """Test that all checklist items are strings."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        checklist = reviewer.get_checklist()

        for item in checklist:
            assert isinstance(item, str)

    def test_get_checklist_includes_naming_check(self) -> None:
        """Test that checklist includes a check for naming conventions."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_naming_check = any(
            "nam" in item and ("convention" in item or "descriptive" in item)
            for item in checklist_lower
        )
        assert has_naming_check

    def test_get_checklist_includes_docstring_check(self) -> None:
        """Test that checklist includes a check for docstrings."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_docstring_check = any(
            "docstring" in item or "documentation" in item for item in checklist_lower
        )
        assert has_docstring_check

    def test_get_checklist_includes_type_hint_check(self) -> None:
        """Test that checklist includes a check for type hints."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_type_hint_check = any(
            "type hint" in item or "type annotation" in item for item in checklist_lower
        )
        assert has_type_hint_check

    def test_get_checklist_includes_error_handling_check(self) -> None:
        """Test that checklist includes a check for error handling."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_error_handling_check = any(
            "error" in item or "exception" in item for item in checklist_lower
        )
        assert has_error_handling_check

    def test_get_checklist_includes_organization_check(self) -> None:
        """Test that checklist includes a check for code organization."""
        from src.workers.swarm.reviewers.style import StyleReviewer

        reviewer = StyleReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_organization_check = any(
            "organiz" in item or "structure" in item or "modularity" in item
            for item in checklist_lower
        )
        assert has_organization_check
