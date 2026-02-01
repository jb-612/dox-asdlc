"""Unit tests for Slack Bridge configuration models.

Tests the SlackBridgeConfig and ChannelConfig Pydantic models.
"""

from __future__ import annotations

import pytest
from pydantic import SecretStr, ValidationError

from src.infrastructure.slack_bridge.config import (
    ChannelConfig,
    SlackBridgeConfig,
)


class TestChannelConfig:
    """Tests for ChannelConfig model."""

    def test_create_minimal_channel_config(self):
        """Create channel config with only required fields."""
        config = ChannelConfig(
            channel_id="C0123456789",
            required_role="reviewer",
        )

        assert config.channel_id == "C0123456789"
        assert config.required_role == "reviewer"
        assert config.mention_users == []
        assert config.mention_groups == []

    def test_create_full_channel_config(self):
        """Create channel config with all fields."""
        config = ChannelConfig(
            channel_id="C0123456789",
            required_role="release_manager",
            mention_users=["U001", "U002"],
            mention_groups=["S001"],
        )

        assert config.channel_id == "C0123456789"
        assert config.required_role == "release_manager"
        assert config.mention_users == ["U001", "U002"]
        assert config.mention_groups == ["S001"]

    def test_channel_id_required(self):
        """Channel ID is required."""
        with pytest.raises(ValidationError) as exc_info:
            ChannelConfig(required_role="reviewer")

        assert "channel_id" in str(exc_info.value)

    def test_required_role_required(self):
        """Required role is required."""
        with pytest.raises(ValidationError) as exc_info:
            ChannelConfig(channel_id="C0123456789")

        assert "required_role" in str(exc_info.value)

    def test_channel_config_serialization(self):
        """Channel config can be serialized to dict."""
        config = ChannelConfig(
            channel_id="C0123456789",
            required_role="reviewer",
            mention_users=["U001"],
        )

        data = config.model_dump()

        assert data["channel_id"] == "C0123456789"
        assert data["required_role"] == "reviewer"
        assert data["mention_users"] == ["U001"]


