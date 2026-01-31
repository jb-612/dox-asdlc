# P08-F02: Slack HITL Bridge - Technical Design

## Overview

Implement a **system-wide Slack HITL Bridge** that serves as a durable adapter for ALL HITL gates in the aSDLC system. The bridge consumes gate requests from Redis Streams, routes them to appropriate Slack channels based on policy, and captures human decisions back to the event stream.

This is NOT just an idea ingestion feature - it is the primary human interface for production HITL gate approvals via Slack.

### Problem Statement

The current HITL system requires users to be in the HITL UI to approve/reject gates. This creates friction:
- Humans may not be monitoring the UI constantly
- No mobile-friendly approval path
- No notifications when gates are waiting
- No audit trail in the team's primary communication tool

### Solution

A Slack HITL Bridge that:
1. **Consumes** `GATE_REQUESTED` events from Redis Streams
2. **Routes** to Slack channels based on policy (gate_type + environment + risk level)
3. **Renders** Block Kit UI with evidence links and Approve/Reject buttons
4. **Captures** decisions via Slack button clicks
5. **Publishes** `GATE_APPROVED` or `GATE_REJECTED` back to Redis Streams
6. **Bonus:** Also ingests ideas from Slack channels for Mindflare Hub

## Architecture

### System Context

```
+------------------------------------------------------------------+
|                     Slack HITL Bridge                             |
+------------------------------------------------------------------+
|                                                                   |
|  +--------------------------+    +--------------------------+    |
|  |   Part A: Gate OUT       |    |   Part B: Decision IN    |    |
|  +--------------------------+    +--------------------------+    |
|  |                          |    |                          |    |
|  | GateConsumer             |    | DecisionHandler          |    |
|  |   |                      |    |   |                      |    |
|  |   +-> Read GATE_REQUESTED|    |   +-> Handle button click|    |
|  |   +-> Policy lookup      |    |   +-> RBAC validation    |    |
|  |   +-> Render Block Kit   |    |   +-> Publish decision   |    |
|  |   +-> Post to Slack      |    |   +-> Update message     |    |
|  |                          |    |                          |    |
|  +--------------------------+    +--------------------------+    |
|                                                                   |
|  +--------------------------+                                     |
|  |   Part C: Ideas IN       |                                     |
|  +--------------------------+                                     |
|  |                          |                                     |
|  | IdeaHandler              |                                     |
|  |   +-> Listen for messages|                                     |
|  |   +-> Listen for emoji   |                                     |
|  |   +-> Create idea via API|                                     |
|  |                          |                                     |
|  +--------------------------+                                     |
|                                                                   |
+------------------------------------------------------------------+
```

### Event Flow

```
Agent hits gate threshold
        |
        v
HITLDispatcher.request_gate()  [EXISTING - src/orchestrator/hitl_dispatcher.py]
        |
        v
Redis Stream: GATE_REQUESTED   [EXISTING - asdlc:events]
        |
        v
+-----------------------------------------------+
| Slack HITL Bridge (NEW)                       |
|                                               |
|  GateConsumer reads from consumer group       |
|         |                                     |
|         v                                     |
|  Policy lookup: gate_type -> channel_id       |
|         |                                     |
|         v                                     |
|  Render Block Kit: evidence link + buttons    |
|         |                                     |
|         v                                     |
|  Post to Slack channel via Socket Mode        |
+-----------------------------------------------+
        |
        v
Human sees message in Slack
Human clicks [Approve] or [Reject]
        |
        v
+-----------------------------------------------+
| Slack HITL Bridge                             |
|                                               |
|  handle_approval() or handle_rejection()      |
|         |                                     |
|         v                                     |
|  RBAC check: user has approver role?          |
|         |                                     |
|         v                                     |
|  Publish GATE_APPROVED/REJECTED to stream     |
|         |                                     |
|         v                                     |
|  Update Slack message (remove buttons)        |
+-----------------------------------------------+
        |
        v
Redis Stream: GATE_APPROVED or GATE_REJECTED
        |
        v
HITLDispatcher.record_decision()  [EXISTING - called by orchestrator consumer]
        |
        v
Task resumes / workflow continues
```

## Dependencies

