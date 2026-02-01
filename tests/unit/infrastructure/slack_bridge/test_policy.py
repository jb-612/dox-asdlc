"""Unit tests for Slack Bridge routing policy.

Tests the RoutingPolicy class for gate-to-channel routing.
"""

from __future__ import annotations

import pytest
from pydantic import SecretStr

from src.infrastructure.slack_bridge.config import ChannelConfig, SlackBridgeConfig
from src.infrastructure.slack_bridge.policy import RoutingPolicy


class TestRoutingPolicy:
    """Tests for RoutingPolicy class."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={
                "hitl_1_backlog": ChannelConfig(
                    channel_id="C-BACKLOG",
                    required_role="pm",
                ),
                "hitl_2_design": ChannelConfig(
                    channel_id="C-DESIGN",
                    required_role="architect",
                ),
                "hitl_4_code": ChannelConfig(
                    channel_id="C-CODE",
                    required_role="reviewer",
                ),
                "hitl_6_release": ChannelConfig(
                    channel_id="C-RELEASE",
                    required_role="release_manager",
                ),
            },
            environment_overrides={
                "production": {
                    "hitl_6_release": ChannelConfig(
                        channel_id="C-PROD-RELEASE",
                        required_role="release_manager",
                        mention_groups=["S-RELEASE-TEAM"],
                    ),
                },
                "staging": {
                    "hitl_4_code": ChannelConfig(
                        channel_id="C-STAGING-CODE",
                        required_role="qa",
                    ),
                },
            },
            rbac_map={},
        )

    @pytest.fixture
    def policy(self, config: SlackBridgeConfig) -> RoutingPolicy:
        """Create RoutingPolicy instance."""
        return RoutingPolicy(config)

    def test_get_channel_for_gate_basic(self, policy: RoutingPolicy):
        """Get channel for gate without environment override."""
        channel = policy.get_channel_for_gate("hitl_1_backlog")

        assert channel is not None
        assert channel.channel_id == "C-BACKLOG"
        assert channel.required_role == "pm"

    def test_get_channel_for_gate_returns_channel_config(self, policy: RoutingPolicy):
        """Returns ChannelConfig instance."""
        channel = policy.get_channel_for_gate("hitl_4_code")

        assert isinstance(channel, ChannelConfig)
        assert channel.channel_id == "C-CODE"
        assert channel.required_role == "reviewer"

    def test_get_channel_for_gate_unknown_type(self, policy: RoutingPolicy):
        """Unknown gate type returns None."""
        channel = policy.get_channel_for_gate("hitl_99_unknown")

        assert channel is None

    def test_get_channel_for_gate_with_environment_override(self, policy: RoutingPolicy):
        """Environment override takes precedence."""
        channel = policy.get_channel_for_gate("hitl_6_release", environment="production")

        assert channel is not None
        assert channel.channel_id == "C-PROD-RELEASE"
        assert channel.mention_groups == ["S-RELEASE-TEAM"]

    def test_get_channel_for_gate_environment_override_only_for_specified(
        self, policy: RoutingPolicy
    ):
        """Environment override only applies to gates defined in that environment."""
        # hitl_1_backlog has no production override, should use default
        channel = policy.get_channel_for_gate("hitl_1_backlog", environment="production")

        assert channel is not None
        assert channel.channel_id == "C-BACKLOG"  # Default, not overridden

    def test_get_channel_for_gate_different_environments(self, policy: RoutingPolicy):
        """Different environments have different overrides."""
        prod_channel = policy.get_channel_for_gate("hitl_6_release", environment="production")
        staging_channel = policy.get_channel_for_gate("hitl_6_release", environment="staging")
        default_channel = policy.get_channel_for_gate("hitl_6_release")

        assert prod_channel.channel_id == "C-PROD-RELEASE"
        # staging has no hitl_6_release override, falls back to default
        assert staging_channel.channel_id == "C-RELEASE"
        assert default_channel.channel_id == "C-RELEASE"

    def test_get_channel_for_gate_staging_override(self, policy: RoutingPolicy):
        """Staging environment override works."""
        channel = policy.get_channel_for_gate("hitl_4_code", environment="staging")

        assert channel is not None
        assert channel.channel_id == "C-STAGING-CODE"
        assert channel.required_role == "qa"

    def test_get_channel_for_gate_unknown_environment(self, policy: RoutingPolicy):
        """Unknown environment falls back to default routing."""
        channel = policy.get_channel_for_gate("hitl_4_code", environment="unknown_env")

        assert channel is not None
        assert channel.channel_id == "C-CODE"  # Default


class TestRoutingPolicyEdgeCases:
    """Edge case tests for RoutingPolicy."""

    def test_empty_routing_policy(self):
        """Policy with no routes returns None for all gates."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )
        policy = RoutingPolicy(config)

        assert policy.get_channel_for_gate("hitl_4_code") is None

    def test_no_environment_overrides(self):
        """Policy works without environment overrides."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={
                "hitl_4_code": ChannelConfig(
                    channel_id="C-CODE",
                    required_role="reviewer",
                ),
            },
            environment_overrides={},
            rbac_map={},
        )
        policy = RoutingPolicy(config)

        # Should still work with production environment specified
        channel = policy.get_channel_for_gate("hitl_4_code", environment="production")
        assert channel is not None
        assert channel.channel_id == "C-CODE"

    def test_case_sensitive_gate_types(self):
        """Gate types are case-sensitive."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={
                "hitl_4_code": ChannelConfig(
                    channel_id="C-CODE",
                    required_role="reviewer",
                ),
            },
            rbac_map={},
        )
        policy = RoutingPolicy(config)

        assert policy.get_channel_for_gate("hitl_4_code") is not None
        assert policy.get_channel_for_gate("HITL_4_CODE") is None
        assert policy.get_channel_for_gate("Hitl_4_Code") is None

    def test_case_sensitive_environments(self):
        """Environment names are case-sensitive."""
        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={
                "hitl_4_code": ChannelConfig(
                    channel_id="C-DEFAULT",
                    required_role="reviewer",
                ),
            },
            environment_overrides={
                "production": {
                    "hitl_4_code": ChannelConfig(
                        channel_id="C-PROD",
                        required_role="reviewer",
                    ),
                },
            },
            rbac_map={},
        )
        policy = RoutingPolicy(config)

        assert policy.get_channel_for_gate("hitl_4_code", "production").channel_id == "C-PROD"
        assert policy.get_channel_for_gate("hitl_4_code", "PRODUCTION").channel_id == "C-DEFAULT"
        assert policy.get_channel_for_gate("hitl_4_code", "Production").channel_id == "C-DEFAULT"