class TestSlackBridgeConfig:
    """Tests for SlackBridgeConfig model."""

    def test_create_minimal_config(self):
        """Create config with only required fields."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test-token"),
            app_token=SecretStr("xapp-test-token"),
            signing_secret=SecretStr("abc123signing"),
            routing_policy={
                "hitl_4_code": ChannelConfig(
                    channel_id="C001",
                    required_role="reviewer",
                )
            },
            rbac_map={"U001": ["reviewer"]},
        )

        assert config.bot_token.get_secret_value() == "xoxb-test-token"
        assert config.app_token.get_secret_value() == "xapp-test-token"
        assert config.signing_secret.get_secret_value() == "abc123signing"
        assert "hitl_4_code" in config.routing_policy
        assert config.consumer_group == "slack_bridge"
        assert config.consumer_name == "bridge_1"

    def test_create_full_config(self):
        """Create config with all fields."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test-token"),
            app_token=SecretStr("xapp-test-token"),
            signing_secret=SecretStr("abc123signing"),
            routing_policy={
                "hitl_1_backlog": ChannelConfig(
                    channel_id="C001",
                    required_role="pm",
                ),
                "hitl_4_code": ChannelConfig(
                    channel_id="C002",
                    required_role="reviewer",
                ),
            },
            environment_overrides={
                "production": {
                    "hitl_6_release": ChannelConfig(
                        channel_id="C-PROD",
                        required_role="release_manager",
                    )
                }
            },
            rbac_map={
                "U001": ["pm", "reviewer"],
                "U002": ["release_manager"],
            },
            ideas_channels=["C-IDEAS"],
            ideas_emoji="lightbulb",
            consumer_group="custom_group",
            consumer_name="bridge_2",
        )

        assert config.ideas_channels == ["C-IDEAS"]
        assert config.ideas_emoji == "lightbulb"
        assert config.consumer_group == "custom_group"
        assert config.consumer_name == "bridge_2"
        assert "production" in config.environment_overrides
        assert len(config.rbac_map) == 2

    def test_secret_values_are_masked(self):
        """Secret values are masked when converted to string."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-super-secret"),
            app_token=SecretStr("xapp-also-secret"),
            signing_secret=SecretStr("signing-secret"),
            routing_policy={},
            rbac_map={},
        )

        # SecretStr masks values when converted to string
        assert "xoxb-super-secret" not in str(config.bot_token)
        assert "xapp-also-secret" not in str(config.app_token)
        assert "signing-secret" not in str(config.signing_secret)

    def test_bot_token_required(self):
        """Bot token is required."""
        with pytest.raises(ValidationError) as exc_info:
            SlackBridgeConfig(
                app_token=SecretStr("xapp-test"),
                signing_secret=SecretStr("secret"),
                routing_policy={},
                rbac_map={},
            )

        assert "bot_token" in str(exc_info.value)

    def test_app_token_required(self):
        """App token is required."""
        with pytest.raises(ValidationError) as exc_info:
            SlackBridgeConfig(
                bot_token=SecretStr("xoxb-test"),
                signing_secret=SecretStr("secret"),
                routing_policy={},
                rbac_map={},
            )

        assert "app_token" in str(exc_info.value)

    def test_signing_secret_required(self):
        """Signing secret is required."""
        with pytest.raises(ValidationError) as exc_info:
            SlackBridgeConfig(
                bot_token=SecretStr("xoxb-test"),
                app_token=SecretStr("xapp-test"),
                routing_policy={},
                rbac_map={},
            )

        assert "signing_secret" in str(exc_info.value)

    def test_routing_policy_required(self):
        """Routing policy is required."""
        with pytest.raises(ValidationError) as exc_info:
            SlackBridgeConfig(
                bot_token=SecretStr("xoxb-test"),
                app_token=SecretStr("xapp-test"),
                signing_secret=SecretStr("secret"),
                rbac_map={},
            )

        assert "routing_policy" in str(exc_info.value)

    def test_rbac_map_required(self):
        """RBAC map is required."""
        with pytest.raises(ValidationError) as exc_info:
            SlackBridgeConfig(
                bot_token=SecretStr("xoxb-test"),
                app_token=SecretStr("xapp-test"),
                signing_secret=SecretStr("secret"),
                routing_policy={},
            )

        assert "rbac_map" in str(exc_info.value)

    def test_config_serialization_excludes_secrets(self):
        """Config serialization excludes secret values by default."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-secret"),
            app_token=SecretStr("xapp-secret"),
            signing_secret=SecretStr("signing-secret"),
            routing_policy={},
            rbac_map={},
        )

        # model_dump excludes secrets by default in mode='json'
        data = config.model_dump(mode="json")

        # Verify secrets are represented as masked strings
        assert "xoxb-secret" not in str(data)
        assert "xapp-secret" not in str(data)

    def test_config_from_dict(self):
        """Config can be created from dictionary."""
        data = {
            "bot_token": "xoxb-test",
            "app_token": "xapp-test",
            "signing_secret": "secret",
            "routing_policy": {
                "hitl_4_code": {
                    "channel_id": "C001",
                    "required_role": "reviewer",
                }
            },
            "rbac_map": {"U001": ["reviewer"]},
        }

        config = SlackBridgeConfig(**data)

        assert config.bot_token.get_secret_value() == "xoxb-test"
        assert "hitl_4_code" in config.routing_policy

    def test_default_ideas_emoji(self):
        """Default ideas emoji is 'bulb'."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )

        assert config.ideas_emoji == "bulb"

    def test_default_ideas_channels_empty(self):
        """Default ideas channels is empty list."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )

        assert config.ideas_channels == []

    def test_empty_routing_policy_allowed(self):
        """Empty routing policy is allowed (but not recommended)."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )

        assert config.routing_policy == {}

    def test_empty_rbac_map_allowed(self):
        """Empty RBAC map is allowed (but not recommended)."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )

        assert config.rbac_map == {}