### Internal Dependencies

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| HITLDispatcher | `src/orchestrator/hitl_dispatcher.py` | Publishes GATE_REQUESTED events | Exists |
| GateType enum | `src/orchestrator/evidence_bundle.py` | Gate type definitions | Exists |
| GateStatus enum | `src/orchestrator/evidence_bundle.py` | Gate status definitions | Exists |
| EvidenceBundle | `src/orchestrator/evidence_bundle.py` | Evidence model | Exists |
| Redis Streams | `src/infrastructure/redis_streams.py` | Event pub/sub | Exists |
| ASDLCEvent | `src/core/events.py` | Event model | Exists |
| EventType enum | `src/core/events.py` | Event type definitions | Exists |
| IdeasService | P08-F01 | Idea creation API | Required |
| SecretsService | P05-F13 | Encrypted credential storage and retrieval | Required |

### External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| slack-bolt | ^1.18.0 | Slack app framework with Socket Mode |
| slack-sdk | ^3.23.0 | Slack API client |

## Interfaces

### Configuration Model

```python
# src/infrastructure/slack_bridge/config.py

from pydantic import BaseModel


class ChannelConfig(BaseModel):
    """Channel routing configuration for a gate type."""

    channel_id: str                    # Slack channel ID (C...)
    required_role: str                 # Role required to approve
    mention_users: list[str] = []      # User IDs to @mention
    mention_groups: list[str] = []     # User group IDs to @mention


class SlackBridgeConfig(BaseModel):
    """Slack HITL Bridge configuration."""

    # References to stored credentials in Admin UI (P05-F13)
    bot_token_id: str              # Reference to encrypted bot_token credential
    app_token_id: str              # Reference to encrypted app_token credential
    signing_secret_id: str         # Reference to encrypted signing_secret credential

    # Routing policy: gate_type -> channel config
    routing_policy: dict[str, ChannelConfig]

    # Environment routing (optional override by env)
    environment_overrides: dict[str, dict[str, ChannelConfig]] = {}

    # RBAC: slack_user_id -> list of roles
    rbac_map: dict[str, list[str]]

    # Ideas ingestion config
    ideas_channels: list[str] = []     # Channel IDs to monitor for ideas
    ideas_emoji: str = "bulb"          # Emoji name (without colons)

    # Consumer group config
    consumer_group: str = "slack_bridge"
    consumer_name: str = "bridge_1"


# Example configuration:
# {
#   "routing_policy": {
#     "hitl_1_backlog": {"channel_id": "C123...", "required_role": "pm"},
#     "hitl_2_design": {"channel_id": "C456...", "required_role": "architect"},
#     "hitl_3_plan": {"channel_id": "C456...", "required_role": "lead"},
#     "hitl_4_code": {"channel_id": "C789...", "required_role": "reviewer"},
#     "hitl_5_validation": {"channel_id": "C789...", "required_role": "qa"},
#     "hitl_6_release": {"channel_id": "CABC...", "required_role": "release_manager"}
#   },
#   "rbac_map": {
#     "U12345": ["pm", "architect", "lead"],
#     "U67890": ["reviewer", "qa"],
#     "UABCDE": ["release_manager"]
#   }
# }
```

### Credential Management

Slack credentials are stored via the Admin UI (P05-F13 Integration Credentials):

| Credential Type | Purpose | Admin UI Field |
|-----------------|---------|----------------|
| `bot_token` | Bot OAuth token (xoxb-...) | Integration Credentials > Slack > Bot Token |
| `app_token` | App-level token (xapp-...) | Integration Credentials > Slack > App Token |
| `signing_secret` | Request signature verification | Integration Credentials > Slack > Signing Secret |

#### Credential Retrieval

The bridge retrieves decrypted credentials at startup via the SecretsService:

```python
from src.infrastructure.secrets.service import get_secrets_service

async def get_slack_credentials(config: SlackBridgeConfig) -> dict[str, str]:
    """Retrieve decrypted Slack credentials from store."""
    service = get_secrets_service()
    return {
        "bot_token": await service.retrieve(config.bot_token_id),
        "app_token": await service.retrieve(config.app_token_id),
        "signing_secret": await service.retrieve(config.signing_secret_id),
    }
```

This approach:
- Keeps secrets encrypted at rest (AES-256-GCM via Fernet)
- Allows credential rotation via Admin UI without config changes
- Enables credential testing before deployment (Admin UI test button)
- Centralizes secret management across all integrations

### Block Kit Message Format

