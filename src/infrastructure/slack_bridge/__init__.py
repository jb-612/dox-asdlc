"""Slack HITL Bridge for gate notifications and decision capture.

This module provides a Slack integration for the aSDLC HITL (Human-In-The-Loop)
system. It consumes gate request events from Redis Streams and posts them to
configured Slack channels, allowing humans to approve or reject gates via
Slack button interactions.

Components:
- config: Configuration models (SlackBridgeConfig, ChannelConfig)
- rbac: Role-based access control validation
- policy: Gate type to channel routing
- blocks: Block Kit message builders
- gate_consumer: Redis Streams consumer for gate events
- decision_handler: Handles approval/rejection decisions
- idea_handler: Captures ideas from Slack messages and reactions
- bridge: Main Slack Bolt application
"""

from src.infrastructure.slack_bridge.blocks import (
    build_approved_blocks,
    build_gate_request_blocks,
    build_rejected_blocks,
    build_rejection_modal,
)
from src.infrastructure.slack_bridge.config import (
    ChannelConfig,
    SlackBridgeConfig,
)
from src.infrastructure.slack_bridge.decision_handler import (
    DecisionHandler,
    GateAlreadyDecidedException,
    GateNotFoundException,
    RBACDeniedException,
)
from src.infrastructure.slack_bridge.gate_consumer import GateConsumer
from src.infrastructure.slack_bridge.idea_handler import IdeaHandler
from src.infrastructure.slack_bridge.policy import RoutingPolicy
from src.infrastructure.slack_bridge.rbac import RBACValidator


def __getattr__(name: str):
    """Lazy import for SlackBridge to avoid slack_bolt dependency at import time."""
    if name == "SlackBridge":
        from src.infrastructure.slack_bridge.bridge import SlackBridge
        return SlackBridge
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    # Config
    "ChannelConfig",
    "SlackBridgeConfig",
    # RBAC
    "RBACValidator",
    # Policy
    "RoutingPolicy",
    # Blocks
    "build_gate_request_blocks",
    "build_approved_blocks",
    "build_rejected_blocks",
    "build_rejection_modal",
    # Consumer
    "GateConsumer",
    # Idea Handler
    "IdeaHandler",
    # Decision Handler
    "DecisionHandler",
    "GateAlreadyDecidedException",
    "GateNotFoundException",
    "RBACDeniedException",
    # Bridge (lazy import)
    "SlackBridge",
]
