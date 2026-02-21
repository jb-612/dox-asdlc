# P08-F08: Slack Bidirectional HITL - Technical Design

## Overview

Generalize the Slack HITL Bridge from simple gate approve/reject into a **rich bidirectional agent-human communication channel**. Agents can ask free-text questions, present choices, send notifications, and request acknowledgements -- all routed through Slack and captured back into the event stream for the waiting agent.

### Problem Statement

The existing Slack Bridge (P08-F02) supports only one interaction pattern: gate requests with binary Approve/Reject responses. Agents frequently need richer human communication:

- **Clarification questions** -- "The PRD mentions 'fast enough'. What latency target (ms) should I use?"
- **Multi-option choices** -- "Found 3 approaches for the cache layer. Which should I pursue?"
- **Progress notifications** -- "Phase 2 complete. Starting integration tests." (no response needed)
- **Acknowledgements** -- "Deployment to staging complete. Please verify and confirm."
- **Free-text input** -- "Describe the expected behavior when the user clicks Cancel."

Without this, agents must either halt at a full HITL gate (too heavy) or proceed without human input (too risky).

### Goals

1. Introduce an `InteractionDispatcher` that extends the HITLDispatcher pattern for general interactions.
2. Define new event types: `INTERACTION_REQUESTED`, `INTERACTION_RESPONSE`, `INTERACTION_TIMEOUT`.
3. Build Slack Block Kit layouts for each interaction type.
4. Implement response routing from Slack back to the correct waiting agent.
5. Support configurable timeouts with fallback strategies.
6. Enable multiple agents to have concurrent pending interactions.

### Non-Goals

- Replacing the existing gate approve/reject flow (it continues to work as-is).
- Supporting Slack threads for multi-turn conversations (Phase 3).
- Supporting channels other than Slack (extensibility is designed for, not built).
- Voice or video interactions.

## Architecture

### Extended System Context

```
+--------------------------------------------------------------------------+
|                        Slack HITL Bridge (Extended)                       |
+--------------------------------------------------------------------------+
|                                                                          |
|  +----------------------------+    +----------------------------+        |
|  |   Part A: Gate OUT         |    |   Part B: Decision IN      |        |
|  |   (EXISTING - unchanged)   |    |   (EXISTING - unchanged)   |        |
|  |   GateConsumer             |    |   DecisionHandler          |        |
|  +----------------------------+    +----------------------------+        |
|                                                                          |
|  +----------------------------+    +----------------------------+        |
|  |   Part D: Interaction OUT  |    |   Part E: Response IN      |        |
|  |   (NEW)                    |    |   (NEW)                    |        |
|  +----------------------------+    +----------------------------+        |
|  |                            |    |                            |        |
|  | InteractionConsumer        |    | ResponseHandler            |        |
|  |   +-> Read INTERACTION_    |    |   +-> Handle button click  |        |
|  |       REQUESTED            |    |   +-> Handle modal submit  |        |
|  |   +-> Determine type       |    |   +-> Validate interaction |        |
|  |   +-> Render Block Kit     |    |   +-> Publish INTERACTION_ |        |
|  |   +-> Post to Slack        |    |       RESPONSE             |        |
|  |   +-> Store message_ts     |    |   +-> Update Slack message |        |
|  |       for response routing |    |                            |        |
|  +----------------------------+    +----------------------------+        |
|                                                                          |
|  +----------------------------+    +----------------------------+        |
|  |   Part C: Ideas IN         |    |   Part F: Timeout Monitor  |        |
|  |   (EXISTING - unchanged)   |    |   (NEW)                    |        |
|  |   IdeaHandler              |    |   TimeoutMonitor           |        |
|  +----------------------------+    +----------------------------+        |
|                                                                          |
+--------------------------------------------------------------------------+
```

### Event Flow: Agent Question -> Human Response

