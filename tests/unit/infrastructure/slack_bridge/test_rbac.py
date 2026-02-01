"""Unit tests for Slack Bridge RBAC validator.

Tests the RBACValidator class for role-based access control.
"""

from __future__ import annotations

import pytest

from src.infrastructure.slack_bridge.config import ChannelConfig
from src.infrastructure.slack_bridge.rbac import RBACValidator


class TestRBACValidator:
    """Tests for RBACValidator class."""

    @pytest.fixture
    def rbac_map(self) -> dict[str, list[str]]:
        """Sample RBAC map for testing."""
        return {
            "U001": ["pm", "architect", "lead"],
            "U002": ["reviewer", "qa"],
            "U003": ["release_manager"],
            "U004": [],  # User with no roles
        }

    @pytest.fixture
    def validator(self, rbac_map: dict[str, list[str]]) -> RBACValidator:
        """Create RBACValidator instance."""
        return RBACValidator(rbac_map)

    def test_has_role_true(self, validator: RBACValidator):
        """User with role returns True."""
        assert validator.has_role("U001", "pm") is True
        assert validator.has_role("U001", "architect") is True
        assert validator.has_role("U002", "reviewer") is True

    def test_has_role_false(self, validator: RBACValidator):
        """User without role returns False."""
        assert validator.has_role("U001", "reviewer") is False
        assert validator.has_role("U002", "pm") is False
        assert validator.has_role("U003", "qa") is False

    def test_has_role_unknown_user(self, validator: RBACValidator):
        """Unknown user returns False."""
        assert validator.has_role("U999", "pm") is False
        assert validator.has_role("UNKNOWN", "reviewer") is False

    def test_has_role_user_with_no_roles(self, validator: RBACValidator):
        """User with empty roles list returns False."""
        assert validator.has_role("U004", "pm") is False
        assert validator.has_role("U004", "any_role") is False

    def test_get_user_roles(self, validator: RBACValidator):
        """Get all roles for a user."""
        roles = validator.get_user_roles("U001")
        assert "pm" in roles
        assert "architect" in roles
        assert "lead" in roles
        assert len(roles) == 3

    def test_get_user_roles_single_role(self, validator: RBACValidator):
        """Get roles for user with single role."""
        roles = validator.get_user_roles("U003")
        assert roles == ["release_manager"]

    def test_get_user_roles_unknown_user(self, validator: RBACValidator):
        """Unknown user returns empty list."""
        roles = validator.get_user_roles("U999")
        assert roles == []

    def test_get_user_roles_user_with_no_roles(self, validator: RBACValidator):
        """User with no roles returns empty list."""
        roles = validator.get_user_roles("U004")
        assert roles == []

    def test_can_approve_gate_authorized(self, validator: RBACValidator):
        """Authorized user can approve gate."""
        channel_config = ChannelConfig(
            channel_id="C001",
            required_role="reviewer",
        )

        assert validator.can_approve_gate("U002", "hitl_4_code", channel_config) is True

    def test_can_approve_gate_unauthorized(self, validator: RBACValidator):
        """Unauthorized user cannot approve gate."""
        channel_config = ChannelConfig(
            channel_id="C001",
            required_role="release_manager",
        )

        assert validator.can_approve_gate("U002", "hitl_6_release", channel_config) is False

    def test_can_approve_gate_unknown_user(self, validator: RBACValidator):
        """Unknown user cannot approve gate."""
        channel_config = ChannelConfig(
            channel_id="C001",
            required_role="reviewer",
        )

        assert validator.can_approve_gate("U999", "hitl_4_code", channel_config) is False

    def test_can_approve_gate_checks_channel_required_role(self, validator: RBACValidator):
        """Gate approval checks the channel's required role."""
        pm_channel = ChannelConfig(
            channel_id="C001",
            required_role="pm",
        )
        reviewer_channel = ChannelConfig(
            channel_id="C002",
            required_role="reviewer",
        )

        # U001 has pm role, U002 has reviewer role
        assert validator.can_approve_gate("U001", "hitl_1_backlog", pm_channel) is True
        assert validator.can_approve_gate("U001", "hitl_4_code", reviewer_channel) is False
        assert validator.can_approve_gate("U002", "hitl_1_backlog", pm_channel) is False
        assert validator.can_approve_gate("U002", "hitl_4_code", reviewer_channel) is True


class TestRBACValidatorEdgeCases:
    """Edge case tests for RBACValidator."""

    def test_empty_rbac_map(self):
        """Validator with empty RBAC map denies all."""
        validator = RBACValidator({})

        assert validator.has_role("U001", "pm") is False
        assert validator.get_user_roles("U001") == []

    def test_case_sensitive_user_ids(self):
        """User IDs are case-sensitive."""
        validator = RBACValidator({"U001": ["pm"]})

        assert validator.has_role("U001", "pm") is True
        assert validator.has_role("u001", "pm") is False

    def test_case_sensitive_roles(self):
        """Roles are case-sensitive."""
        validator = RBACValidator({"U001": ["PM"]})

        assert validator.has_role("U001", "PM") is True
        assert validator.has_role("U001", "pm") is False

    def test_whitespace_in_roles(self):
        """Roles with whitespace are handled as-is."""
        validator = RBACValidator({"U001": [" pm ", "reviewer"]})

        assert validator.has_role("U001", " pm ") is True
        assert validator.has_role("U001", "pm") is False
        assert validator.has_role("U001", "reviewer") is True
