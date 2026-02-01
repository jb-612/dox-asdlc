"""RBAC (Role-Based Access Control) validator for Slack HITL Bridge.

Provides role validation for Slack users to determine who can
approve or reject specific gate types.
"""

from __future__ import annotations

import logging

from src.infrastructure.slack_bridge.config import ChannelConfig

logger = logging.getLogger(__name__)


class RBACValidator:
    """Validates Slack users have required roles for gate approval.

    Uses a mapping of Slack user IDs to roles to determine authorization.
    This validator is used before processing approval/rejection button clicks
    to ensure only authorized users can make gate decisions.

    Attributes:
        rbac_map: Mapping of Slack user ID to list of roles.

    Example:
        ```python
        validator = RBACValidator({
            "U001": ["pm", "architect"],
            "U002": ["reviewer"],
        })

        if validator.can_approve_gate("U001", "hitl_4_code", channel_config):
            # Process approval
            pass
        ```
    """

    def __init__(self, rbac_map: dict[str, list[str]]) -> None:
        """Initialize the RBAC validator.

        Args:
            rbac_map: Mapping of Slack user ID to list of roles.
        """
        self.rbac_map = rbac_map

    def has_role(self, slack_user_id: str, required_role: str) -> bool:
        """Check if a user has the specified role.

        Args:
            slack_user_id: Slack user ID (e.g., "U0123456789").
            required_role: Role name to check for.

        Returns:
            True if the user has the role, False otherwise.
        """
        user_roles = self.rbac_map.get(slack_user_id, [])
        return required_role in user_roles

    def can_approve_gate(
        self,
        slack_user_id: str,
        gate_type: str,
        channel_config: ChannelConfig,
    ) -> bool:
        """Check if a user can approve a gate in the specified channel.

        Uses the channel configuration's required_role to determine
        if the user has the necessary role.

        Args:
            slack_user_id: Slack user ID of the user attempting approval.
            gate_type: Type of gate being approved (for logging).
            channel_config: Channel configuration with required role.

        Returns:
            True if the user can approve, False otherwise.
        """
        has_permission = self.has_role(slack_user_id, channel_config.required_role)

        if not has_permission:
            logger.warning(
                f"RBAC denied: User {slack_user_id} lacks role "
                f"'{channel_config.required_role}' for gate {gate_type}"
            )

        return has_permission

    def get_user_roles(self, slack_user_id: str) -> list[str]:
        """Get all roles assigned to a user.

        Args:
            slack_user_id: Slack user ID.

        Returns:
            List of role names, empty if user not found.
        """
        return self.rbac_map.get(slack_user_id, [])
