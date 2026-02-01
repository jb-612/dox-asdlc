"""Configuration models for Slack HITL Bridge.

Defines Pydantic v2 models for Slack Bridge configuration including
channel routing, RBAC mappings, and connection settings.
"""

from __future__ import annotations

import os

from pydantic import BaseModel, Field, SecretStr


class ChannelConfig(BaseModel):
    """Channel routing configuration for a gate type.

    Defines which Slack channel receives notifications for a specific
    gate type and what role is required to approve gates in that channel.

    Attributes:
        channel_id: Slack channel ID (e.g., "C0123456789").
        required_role: Role required to approve gates in this channel.
        mention_users: List of Slack user IDs to @mention in notifications.
        mention_groups: List of Slack user group IDs to @mention.
    """

    channel_id: str
    required_role: str
    mention_users: list[str] = []
    mention_groups: list[str] = []


def _get_default_hitl_ui_base_url() -> str:
    """Get the default HITL UI base URL from environment or fallback.

    Returns:
        The HITL UI base URL, defaulting to http://localhost:3000.
    """
    return os.environ.get("HITL_UI_BASE_URL", "http://localhost:3000")


class SlackBridgeConfig(BaseModel):
    """Slack HITL Bridge configuration.

    Contains all settings needed to run the Slack Bridge including
    Slack credentials, routing policies, and RBAC mappings.

    Attributes:
        bot_token: Slack Bot OAuth token (xoxb-...). Used for posting messages.
        app_token: Slack App-level token (xapp-...). Used for Socket Mode.
        signing_secret: Slack signing secret for request verification.
        routing_policy: Mapping of gate type to channel configuration.
        environment_overrides: Per-environment routing overrides.
        rbac_map: Mapping of Slack user ID to list of roles.
        ideas_channels: List of channel IDs to monitor for ideas ingestion.
        ideas_emoji: Emoji name (without colons) for idea capture reactions.
        consumer_group: Redis consumer group name.
        consumer_name: Redis consumer instance name.
        hitl_ui_base_url: Base URL for HITL UI evidence links. Defaults to
            HITL_UI_BASE_URL environment variable or http://localhost:3000.

    Example:
        ```python
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-..."),
            app_token=SecretStr("xapp-..."),
            signing_secret=SecretStr("abc123"),
            routing_policy={
                "hitl_4_code": ChannelConfig(
                    channel_id="C123",
                    required_role="reviewer",
                )
            },
            rbac_map={"U001": ["reviewer", "pm"]},
            hitl_ui_base_url="https://hitl.example.com",
        )
        ```
    """

    bot_token: SecretStr
    app_token: SecretStr
    signing_secret: SecretStr
    routing_policy: dict[str, ChannelConfig]
    rbac_map: dict[str, list[str]]
    environment_overrides: dict[str, dict[str, ChannelConfig]] = {}
    ideas_channels: list[str] = []
    ideas_emoji: str = "bulb"
    consumer_group: str = "slack_bridge"
    consumer_name: str = "bridge_1"
    hitl_ui_base_url: str = Field(default_factory=_get_default_hitl_ui_base_url)

    class Config:
        """Pydantic model configuration."""

        # Prevent secrets from being exposed in repr/str
        json_encoders = {
            SecretStr: lambda v: "**********" if v else None,
        }