```python
# Gate request message structure

def build_gate_request_blocks(
    request_id: str,
    gate_type: str,
    task_id: str,
    summary: str,
    evidence_url: str,
    requester: str,
) -> list[dict]:
    """Build Block Kit blocks for gate request message."""
    return [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"HITL Gate: {gate_type.upper().replace('_', ' ')}",
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Task:* {task_id}\n*Summary:* {summary}\n*Requested by:* {requester}",
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"<{evidence_url}|View Evidence Bundle>",
            }
        },
        {
            "type": "actions",
            "block_id": f"gate_actions_{request_id}",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Approve"},
                    "style": "primary",
                    "action_id": "approve_gate",
                    "value": request_id,
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Reject"},
                    "style": "danger",
                    "action_id": "reject_gate",
                    "value": request_id,
                },
            ]
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Request ID: `{request_id}`"
                }
            ]
        }
    ]
```

### Decision Handler Interface

```python
# src/infrastructure/slack_bridge/decision_handler.py

async def handle_gate_approval(
    request_id: str,
    slack_user_id: str,
    reason: str | None = None,
) -> bool:
    """Handle gate approval from Slack button click.

    Args:
        request_id: The gate request ID from button value.
        slack_user_id: Slack user who clicked approve.
        reason: Optional approval reason.

    Returns:
        True if approval was processed, False if RBAC denied.
    """
    ...

async def handle_gate_rejection(
    request_id: str,
    slack_user_id: str,
    reason: str,
) -> bool:
    """Handle gate rejection from Slack button click.

    Args:
        request_id: The gate request ID from button value.
        slack_user_id: Slack user who clicked reject.
        reason: Required rejection reason.

    Returns:
        True if rejection was processed, False if RBAC denied.
    """
    ...
```

## Technical Approach

### Socket Mode (No Webhooks)

The bridge uses Slack Socket Mode for security:
- **Outbound-only connections** - No inbound webhook URLs to secure
- **No public endpoints** - Bridge runs inside private network
- **Automatic reconnection** - Bolt SDK handles connection management

### Consumer Group Pattern

```python
# src/infrastructure/slack_bridge/gate_consumer.py

class GateConsumer:
    """Consumes gate events from Redis Streams."""

    STREAM_NAME = "asdlc:events"
    GROUP_NAME = "slack_bridge"

    def __init__(
        self,
        redis_client: redis.Redis,
        slack_client: WebClient,
        config: SlackBridgeConfig,
    ):
        self.redis = redis_client
        self.slack = slack_client
        self.config = config

    async def run(self) -> None:
        """Main consumer loop."""
        # Ensure consumer group exists
        await create_consumer_group(
            self.redis,
            self.STREAM_NAME,
            self.GROUP_NAME,
        )

        while True:
            events = await read_events_from_group(
                self.redis,
                self.GROUP_NAME,
                self.config.consumer_name,
                self.STREAM_NAME,
                count=10,
                block_ms=5000,
            )

            for event in events:
                if event.event_type == EventType.GATE_REQUESTED:
                    await self.handle_gate_requested(event)
                    await acknowledge_event(
                        self.redis,
                        self.STREAM_NAME,
                        self.GROUP_NAME,
                        event.event_id,
                    )

    async def handle_gate_requested(self, event: ASDLCEvent) -> None:
        """Handle a gate requested event."""
        gate_type = event.metadata.get("gate_type")
        request_id = event.metadata.get("request_id")

        # Look up routing
        channel_config = self.get_channel_for_gate(gate_type)
        if not channel_config:
            logger.warning(f"No routing for gate type: {gate_type}")
            return

        # Build and send message
        blocks = build_gate_request_blocks(
            request_id=request_id,
            gate_type=gate_type,
            task_id=event.task_id,
            summary=event.metadata.get("summary", ""),
            evidence_url=self.build_evidence_url(request_id),
            requester=event.metadata.get("requested_by", ""),
        )

        await self.slack.chat_postMessage(
            channel=channel_config.channel_id,
            blocks=blocks,
            text=f"HITL Gate: {gate_type}",  # Fallback for notifications
        )
```

### RBAC Validation

```python
# src/infrastructure/slack_bridge/rbac.py

class RBACValidator:
    """Validates Slack users have required roles."""

    def __init__(self, rbac_map: dict[str, list[str]]):
        self.rbac_map = rbac_map

    def has_role(self, slack_user_id: str, required_role: str) -> bool:
        """Check if user has the required role."""
        user_roles = self.rbac_map.get(slack_user_id, [])
        return required_role in user_roles

    def can_approve_gate(
        self,
        slack_user_id: str,
        gate_type: str,
        channel_config: ChannelConfig,
    ) -> bool:
        """Check if user can approve this gate type."""
        return self.has_role(slack_user_id, channel_config.required_role)
```