```
Agent needs clarification
        |
        v
InteractionDispatcher.request_interaction(
    type="question",
    prompt="What latency target?",
    session_id="p11-guardrails",
    agent_id="backend",
)
        |
        v
Redis Hash: asdlc:interaction:{interaction_id}
    status: PENDING
    type: question
    prompt: "What latency target?"
    session_id: p11-guardrails
    agent_id: backend
        |
        v
Redis Stream: INTERACTION_REQUESTED  [asdlc:events]
    event_type: interaction_requested
    metadata: { interaction_id, type, prompt, session_id, agent_id }
        |
        v
+-------------------------------------------------------+
| Slack HITL Bridge - InteractionConsumer                |
|                                                        |
|  Read INTERACTION_REQUESTED from consumer group        |
|         |                                              |
|         v                                              |
|  Routing: session_id -> channel (via routing policy)   |
|         |                                              |
|         v                                              |
|  Render Block Kit: question + "Answer" button          |
|         |                                              |
|         v                                              |
|  Post to Slack, store message_ts mapping               |
+-------------------------------------------------------+
        |
        v
Human sees question in Slack
Human clicks [Answer], types response in modal, submits
        |
        v
+-------------------------------------------------------+
| Slack HITL Bridge - ResponseHandler                    |
|                                                        |
|  Extract interaction_id from button value              |
|  Open text-input modal                                 |
|  On modal submit:                                      |
|    - Extract response_text                             |
|    - Publish INTERACTION_RESPONSE to stream            |
|    - Update Slack message (remove button, show answer) |
+-------------------------------------------------------+
        |
        v
Redis Stream: INTERACTION_RESPONSE  [asdlc:events]
    event_type: interaction_response
    metadata: { interaction_id, response_text, responder }
        |
        v
InteractionDispatcher picks up response
Agent resumes with human answer
```

### Event Flow: Agent Choice -> Human Selection

```
Agent presents options
        |
        v
InteractionDispatcher.request_interaction(
    type="choice",
    prompt="Which cache strategy?",
    options=["Redis TTL", "LRU in-process", "CDN edge"],
    session_id="p11-guardrails",
    agent_id="backend",
)
        |
        v
Redis Stream: INTERACTION_REQUESTED
        |
        v
Slack Bridge posts message with 3 buttons
        |
        v
Human clicks "Redis TTL"
        |
        v
ResponseHandler:
  - Extracts interaction_id + selected_option from action value
  - Publishes INTERACTION_RESPONSE with selected_option
  - Updates message: removes buttons, shows selection
        |
        v
Agent resumes with chosen option
```

### Event Flow: Agent Notification (Non-blocking)

```
Agent sends status update
        |
        v
InteractionDispatcher.notify(
    message="Phase 2 complete. 47 tests passed.",
    session_id="p11-guardrails",
    agent_id="backend",
)
        |
        v
Redis Stream: AGENT_NOTIFICATION  [asdlc:events]
        |
        v
Slack Bridge posts informational message (no buttons)
Agent continues immediately (does not block)
```

## New Event Types

Added to `src/core/events.py` in the `EventType` enum:

```python
# Bidirectional HITL interaction events
INTERACTION_REQUESTED = "interaction_requested"
INTERACTION_RESPONSE = "interaction_response"
INTERACTION_TIMEOUT = "interaction_timeout"
AGENT_NOTIFICATION = "agent_notification"
```

### Event Schemas (metadata field contents)

**INTERACTION_REQUESTED**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| interaction_id | string | Yes | Unique interaction identifier (UUID) |
| interaction_type | string | Yes | One of: `question`, `choice`, `acknowledgement` |
| prompt | string | Yes | Human-readable question or message |
| options | list[string] | For `choice` | Available options to select from |
| session_id | string | Yes | Agent session context |
| agent_id | string | Yes | Requesting agent role identifier |
| timeout_seconds | int | No | Seconds before timeout (null = no timeout) |
| fallback_value | string | No | Value to use if timeout occurs |
| priority | string | No | `normal` (default), `urgent` |

**INTERACTION_RESPONSE**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| interaction_id | string | Yes | Matches the request interaction_id |
| response_text | string | For `question` | Free-text human response |
| selected_option | string | For `choice` | The option the human selected |
| responder | string | Yes | Slack user ID of responder |
| responder_name | string | Yes | Display name of responder |

**INTERACTION_TIMEOUT**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| interaction_id | string | Yes | The timed-out interaction |
| fallback_used | boolean | Yes | Whether fallback value was applied |
| fallback_value | string | No | The fallback value if used |

**AGENT_NOTIFICATION**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| notification_id | string | Yes | Unique notification identifier |
| message | string | Yes | Notification message text |
| session_id | string | Yes | Agent session context |
| agent_id | string | Yes | Sending agent |
| level | string | No | `info` (default), `success`, `warning`, `error` |

## Interaction Types and Slack Block Kit Layouts

### Type 1: Question (Free-Text Response)

