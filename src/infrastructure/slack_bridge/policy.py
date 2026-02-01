"""Routing policy for Slack HITL Bridge.

Provides gate type to channel routing with environment override support.
"""

from __future__ import annotations

import logging

from src.infrastructure.slack_bridge.config import ChannelConfig, SlackBridgeConfig

logger = logging.getLogger(__name__)


class RoutingPolicy:
    """Routes gate types to Slack channels with environment support.

    Determines which Slack channel should receive notifications for
    each gate type. Supports environment-specific overrides for
    production, staging, etc.

    Attributes:
        config: The SlackBridgeConfig containing routing rules.

    Example:
        ```python
        policy = RoutingPolicy(config)

        # Get default channel for code review gates
        channel = policy.get_channel_for_gate("hitl_4_code")

        # Get production-specific channel
        channel = policy.get_channel_for_gate("hitl_6_release", "production")
        ```
    """

    def __init__(self, config: SlackBridgeConfig) -> None:
        """Initialize the routing policy.

        Args:
            config: SlackBridgeConfig with routing_policy and environment_overrides.
        """
        self.config = config

    def get_channel_for_gate(
        self,
        gate_type: str,
        environment: str | None = None,
    ) -> ChannelConfig | None:
        """Get the channel configuration for a gate type.

        If an environment is specified and has an override for the gate type,
        that override is used. Otherwise, falls back to the default routing.

        Args:
            gate_type: The gate type (e.g., "hitl_4_code", "hitl_6_release").
            environment: Optional environment name (e.g., "production", "staging").

        Returns:
            ChannelConfig for the gate, or None if no routing is configured.
        """
        # Check for environment override first
        if environment:
            env_overrides = self.config.environment_overrides.get(environment, {})
            if gate_type in env_overrides:
                logger.debug(f"Using {environment} override for gate {gate_type}")
                return env_overrides[gate_type]

        # Fall back to default routing
        channel = self.config.routing_policy.get(gate_type)

        if channel is None:
            logger.warning(f"No routing configured for gate type: {gate_type}")

        return channel