### Rejection Modal

When user clicks Reject, open a modal to capture the reason:

```python
def build_rejection_modal(request_id: str) -> dict:
    """Build modal for rejection reason."""
    return {
        "type": "modal",
        "callback_id": f"rejection_modal_{request_id}",
        "title": {"type": "plain_text", "text": "Reject Gate"},
        "submit": {"type": "plain_text", "text": "Reject"},
        "close": {"type": "plain_text", "text": "Cancel"},
        "blocks": [
            {
                "type": "input",
                "block_id": "reason_block",
                "label": {"type": "plain_text", "text": "Rejection Reason"},
                "element": {
                    "type": "plain_text_input",
                    "action_id": "reason_input",
                    "multiline": True,
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Please explain why this gate is being rejected..."
                    }
                }
            }
        ],
        "private_metadata": request_id,
    }
```

### Ideas Ingestion (Part C)

```python
# src/infrastructure/slack_bridge/idea_handler.py

class IdeaHandler:
    """Handles idea ingestion from Slack."""

    def __init__(
        self,
        ideas_service: IdeasService,
        config: SlackBridgeConfig,
    ):
        self.ideas_service = ideas_service
        self.config = config

    async def handle_message(self, event: dict) -> None:
        """Handle message event in ideas channel."""
        channel = event.get("channel")
        if channel not in self.config.ideas_channels:
            return

        # Create idea from message
        await self.create_idea_from_message(event)

    async def handle_reaction(self, event: dict) -> None:
        """Handle emoji reaction for idea capture."""
        if event.get("reaction") != self.config.ideas_emoji:
            return

        # Fetch original message and create idea
        ...

    async def create_idea_from_message(self, message: dict) -> None:
        """Create idea via IdeasService."""
        source_ref = f"slack:{message['team']}:{message['channel']}:{message['ts']}"

        # Check for duplicate
        if await self.ideas_service.exists_by_source_ref(source_ref):
            return

        await self.ideas_service.create_idea(
            content=message.get("text", ""),
            author_id=f"slack:{message['user']}",
            source="SLACK",
            source_ref=source_ref,
        )
```

## File Structure

```
src/infrastructure/slack_bridge/
    __init__.py
    bridge.py              # Main Slack Bolt AsyncApp, entry point
    config.py              # SlackBridgeConfig and ChannelConfig models
    gate_consumer.py       # Consumes GATE_REQUESTED from Redis Streams
    decision_handler.py    # Handles Approve/Reject button clicks
    idea_handler.py        # Handles idea ingestion from channels
    policy.py              # Routing policy lookup
    rbac.py                # Slack user -> role validation
    blocks.py              # Block Kit message builders

docker/slack-bridge/
    Dockerfile
    requirements.txt

tests/unit/infrastructure/slack_bridge/
    test_config.py
    test_gate_consumer.py
    test_decision_handler.py
    test_idea_handler.py
    test_rbac.py
    test_blocks.py

tests/integration/infrastructure/
    test_slack_bridge.py   # Integration tests with mock Slack
```

## Security Considerations

1. **Socket Mode** - No inbound webhooks, outbound-only connections
2. **Credential Storage** - All tokens stored via SecretsService (P05-F13) with AES-256-GCM encryption at rest; config stores credential IDs only, not raw secrets
3. **RBAC Enforcement** - Users can only approve gates matching their roles
4. **Evidence Links** - Link to UI, never embed sensitive content in Slack
5. **Audit Trail** - All decisions logged with Slack user ID
6. **Rate Limiting** - Consumer group handles backpressure naturally
7. **Credential Rotation** - Tokens can be rotated via Admin UI without redeploying the bridge

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Slack API downtime | High | Low | Queue messages, retry with backoff |
| Message replay attack | Medium | Low | Store message_ts, reject duplicates |
| RBAC bypass | High | Low | Validate on every action, log denials |
| Consumer crash | Medium | Medium | Consumer group tracks pending, auto-recover |
| Config drift | Medium | Medium | Validate config on startup, health checks |

## Success Metrics

1. **Notification latency** - Gate request to Slack message < 5 seconds
2. **Decision capture** - 99%+ of button clicks successfully recorded
3. **RBAC accuracy** - Zero unauthorized approvals
4. **Uptime** - Bridge available 99.9% of time
5. **Idea capture** - 95%+ of triggered ideas successfully created