```
+------------------------------------------+
| Agent Question                           |
+------------------------------------------+
| From: backend (p11-guardrails)           |
|                                          |
| The PRD mentions "fast enough". What     |
| latency target (in ms) should I use for  |
| the API response time?                   |
|                                          |
| [Answer]                                 |
|                                          |
| Interaction: abc123 | Timeout: 30 min    |
+------------------------------------------+
```

Clicking "Answer" opens a modal with a multi-line text input (reusing the rejection modal pattern). On submit, the response text is captured and published.

### Type 2: Choice (Select Option)

```
+------------------------------------------+
| Agent Needs Decision                     |
+------------------------------------------+
| From: backend (p11-guardrails)           |
|                                          |
| Found 3 viable approaches for the cache  |
| layer. Which should I pursue?            |
|                                          |
| [Redis TTL] [LRU In-Process] [CDN Edge] |
|                                          |
| Interaction: def456 | Timeout: 1 hour    |
+------------------------------------------+
```

Each option is a distinct button. The `action_id` is `select_option` and the `value` encodes both `interaction_id` and `option_index`.

### Type 3: Acknowledgement (Confirm Receipt)

```
+------------------------------------------+
| Agent Status - Confirm                   |
+------------------------------------------+
| From: devops (p06-infra)                 |
|                                          |
| Deployment to staging complete.          |
| Service is live at staging.example.com.  |
| Please verify and acknowledge.           |
|                                          |
| [Acknowledged]                           |
|                                          |
| Interaction: ghi789 | Timeout: 2 hours   |
+------------------------------------------+
```

Single "Acknowledged" button. The response captures who acknowledged and when.

### Type 4: Notification (Non-Blocking, No Response)

```
+------------------------------------------+
| Agent Update                             |
+------------------------------------------+
| From: backend (p11-guardrails)           |
|                                          |
| Phase 2 complete. 47 tests passed,       |
| 0 failed. Starting integration tests.    |
|                                          |
| Notification: jkl012                     |
+------------------------------------------+
```

No buttons. Informational only. Agent does not block.

## Core Interfaces

### InteractionDispatcher

```python
# src/orchestrator/interaction_dispatcher.py

@dataclass
class InteractionRequest:
    interaction_id: str
    interaction_type: str          # "question" | "choice" | "acknowledgement"
    prompt: str
    options: list[str]             # Empty for non-choice types
    session_id: str
    agent_id: str
    status: str                    # "pending" | "responded" | "timeout" | "cancelled"
    requested_at: datetime
    timeout_seconds: int | None
    expires_at: datetime | None
    fallback_value: str | None
    priority: str                  # "normal" | "urgent"

@dataclass
class InteractionResponse:
    response_id: str
    interaction_id: str
    response_text: str | None      # For question type
    selected_option: str | None    # For choice type
    responder: str                 # Slack user ID
    responder_name: str            # Display name
    responded_at: datetime

class InteractionDispatcher:
    """Manages bidirectional agent-human interactions via events."""

    INTERACTION_KEY_PREFIX = "asdlc:interaction:"
    PENDING_SET = "asdlc:pending_interactions"

    def __init__(
        self,
        redis_client: redis.Redis,
        event_publisher: Callable[[ASDLCEvent], Awaitable[str]],
    ): ...

    async def request_interaction(
        self,
        interaction_type: str,
        prompt: str,
        session_id: str,
        agent_id: str,
        options: list[str] | None = None,
        timeout_seconds: int | None = None,
        fallback_value: str | None = None,
        priority: str = "normal",
    ) -> InteractionRequest:
        """Create an interaction request and publish event.

        Stores the request in Redis and publishes
        INTERACTION_REQUESTED to the event stream.
        """
        ...

    async def record_response(
        self,
        interaction_id: str,
        response_text: str | None = None,
        selected_option: str | None = None,
        responder: str = "",
        responder_name: str = "",
    ) -> InteractionResponse:
        """Record human response and publish event.

        Updates the interaction status and publishes
        INTERACTION_RESPONSE to the event stream.
        """
        ...

    async def send_notification(
        self,
        message: str,
        session_id: str,
        agent_id: str,
        level: str = "info",
    ) -> str:
        """Send a non-blocking notification. Returns notification_id."""
        ...

    async def get_response(
        self,
        interaction_id: str,
        poll_interval_seconds: float = 2.0,
        max_wait_seconds: float | None = None,
    ) -> InteractionResponse | None:
        """Poll for a response to an interaction. Blocks until response or timeout."""
        ...

    async def check_expired(self) -> list[InteractionRequest]:
        """Find and handle expired interactions."""
        ...
```

