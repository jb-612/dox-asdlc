"""Unit tests for SecurityReviewer.

Tests for the security-focused code reviewer implementation.
"""

from __future__ import annotations

import pytest


class TestSecurityReviewer:
    """Tests for SecurityReviewer class."""

    def test_security_reviewer_is_importable(self) -> None:
        """Test that SecurityReviewer can be imported."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        assert SecurityReviewer is not None

    def test_security_reviewer_can_be_instantiated(self) -> None:
        """Test that SecurityReviewer can be instantiated."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert reviewer is not None

    def test_security_reviewer_implements_protocol(self) -> None:
        """Test that SecurityReviewer implements SpecializedReviewer protocol."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert isinstance(reviewer, SpecializedReviewer)

    def test_reviewer_type_is_security(self) -> None:
        """Test that reviewer_type is 'security'."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert reviewer.reviewer_type == "security"

    def test_focus_areas_contains_authentication(self) -> None:
        """Test that focus_areas includes authentication."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "authentication" in reviewer.focus_areas

    def test_focus_areas_contains_authorization(self) -> None:
        """Test that focus_areas includes authorization."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "authorization" in reviewer.focus_areas

    def test_focus_areas_contains_input_validation(self) -> None:
        """Test that focus_areas includes input_validation."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "input_validation" in reviewer.focus_areas

    def test_focus_areas_contains_secrets_exposure(self) -> None:
        """Test that focus_areas includes secrets_exposure."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "secrets_exposure" in reviewer.focus_areas

    def test_focus_areas_contains_injection_vulnerabilities(self) -> None:
        """Test that focus_areas includes injection_vulnerabilities."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "injection_vulnerabilities" in reviewer.focus_areas

    def test_focus_areas_contains_cryptography(self) -> None:
        """Test that focus_areas includes cryptography."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "cryptography" in reviewer.focus_areas

    def test_focus_areas_has_six_items(self) -> None:
        """Test that focus_areas has exactly six items."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert len(reviewer.focus_areas) == 6

    def test_severity_weights_contains_authentication(self) -> None:
        """Test that severity_weights includes authentication with high weight."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "authentication" in reviewer.severity_weights
        assert reviewer.severity_weights["authentication"] == 1.0

    def test_severity_weights_contains_authorization(self) -> None:
        """Test that severity_weights includes authorization with high weight."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "authorization" in reviewer.severity_weights
        assert reviewer.severity_weights["authorization"] == 1.0

    def test_severity_weights_contains_injection_vulnerabilities(self) -> None:
        """Test that severity_weights includes injection_vulnerabilities with high weight."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "injection_vulnerabilities" in reviewer.severity_weights
        assert reviewer.severity_weights["injection_vulnerabilities"] == 1.0

    def test_severity_weights_contains_secrets_exposure(self) -> None:
        """Test that severity_weights includes secrets_exposure."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "secrets_exposure" in reviewer.severity_weights
        assert reviewer.severity_weights["secrets_exposure"] == 0.9

    def test_severity_weights_contains_cryptography(self) -> None:
        """Test that severity_weights includes cryptography."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "cryptography" in reviewer.severity_weights
        assert reviewer.severity_weights["cryptography"] == 0.8

    def test_severity_weights_contains_input_validation(self) -> None:
        """Test that severity_weights includes input_validation."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        assert "input_validation" in reviewer.severity_weights
        assert reviewer.severity_weights["input_validation"] == 0.7

    def test_get_system_prompt_returns_non_empty_string(self) -> None:
        """Test that get_system_prompt returns a non-empty string."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        prompt = reviewer.get_system_prompt()

        assert isinstance(prompt, str)
        assert len(prompt) > 0

    def test_get_system_prompt_mentions_security(self) -> None:
        """Test that system prompt mentions security."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        prompt = reviewer.get_system_prompt().lower()

        assert "security" in prompt

    def test_get_system_prompt_mentions_vulnerabilities(self) -> None:
        """Test that system prompt mentions vulnerabilities."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        prompt = reviewer.get_system_prompt().lower()

        assert "vulnerabilit" in prompt  # covers vulnerability/vulnerabilities

    def test_get_system_prompt_mentions_authentication(self) -> None:
        """Test that system prompt mentions authentication."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        prompt = reviewer.get_system_prompt().lower()

        assert "authentication" in prompt or "auth" in prompt

    def test_get_checklist_returns_list(self) -> None:
        """Test that get_checklist returns a list."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        checklist = reviewer.get_checklist()

        assert isinstance(checklist, list)

    def test_get_checklist_returns_non_empty_list(self) -> None:
        """Test that get_checklist returns a non-empty list."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        checklist = reviewer.get_checklist()

        assert len(checklist) > 0

    def test_get_checklist_items_are_strings(self) -> None:
        """Test that all checklist items are strings."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        checklist = reviewer.get_checklist()

        for item in checklist:
            assert isinstance(item, str)

    def test_get_checklist_includes_credentials_check(self) -> None:
        """Test that checklist includes a check for hardcoded credentials."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_credentials_check = any(
            "credential" in item or "api key" in item or "hardcoded" in item
            for item in checklist_lower
        )
        assert has_credentials_check

    def test_get_checklist_includes_input_validation_check(self) -> None:
        """Test that checklist includes a check for input validation."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_input_check = any(
            "input" in item and "validat" in item for item in checklist_lower
        )
        assert has_input_check

    def test_get_checklist_includes_sql_injection_check(self) -> None:
        """Test that checklist includes a check for SQL injection."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_sql_injection_check = any("sql injection" in item for item in checklist_lower)
        assert has_sql_injection_check

    def test_get_checklist_includes_command_injection_check(self) -> None:
        """Test that checklist includes a check for command injection."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_command_injection_check = any(
            "command injection" in item for item in checklist_lower
        )
        assert has_command_injection_check

    def test_get_checklist_includes_authentication_check(self) -> None:
        """Test that checklist includes a check for authentication."""
        from src.workers.swarm.reviewers.security import SecurityReviewer

        reviewer = SecurityReviewer()
        checklist = reviewer.get_checklist()
        checklist_lower = [item.lower() for item in checklist]

        has_auth_check = any("authentication" in item for item in checklist_lower)
        assert has_auth_check