### InteractionConsumer (Slack Bridge)

```python
# src/infrastructure/slack_bridge/interaction_consumer.py

class InteractionConsumer:
    """Consumes INTERACTION_REQUESTED events and posts to Slack."""

    STREAM_NAME = "asdlc:events"

    def __init__(
        self,
        redis_client: redis.Redis,
        slack_client: SlackClient,
        config: SlackBridgeConfig,
    ): ...

    async def handle_interaction_requested(self, event: ASDLCEvent) -> None:
        """Route interaction to Slack based on type and policy."""
        ...

    async def run(self) -> None:
        """Main consumer loop - filters for INTERACTION_REQUESTED events."""
        ...
```

### ResponseHandler (Slack Bridge)

```python
# src/infrastructure/slack_bridge/response_handler.py

class ResponseHandler:
    """Handles human responses from Slack interactions."""

    def __init__(
        self,
        redis_client: redis.Redis,
        slack_client: SlackClient,
        config: SlackBridgeConfig,
    ): ...

    async def handle_answer_button(self, body: dict) -> None:
        """Handle 'Answer' button click - opens text input modal."""
        ...

    async def handle_answer_modal_submit(self, view: dict, user_id: str) -> dict:
        """Handle answer modal submission - captures free-text response."""
        ...

    async def handle_option_selected(self, body: dict) -> None:
        """Handle choice option button click."""
        ...

    async def handle_acknowledged(self, body: dict) -> None:
        """Handle acknowledgement button click."""
        ...
```

### Block Kit Builders

```python
# Extended: src/infrastructure/slack_bridge/blocks.py

def build_question_blocks(
    interaction_id: str,
    prompt: str,
    agent_id: str,
    session_id: str,
    timeout_display: str | None = None,
) -> list[dict]: ...

def build_choice_blocks(
    interaction_id: str,
    prompt: str,
    options: list[str],
    agent_id: str,
    session_id: str,
    timeout_display: str | None = None,
) -> list[dict]: ...

def build_acknowledgement_blocks(
    interaction_id: str,
    prompt: str,
    agent_id: str,
    session_id: str,
    timeout_display: str | None = None,
) -> list[dict]: ...

def build_notification_blocks(
    notification_id: str,
    message: str,
    agent_id: str,
    session_id: str,
    level: str = "info",
) -> list[dict]: ...

def build_answered_blocks(
    original_blocks: list[dict],
    responder_name: str,
    response_text: str,
    timestamp: str,
) -> list[dict]: ...

def build_option_selected_blocks(
    original_blocks: list[dict],
    responder_name: str,
    selected_option: str,
    timestamp: str,
) -> list[dict]: ...

def build_acknowledged_blocks(
    original_blocks: list[dict],
    responder_name: str,
    timestamp: str,
) -> list[dict]: ...
```

## Response Routing Mechanism

### Interaction-to-Slack Message Mapping

When the InteractionConsumer posts a Slack message, it stores a mapping:

```
Redis Key: slack_bridge:interaction_msg:{interaction_id}
Value: JSON { "channel_id": "C...", "message_ts": "1234.5678" }
TTL: 86400 (24 hours)
```

This allows the ResponseHandler to update the correct Slack message after a response is captured.

### Interaction Lookup from Slack Action

Slack action payloads encode the `interaction_id` in the button `value` field:

- **Answer button**: `value = interaction_id`
- **Choice button**: `value = interaction_id:option_index`
- **Acknowledge button**: `value = interaction_id`
- **Answer modal**: `private_metadata = JSON { interaction_id, channel_id }`

### Agent Polling for Response

The agent blocks by polling the interaction's Redis hash for a status change:

```python
async def get_response(self, interaction_id, poll_interval=2.0, max_wait=None):
    start = time.monotonic()
    while True:
        data = await self.client.hgetall(f"asdlc:interaction:{interaction_id}")
        if data.get("status") in ("responded", "timeout"):
            return self._build_response(data)
        if max_wait and (time.monotonic() - start) > max_wait:
            return None
        await asyncio.sleep(poll_interval)
```

An alternative pub/sub approach using Redis keyspace notifications could be added later for lower latency, but polling is simpler and sufficient for human-speed interactions.

## Timeout and Fallback Strategy

### Timeout Lifecycle

1. Agent creates interaction with `timeout_seconds=1800` (30 min).
2. InteractionDispatcher stores `expires_at` in the pending set.
3. `TimeoutMonitor` runs as a background task, checking the pending set every 30 seconds.
4. When `expires_at` is reached:
   a. If `fallback_value` is set: mark interaction as `timeout`, store fallback as response, publish `INTERACTION_TIMEOUT` with `fallback_used=true`.
   b. If no fallback: mark as `timeout`, publish `INTERACTION_TIMEOUT` with `fallback_used=false`.
   c. Update Slack message to show timeout status.

### Default Timeouts

| Interaction Type | Default Timeout | Rationale |
|-----------------|----------------|-----------|
| question | 30 minutes | Human may need to research |
| choice | 1 hour | Decision may require discussion |
| acknowledgement | 2 hours | Human may be away |
| notification | None | Non-blocking, no timeout needed |

Defaults can be overridden per-request via `timeout_seconds`.

### Escalation on Timeout

When timeout occurs without a fallback, the agent can:
1. Re-request the interaction with higher priority (`urgent`).
2. Fall back to a safe default in its own logic.
3. Escalate to the PM CLI session.

Escalation policy is not enforced by the dispatcher; it is the agent's responsibility.

## Configuration Extensions

### Routing Policy for Interactions

The existing `routing_policy` maps gate types to channels. Interactions use a new `interaction_routing` section:

```python
# Added to SlackBridgeConfig
class InteractionRoutingConfig(BaseModel):
    """Routing configuration for agent interactions."""
    default_channel_id: str                     # Default channel for interactions
    session_overrides: dict[str, str] = {}      # session_id -> channel_id
    urgent_channel_id: str | None = None        # Channel for urgent interactions
```

This allows routing all interactions from a specific session (e.g., `p11-guardrails`) to a specific Slack channel, or using a default channel for all interactions.

### Extended Config

```json
{
  "interaction_routing": {
    "default_channel_id": "C-AGENT-QUESTIONS",
    "session_overrides": {
      "p11-guardrails": "C-GUARDRAILS",
      "p04-review-swarm": "C-REVIEW"
    },
    "urgent_channel_id": "C-URGENT"
  }
}
```

## Multi-Agent Concurrency

### Concurrent Interaction Support

Multiple agents can have pending interactions simultaneously. Each interaction is independent:

- Unique `interaction_id` (UUID) prevents collision.
- Redis hash per interaction stores all state.
- Sorted set `asdlc:pending_interactions` tracks all pending interactions.
- Slack messages include agent context (agent_id, session_id) so humans know who is asking.

### Race Condition Protection

If two humans try to respond to the same interaction (unlikely but possible in shared channels):

1. ResponseHandler acquires a Redis lock on `slack_bridge:lock:interaction:{id}`.
2. First responder wins; second gets an ephemeral "Already answered" message.
3. Lock pattern reuses the existing `DecisionHandler._acquire_lock` approach.

## Claude Agent SDK Integration

### How Agents Use Interactions

Agents interact with this system through the existing bash tool abstraction. A new tool script wraps the InteractionDispatcher:

```bash
# tools/ask_human.sh
# Usage: ask_human.sh --type question --prompt "What latency?" --timeout 1800
# Returns: JSON { "response_text": "...", "responder": "..." }
```

Internally, the tool:
1. Calls `InteractionDispatcher.request_interaction()` to create the request and publish the event.
2. Calls `InteractionDispatcher.get_response()` to poll/block until the human responds.
3. Returns the response as JSON to stdout for the agent to consume.

### Alternative: Direct Python API

For agents running as Python workers (not via bash tools):

```python
dispatcher = InteractionDispatcher(redis_client, event_publisher)

# Ask a question
request = await dispatcher.request_interaction(
    interaction_type="question",
    prompt="What latency target?",
    session_id="p11-guardrails",
    agent_id="backend",
    timeout_seconds=1800,
    fallback_value="200ms",
)

# Block until response
response = await dispatcher.get_response(request.interaction_id)
if response:
    answer = response.response_text  # Human's answer
else:
    # Timeout occurred, fallback was used
    answer = request.fallback_value
```

## Redis Key Structure

| Key Pattern | Type | Purpose | TTL |
|-------------|------|---------|-----|
| `asdlc:interaction:{id}` | Hash | Interaction request + response data | 7 days |
| `asdlc:pending_interactions` | Sorted Set | Pending interactions (score=expires_at) | None |
| `slack_bridge:interaction_msg:{id}` | String (JSON) | Slack message mapping | 24 hours |
| `slack_bridge:lock:interaction:{id}` | String | Response race condition lock | 30 seconds |
| `slack_bridge:posted_interactions` | Set | Duplicate detection | 24 hours |

## Dependencies

### Internal Dependencies

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| HITLDispatcher | `src/orchestrator/hitl_dispatcher.py` | Pattern reference for dispatcher | Exists |
| SlackBridge | `src/infrastructure/slack_bridge/bridge.py` | Main bridge application | Exists |
| GateConsumer | `src/infrastructure/slack_bridge/gate_consumer.py` | Pattern reference for consumer | Exists |
| DecisionHandler | `src/infrastructure/slack_bridge/decision_handler.py` | Pattern reference for handler | Exists |
| Block Kit builders | `src/infrastructure/slack_bridge/blocks.py` | Extended with new builders | Exists |
| ASDLCEvent | `src/core/events.py` | Event model (EventType extended) | Exists |
| Redis Streams | `src/infrastructure/redis_streams.py` | Event pub/sub infrastructure | Exists |
| RoutingPolicy | `src/infrastructure/slack_bridge/policy.py` | Extended for interaction routing | Exists |
| SlackBridgeConfig | `src/infrastructure/slack_bridge/config.py` | Extended with interaction config | Exists |

### External Dependencies

| Dependency | Version | Purpose | Status |
|-----------|---------|---------|--------|
| slack-bolt | ^1.18.0 | Slack app framework | Already installed |
| slack-sdk | ^3.23.0 | Slack API client | Already installed |
| redis.asyncio | existing | Async Redis operations | Already installed |

No new external dependencies are required.

## File Structure

### New Files

```
src/orchestrator/
    interaction_dispatcher.py          # InteractionDispatcher + data models

src/infrastructure/slack_bridge/
    interaction_consumer.py            # Consumes INTERACTION_REQUESTED events
    response_handler.py                # Handles Slack responses (buttons/modals)
    notification_consumer.py           # Consumes AGENT_NOTIFICATION events
    timeout_monitor.py                 # Background timeout checker

tools/
    ask_human.sh                       # Bash tool wrapper for agent use

tests/unit/orchestrator/
    test_interaction_dispatcher.py

tests/unit/infrastructure/slack_bridge/
    test_interaction_consumer.py
    test_response_handler.py
    test_notification_consumer.py
    test_timeout_monitor.py
    test_interaction_blocks.py         # Tests for new Block Kit builders
```

### Modified Files

```
src/core/events.py                     # Add new EventType values
src/infrastructure/slack_bridge/
    config.py                          # Add InteractionRoutingConfig
    bridge.py                          # Register new action/view handlers
    blocks.py                          # Add interaction Block Kit builders
    policy.py                          # Add interaction routing lookup
```

## Security Considerations

1. **No credential changes** -- Uses existing Slack tokens and RBAC infrastructure.
2. **Response validation** -- ResponseHandler validates interaction_id exists and is pending before accepting responses.
3. **Race condition protection** -- Redis locks prevent duplicate responses.
4. **No sensitive data in Slack** -- Prompts should not contain secrets. Agent developers must be aware that questions are posted to Slack channels.
5. **Audit trail** -- All interactions and responses are logged to the Redis audit stream.
6. **Input sanitization** -- Free-text responses are stored as-is but must be treated as untrusted input by consuming agents.

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Agent blocked indefinitely | High | Medium | Configurable timeouts with fallbacks |
| Response routed to wrong agent | High | Low | UUID-based interaction_id, Redis lock |
| Slack rate limits on many notifications | Medium | Medium | Batch notifications, respect rate limits |
| Human responds after timeout | Low | Medium | Check status before accepting; show "expired" in Slack |
| Concurrent answers to same question | Medium | Low | Redis lock prevents duplicate processing |
| InteractionConsumer crashes | Medium | Low | Consumer group auto-recovery (existing pattern) |

## Success Metrics

1. **Question round-trip** -- Agent question to human response captured in under 5 seconds (excluding human think time).
2. **Choice capture** -- 99%+ of button clicks successfully recorded.
3. **Timeout accuracy** -- Timeouts fire within 60 seconds of expiry.
4. **Zero lost responses** -- Every human response is delivered to the waiting agent.
5. **Multi-agent concurrent** -- At least 10 concurrent pending interactions without interference.
