# P08-F08: Slack Bidirectional HITL - Tasks

## Progress

- Started: --
- Tasks Complete: 0/28
- Percentage: 0%
- Status: PLANNED
- Blockers: None
- Dependencies: P08-F02 (Slack HITL Bridge) must be complete

---

## Part D: New Event Types & Data Models

### Phase D1: Event Types and Core Data Structures

#### T01: Add interaction event types to EventType enum

- [ ] Estimate: 30min
- [ ] Tests: `tests/unit/core/test_events.py` (extend existing)
- [ ] Dependencies: None
- [ ] Agent: backend
- [ ] Story: US 8.8.1, US 8.8.2, US 8.8.3, US 8.8.4

**File:** `src/core/events.py` (modification)

**Implement:**
- Add `INTERACTION_REQUESTED = "interaction_requested"` to `EventType`
- Add `INTERACTION_RESPONSE = "interaction_response"` to `EventType`
- Add `INTERACTION_TIMEOUT = "interaction_timeout"` to `EventType`
- Add `AGENT_NOTIFICATION = "agent_notification"` to `EventType`
- Verify all existing tests still pass after enum extension
- Add tests confirming new enum values serialize/deserialize through `ASDLCEvent.to_stream_dict()` and `ASDLCEvent.from_stream_dict()`

---

#### T02: Create InteractionRequest and InteractionResponse data models

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/test_interaction_dispatcher.py` (new, model tests only)
- [ ] Dependencies: T01
- [ ] Agent: backend
- [ ] Story: US 8.8.1, US 8.8.2, US 8.8.4

**File:** `src/orchestrator/interaction_dispatcher.py` (new - models section)

**Implement:**
- `InteractionRequest` dataclass with fields: `interaction_id`, `interaction_type`, `prompt`, `options`, `session_id`, `agent_id`, `status`, `requested_at`, `timeout_seconds`, `expires_at`, `fallback_value`, `priority`
- `InteractionResponse` dataclass with fields: `response_id`, `interaction_id`, `response_text`, `selected_option`, `responder`, `responder_name`, `responded_at`
- `to_dict()` / `from_dict()` serialization for Redis hash storage (following `GateDecision` pattern)
- Validation: `interaction_type` must be one of `question`, `choice`, `acknowledgement`
- Validation: `options` required and non-empty when `interaction_type` is `choice`
- Validation: `options` must have at most 5 entries (Slack Block Kit limit)

---

## Part E: InteractionDispatcher (Orchestrator Side)

### Phase E1: Request and Notification Publishing

#### T03: Implement InteractionDispatcher.request_interaction()

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/orchestrator/test_interaction_dispatcher.py`
- [ ] Dependencies: T01, T02
- [ ] Agent: backend
- [ ] Story: US 8.8.1, US 8.8.2, US 8.8.4

**File:** `src/orchestrator/interaction_dispatcher.py` (addition)

**Implement:**
- `InteractionDispatcher.__init__(self, redis_client, event_publisher)` storing dependencies
- `request_interaction()` method that:
  - Generates UUID for `interaction_id`
  - Calculates `expires_at` from `timeout_seconds` if provided
  - Stores `InteractionRequest` as Redis hash at `asdlc:interaction:{interaction_id}`
  - Adds to sorted set `asdlc:pending_interactions` with score=`expires_at` (or infinity if no timeout)
  - Sets TTL on hash (7 days)
  - Publishes `INTERACTION_REQUESTED` event via `event_publisher`
  - Returns `InteractionRequest`
- Test with mocked Redis and event publisher

---

#### T04: Implement InteractionDispatcher.send_notification()

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/orchestrator/test_interaction_dispatcher.py`
- [ ] Dependencies: T03
- [ ] Agent: backend
- [ ] Story: US 8.8.3

**File:** `src/orchestrator/interaction_dispatcher.py` (addition)

**Implement:**
- `send_notification(message, session_id, agent_id, level)` method that:
  - Generates UUID for `notification_id`
  - Publishes `AGENT_NOTIFICATION` event with metadata (notification_id, message, session_id, agent_id, level)
  - Does NOT store in `asdlc:pending_interactions` (non-blocking)
  - Returns `notification_id` immediately
- Verify method returns without waiting for Slack post
- Test levels: `info`, `success`, `warning`, `error`

---

### Phase E2: Response Recording and Polling

#### T05: Implement InteractionDispatcher.record_response()

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/test_interaction_dispatcher.py`
- [ ] Dependencies: T03
- [ ] Agent: backend
- [ ] Story: US 8.8.1, US 8.8.2, US 8.8.4

**File:** `src/orchestrator/interaction_dispatcher.py` (addition)

**Implement:**
- `record_response()` method that:
  - Loads interaction hash from Redis
  - Validates interaction exists and status is `pending`
  - Updates hash: sets status to `responded`, stores response fields
  - Removes from `asdlc:pending_interactions` sorted set
  - Publishes `INTERACTION_RESPONSE` event
  - Returns `InteractionResponse`
- Reject response if interaction status is not `pending` (already responded or timed out)
- Test: response to non-existent interaction raises error
- Test: response to already-responded interaction raises error

---

#### T06: Implement InteractionDispatcher.get_response() polling

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/test_interaction_dispatcher.py`
- [ ] Dependencies: T05
- [ ] Agent: backend
- [ ] Story: US 8.8.1, US 8.8.6

**File:** `src/orchestrator/interaction_dispatcher.py` (addition)

**Implement:**
- `get_response(interaction_id, poll_interval_seconds, max_wait_seconds)` method that:
  - Polls Redis hash for status change to `responded` or `timeout`
  - On `responded`: returns `InteractionResponse` built from hash data
  - On `timeout` with fallback: returns response with fallback value as `response_text`
  - On `timeout` without fallback: returns `None`
  - On `max_wait_seconds` exceeded: returns `None`
  - Uses `asyncio.sleep(poll_interval_seconds)` between checks
- Test with immediate response available (no polling needed)
- Test with delayed response (simulate response appearing after 2 polls)
- Test with max_wait_seconds exceeded

---

#### T07: Implement InteractionDispatcher.check_expired()

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/test_interaction_dispatcher.py`
- [ ] Dependencies: T03
- [ ] Agent: backend
- [ ] Story: US 8.8.5

**File:** `src/orchestrator/interaction_dispatcher.py` (addition)

**Implement:**
- `check_expired()` method that:
  - Queries `asdlc:pending_interactions` sorted set for members with score <= now
  - For each expired interaction:
    - Loads hash, verifies still pending
    - If `fallback_value` set: marks status `timeout`, stores fallback as response, publishes `INTERACTION_TIMEOUT` with `fallback_used=true`
    - If no fallback: marks status `timeout`, publishes `INTERACTION_TIMEOUT` with `fallback_used=false`
    - Removes from pending set
  - Returns list of expired `InteractionRequest` objects
- Test: interaction with expired timestamp is found and handled
- Test: interaction with fallback value uses fallback
- Test: already-responded interaction is skipped even if in sorted set

---

## Part F: Configuration & Routing Extensions

### Phase F1: Config and Routing

#### T08: Add InteractionRoutingConfig to SlackBridgeConfig

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_config.py` (extend existing)
- [ ] Dependencies: None
- [ ] Agent: backend
- [ ] Story: US 8.8.8

**File:** `src/infrastructure/slack_bridge/config.py` (modification)

**Implement:**
- `InteractionRoutingConfig` Pydantic model with:
  - `default_channel_id: str` (required)
  - `session_overrides: dict[str, str]` (default empty)
  - `urgent_channel_id: str | None` (default None)
- Add `interaction_routing: InteractionRoutingConfig | None = None` to `SlackBridgeConfig`
- Test serialization/deserialization
- Test validation (default_channel_id required)

---

#### T09: Extend RoutingPolicy with interaction routing lookup

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_policy.py` (extend existing)
- [ ] Dependencies: T08
- [ ] Agent: backend
- [ ] Story: US 8.8.8

**File:** `src/infrastructure/slack_bridge/policy.py` (modification)

**Implement:**
- `get_channel_for_interaction(session_id, priority)` method on `RoutingPolicy`:
  - If `priority == "urgent"` and `urgent_channel_id` configured: return urgent channel
  - If `session_id` in `session_overrides`: return override channel
  - Otherwise return `default_channel_id`
  - If `interaction_routing` is None on config: log warning, return None
- Test: session override routing
- Test: urgent priority routing
- Test: default fallback routing
- Test: no interaction_routing configured returns None with warning

---

## Part G: Block Kit Builders

### Phase G1: Interaction Block Kit Layouts

#### T10: Build question Block Kit layout

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_interaction_blocks.py` (new)
- [ ] Dependencies: None
- [ ] Agent: backend
- [ ] Story: US 8.8.1

**File:** `src/infrastructure/slack_bridge/blocks.py` (modification)

**Implement:**
- `build_question_blocks(interaction_id, prompt, agent_id, session_id, timeout_display)` -> `list[dict]`
  - Header: "Agent Question"
  - Section: "From: {agent_id} ({session_id})" + prompt text
  - Actions: single "Answer" button with `action_id="answer_interaction"` and `value=interaction_id`
  - Context: interaction_id + timeout display
- Test: blocks contain header, section, actions, context
- Test: button value encodes interaction_id correctly
- Test: timeout_display appears in context when provided, absent when None

---

#### T11: Build choice Block Kit layout

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_interaction_blocks.py`
- [ ] Dependencies: None
- [ ] Agent: backend
- [ ] Story: US 8.8.2

**File:** `src/infrastructure/slack_bridge/blocks.py` (modification)

**Implement:**
- `build_choice_blocks(interaction_id, prompt, options, agent_id, session_id, timeout_display)` -> `list[dict]`
  - Header: "Agent Needs Decision"
  - Section: "From: {agent_id} ({session_id})" + prompt text
  - Actions: one button per option, `action_id="select_option"`, `value="{interaction_id}:{option_index}"`
  - Context: interaction_id + timeout display
- Test: correct number of buttons matches options count
- Test: button values correctly encode interaction_id and option_index
- Test: works with 1 option and with 5 options (max)

---

#### T12: Build acknowledgement and notification Block Kit layouts

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_interaction_blocks.py`
- [ ] Dependencies: None
- [ ] Agent: backend
- [ ] Story: US 8.8.3, US 8.8.4

**File:** `src/infrastructure/slack_bridge/blocks.py` (modification)

**Implement:**
- `build_acknowledgement_blocks(interaction_id, prompt, agent_id, session_id, timeout_display)` -> `list[dict]`
  - Header: "Agent Status - Confirm"
  - Section: "From: {agent_id} ({session_id})" + prompt text
  - Actions: single "Acknowledged" button, `action_id="acknowledge_interaction"`, `value=interaction_id`
  - Context: interaction_id + timeout display
- `build_notification_blocks(notification_id, message, agent_id, session_id, level)` -> `list[dict]`
  - Header: "Agent Update"
  - Section: "From: {agent_id} ({session_id})" + message text
  - No actions block (informational only)
  - Context: notification_id + level indicator emoji (info=blue, success=green, warning=yellow, error=red)
- Test: notification has no actions block
- Test: each level maps to correct visual indicator

---

#### T13: Build post-response updated Block Kit layouts

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_interaction_blocks.py`
- [ ] Dependencies: T10, T11, T12
- [ ] Agent: backend
- [ ] Story: US 8.8.1, US 8.8.2, US 8.8.4

**File:** `src/infrastructure/slack_bridge/blocks.py` (modification)

**Implement:**
- `build_answered_blocks(original_blocks, responder_name, response_text, timestamp)` -> `list[dict]`
  - Removes actions block from original
  - Appends section: "Answered by {responder_name} at {timestamp}: {response_text}"
- `build_option_selected_blocks(original_blocks, responder_name, selected_option, timestamp)` -> `list[dict]`
  - Removes actions block from original
  - Appends section: "Selected: {selected_option} by {responder_name} at {timestamp}"
- `build_acknowledged_blocks(original_blocks, responder_name, timestamp)` -> `list[dict]`
  - Removes actions block from original
  - Appends section: "Acknowledged by {responder_name} at {timestamp}"
- `build_timeout_blocks(original_blocks, fallback_value, timestamp)` -> `list[dict]`
  - Removes actions block from original
  - Appends section: "Timed out at {timestamp}" + fallback info if provided
- Test: all builders correctly strip actions block
- Test: each builder adds correct response information
- Follow existing `build_approved_blocks` / `build_rejected_blocks` pattern

---

## Part H: Slack Bridge Consumers

### Phase H1: InteractionConsumer

#### T14: Create InteractionConsumer class with consumer loop

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_interaction_consumer.py` (new)
- [ ] Dependencies: T01, T09, T10, T11, T12
- [ ] Agent: backend
- [ ] Story: US 8.8.1, US 8.8.2, US 8.8.4

**File:** `src/infrastructure/slack_bridge/interaction_consumer.py` (new)

**Implement:**
- `InteractionConsumer` class following `GateConsumer` pattern
- `__init__(redis_client, slack_client, config)` storing dependencies
- `run()` async main loop using `read_events_from_group`, filtering for `INTERACTION_REQUESTED` events
- `handle_interaction_requested(event)`:
  - Extract interaction metadata from event
  - Determine channel via `RoutingPolicy.get_channel_for_interaction(session_id, priority)`
  - Dispatch to type-specific builder: question -> `build_question_blocks`, choice -> `build_choice_blocks`, acknowledgement -> `build_acknowledgement_blocks`
  - Post Slack message via `chat_postMessage`
  - Store message_ts mapping in Redis: `slack_bridge:interaction_msg:{interaction_id}` -> `{ channel_id, message_ts }` with 24h TTL
  - Acknowledge event in consumer group
- Duplicate detection using `slack_bridge:posted_interactions` set (same pattern as GateConsumer)
- Consumer group creation/recovery on startup
- Test: question event posts message with correct blocks
- Test: choice event posts message with option buttons
- Test: duplicate event is skipped

---

#### T15: Create NotificationConsumer class

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_notification_consumer.py` (new)
- [ ] Dependencies: T01, T09, T12
- [ ] Agent: backend
- [ ] Story: US 8.8.3

**File:** `src/infrastructure/slack_bridge/notification_consumer.py` (new)

**Implement:**
- `NotificationConsumer` class following `GateConsumer` pattern
- `run()` async main loop filtering for `AGENT_NOTIFICATION` events
- `handle_notification(event)`:
  - Extract notification metadata
  - Determine channel via `RoutingPolicy.get_channel_for_interaction(session_id, "normal")`
  - Build blocks via `build_notification_blocks`
  - Post to Slack via `chat_postMessage` (no interactive elements)
  - Acknowledge event
- No duplicate detection needed (notifications are idempotent informational posts)
- Test: notification event posts message without action buttons
- Test: different levels produce correct blocks

---

### Phase H2: ResponseHandler

#### T16: Create ResponseHandler class with answer button handler

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_response_handler.py` (new)
- [ ] Dependencies: T02, T05, T10, T13
- [ ] Agent: backend
- [ ] Story: US 8.8.1

**File:** `src/infrastructure/slack_bridge/response_handler.py` (new)

**Implement:**
- `ResponseHandler.__init__(redis_client, slack_client, config)` storing dependencies
- `handle_answer_button(body)`:
  - Extract `interaction_id` from button value
  - Validate interaction exists and is pending in Redis
  - If expired or already responded: send ephemeral message to user
  - Build answer modal: text input modal with `callback_id="answer_modal_{interaction_id}"`, `private_metadata=JSON { interaction_id, channel_id }`
  - Open modal via `views_open(trigger_id, view)`
- `handle_answer_modal_submit(view, user_id)`:
  - Extract `interaction_id` from `private_metadata`
  - Extract response text from modal input
  - Acquire Redis lock: `slack_bridge:lock:interaction:{interaction_id}` (30s TTL)
  - If lock fails: return ephemeral "Already answered" message
  - Fetch user display name via `users_info`
  - Call `InteractionDispatcher.record_response()` or directly update Redis hash + publish event
  - Update Slack message with `build_answered_blocks`
  - Release lock
- Test: answer button opens modal with correct metadata
- Test: modal submit captures text and publishes event
- Test: expired interaction shows ephemeral error
- Test: concurrent submit race condition handled by lock

---

#### T17: Create ResponseHandler choice and acknowledgement handlers

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_response_handler.py`
- [ ] Dependencies: T16
- [ ] Agent: backend
- [ ] Story: US 8.8.2, US 8.8.4

**File:** `src/infrastructure/slack_bridge/response_handler.py` (addition)

**Implement:**
- `handle_option_selected(body)`:
  - Extract `interaction_id` and `option_index` from button value (`interaction_id:option_index`)
  - Validate interaction exists and is pending
  - Acquire Redis lock on interaction
  - Load interaction to get `options` list, resolve `option_index` to option text
  - Fetch user display name
  - Update Redis hash: status=responded, selected_option
  - Publish `INTERACTION_RESPONSE` event with `selected_option`
  - Remove from pending set
  - Update Slack message with `build_option_selected_blocks`
  - If lock fails: send ephemeral "Already answered"
- `handle_acknowledged(body)`:
  - Extract `interaction_id` from button value
  - Validate interaction exists and is pending
  - Acquire Redis lock
  - Fetch user display name
  - Update Redis hash: status=responded
  - Publish `INTERACTION_RESPONSE` event
  - Remove from pending set
  - Update Slack message with `build_acknowledged_blocks`
  - If lock fails: send ephemeral "Already acknowledged"
- Test: choice click publishes correct selected_option
- Test: acknowledgement click publishes responder identity
- Test: late response after timeout shows ephemeral "Interaction has expired"

---

### Phase H3: Timeout Monitor

#### T18: Create TimeoutMonitor background task

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_timeout_monitor.py` (new)
- [ ] Dependencies: T07, T13, T14
- [ ] Agent: backend
- [ ] Story: US 8.8.5

**File:** `src/infrastructure/slack_bridge/timeout_monitor.py` (new)

**Implement:**
- `TimeoutMonitor.__init__(redis_client, slack_client, config, check_interval=30)` storing dependencies
- `run()` async loop that calls `check_and_expire()` every `check_interval` seconds
- `check_and_expire()`:
  - Query `asdlc:pending_interactions` sorted set for scores <= current time
  - For each expired interaction:
    - Load interaction hash from Redis
    - Skip if status is not `pending` (race condition protection)
    - If `fallback_value` set: mark timeout with fallback, publish `INTERACTION_TIMEOUT` with `fallback_used=true`
    - If no fallback: mark timeout, publish `INTERACTION_TIMEOUT` with `fallback_used=false`
    - Remove from pending set
    - Load Slack message mapping from `slack_bridge:interaction_msg:{interaction_id}`
    - Update Slack message with `build_timeout_blocks`
  - Return count of expired interactions
- Test: expired interaction with fallback is handled correctly
- Test: expired interaction without fallback is handled correctly
- Test: non-pending interactions are skipped
- Test: Slack message is updated on timeout
- Test: interval loop runs repeatedly (mock asyncio.sleep)

---

## Part I: Bridge Integration

### Phase I1: Register New Handlers in SlackBridge

#### T19: Register interaction action and view handlers in SlackBridge

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_bridge.py` (extend existing)
- [ ] Dependencies: T14, T15, T16, T17, T18
- [ ] Agent: backend
- [ ] Story: US 8.8.1, US 8.8.2, US 8.8.4

**File:** `src/infrastructure/slack_bridge/bridge.py` (modification)

**Implement:**
- Import `InteractionConsumer`, `NotificationConsumer`, `ResponseHandler`, `TimeoutMonitor`
- In `_setup_handlers()`:
  - Create `InteractionConsumer` instance
  - Create `NotificationConsumer` instance
  - Create `ResponseHandler` instance
  - Create `TimeoutMonitor` instance
- In `_register_handlers()`:
  - Register `answer_interaction` action -> `ResponseHandler.handle_answer_button`
  - Register `select_option` action -> `ResponseHandler.handle_option_selected`
  - Register `acknowledge_interaction` action -> `ResponseHandler.handle_acknowledged`
  - Register `answer_modal_*` view submission -> `ResponseHandler.handle_answer_modal_submit`
- In `start()`:
  - Start `InteractionConsumer.run()` as background task
  - Start `NotificationConsumer.run()` as background task
  - Start `TimeoutMonitor.run()` as background task
- In `shutdown()`:
  - Cancel all new background tasks
- In `get_health_status()`:
  - Add health status for interaction_consumer, notification_consumer, timeout_monitor
- Test: new action handlers are registered
- Test: new background tasks are started and stopped

---

#### T20: Extend bridge main() to load interaction routing config

- [ ] Estimate: 30min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_bridge.py` (extend existing)
- [ ] Dependencies: T08, T19
- [ ] Agent: backend
- [ ] Story: US 8.8.8

**File:** `src/infrastructure/slack_bridge/bridge.py` (modification)

**Implement:**
- In `main()`: load `interaction_routing` from config file JSON
- Build `InteractionRoutingConfig` from the loaded data
- Pass to `SlackBridgeConfig` constructor
- If `interaction_routing` not in config file: log info message, continue without it
- Test: config with interaction_routing section is loaded correctly
- Test: config without interaction_routing section does not error

---

## Part J: Bash Tool Wrapper

### Phase J1: ask_human.sh Tool

#### T21: Create ask_human.sh bash tool wrapper

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/tools/test_ask_human.sh` (bash test)
- [ ] Dependencies: T03, T06
- [ ] Agent: backend
- [ ] Story: US 8.8.7

**File:** `tools/ask_human.sh` (new)

**Implement:**
- Bash script following existing tool pattern (standardized JSON output)
- CLI arguments: `--type` (required), `--prompt` (required), `--options` (comma-separated, for choice), `--timeout` (seconds), `--fallback` (fallback value)
- Print usage and exit 1 if `--type` or `--prompt` missing
- Internally calls Python to invoke `InteractionDispatcher.request_interaction()` then `get_response()`
- On successful response: output `{ "success": true, "data": { "response_text": "...", "responder": "...", "selected_option": "..." } }`
- On timeout with fallback: output `{ "success": true, "data": { "response_text": "...", "timed_out": true } }`
- On timeout without fallback: output `{ "success": false, "error": "Interaction timed out without fallback" }`
- Test: missing --type exits with usage message
- Test: valid arguments produce expected JSON structure
- Test: script is executable (chmod +x)

---

## Part K: Integration Tests

### Phase K1: End-to-End Flow Tests

#### T22: Integration test: question round-trip flow

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/integration/infrastructure/test_slack_bidirectional.py` (new)
- [ ] Dependencies: T14, T16, T19
- [ ] Agent: backend
- [ ] Story: US 8.8.1

**Implement:**
- Mock Slack WebClient (reuse pattern from `tests/integration/infrastructure/test_slack_bridge.py`)
- Test full flow:
  1. Create question interaction via InteractionDispatcher
  2. Verify `INTERACTION_REQUESTED` event on stream
  3. InteractionConsumer processes event, posts to mocked Slack
  4. Simulate button click -> modal open
  5. Simulate modal submit -> `INTERACTION_RESPONSE` event published
  6. Verify `get_response()` returns correct text
  7. Verify Slack message updated (actions removed, answer shown)
- Test full flow for choice interaction with option selection
- Test full flow for acknowledgement interaction

---

#### T23: Integration test: timeout and fallback flow

- [ ] Estimate: 1hr
- [ ] Tests: `tests/integration/infrastructure/test_slack_bidirectional.py`
- [ ] Dependencies: T18, T22
- [ ] Agent: backend
- [ ] Story: US 8.8.5

**Implement:**
- Test flow:
  1. Create interaction with short timeout (1 second) and fallback value
  2. TimeoutMonitor detects expiration
  3. Verify `INTERACTION_TIMEOUT` event with `fallback_used=true`
  4. Verify `get_response()` returns fallback value
  5. Verify Slack message updated with timeout status
- Test flow without fallback:
  1. Create interaction with short timeout and no fallback
  2. TimeoutMonitor detects expiration
  3. Verify `get_response()` returns None
- Test late response after timeout is rejected

---

#### T24: Integration test: concurrent interactions

- [ ] Estimate: 1hr
- [ ] Tests: `tests/integration/infrastructure/test_slack_bidirectional.py`
- [ ] Dependencies: T22
- [ ] Agent: backend
- [ ] Story: US 8.8.6

**Implement:**
- Create 3 concurrent interactions from different agent sessions
- Verify all 3 posted to Slack as separate messages
- Respond to interaction 2 only
- Verify interaction 2 returns response, interactions 1 and 3 remain pending
- Respond to interactions 1 and 3
- Verify all responses correctly routed to their respective interactions
- Verify no cross-talk between interactions

---

#### T25: Integration test: notification non-blocking flow

- [ ] Estimate: 45min
- [ ] Tests: `tests/integration/infrastructure/test_slack_bidirectional.py`
- [ ] Dependencies: T15, T22
- [ ] Agent: backend
- [ ] Story: US 8.8.3

**Implement:**
- Send notification via `InteractionDispatcher.send_notification()`
- Verify `AGENT_NOTIFICATION` event published
- Verify NotificationConsumer posts to Slack without buttons
- Verify no entry in `asdlc:pending_interactions`
- Verify different notification levels produce correct block layouts

---

## Part L: Documentation

### Phase L1: User Documentation

#### T26: Document bidirectional HITL interaction patterns

- [ ] Estimate: 1hr
- [ ] Tests: N/A (documentation)
- [ ] Dependencies: T22
- [ ] Agent: orchestrator

**File:** `docs/integrations/slack-hitl-bridge.md` (addition to existing)

**Implement:**
- New section: "Bidirectional Agent-Human Interactions"
- Subsections: Questions, Choices, Acknowledgements, Notifications
- Configuration: `interaction_routing` JSON example
- Timeout and fallback configuration guide
- Bash tool usage: `ask_human.sh` examples for each interaction type
- Troubleshooting: common issues (channel not configured, timeout too short, response routing)

---

#### T27: Document interaction event schemas

- [ ] Estimate: 30min
- [ ] Tests: N/A (documentation)
- [ ] Dependencies: T01
- [ ] Agent: orchestrator

**File:** `docs/integrations/slack-hitl-bridge.md` (addition)

**Implement:**
- New section: "Interaction Event Schemas"
- Table for each event type: `INTERACTION_REQUESTED`, `INTERACTION_RESPONSE`, `INTERACTION_TIMEOUT`, `AGENT_NOTIFICATION`
- Metadata field descriptions with types and required/optional indicators
- Example event payloads for each type

---

#### T28: Update design.md with implementation notes

- [ ] Estimate: 30min
- [ ] Tests: N/A (documentation)
- [ ] Dependencies: T22, T23, T24, T25
- [ ] Agent: orchestrator

**File:** `.workitems/P08-F08-slack-bidirectional-hitl/design.md` (modification)

**Implement:**
- Add "Implementation Notes" section with any deviations from original design
- Record actual file locations and any interface changes made during implementation
- Note any risks that materialized or were mitigated differently than planned

---

## Task Dependencies Graph

```
Part D (Event Types & Models):
T01 ───► T02

Part E (InteractionDispatcher):
T01, T02 ───► T03 ───┬──► T04
                      │
                      ├──► T05 ───► T06
                      │
                      └──► T07

Part F (Config & Routing):
T08 ───► T09

Part G (Block Kit Builders):
T10 ─────────┐
T11 ─────────┤
T12 ─────────├──► T13
             │
(T10-T12 have no dependencies, can be parallel)

Part H (Slack Consumers & Handlers):
T01, T09, T10, T11, T12 ───► T14
T01, T09, T12 ──────────────► T15
T02, T05, T10, T13 ─────────► T16 ───► T17
T07, T13, T14 ──────────────► T18

Part I (Bridge Integration):
T14, T15, T16, T17, T18 ───► T19 ───► T20
                                        │
T08 ────────────────────────────────────┘

Part J (Bash Tool):
T03, T06 ───► T21

Part K (Integration Tests):
T14, T16, T19 ───► T22 ───┬──► T23
                           │
                           ├──► T24
                           │
T15 ───────────────────────├──► T25
                           │
Part L (Documentation):    │
T22 ───────────────────────├──► T26
T01 ───────────────────────├──► T27
T22, T23, T24, T25 ────────└──► T28
```

---

## Verification Checklist

### Unit Tests
- [ ] `pytest tests/unit/core/test_events.py` (extended with new event types)
- [ ] `pytest tests/unit/orchestrator/test_interaction_dispatcher.py` (new)
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_config.py` (extended)
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_policy.py` (extended)
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_interaction_blocks.py` (new)
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_interaction_consumer.py` (new)
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_notification_consumer.py` (new)
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_response_handler.py` (new)
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_timeout_monitor.py` (new)
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_bridge.py` (extended)

### Integration Tests
- [ ] `pytest tests/integration/infrastructure/test_slack_bidirectional.py` (new)

### Manual Verification
1. Start bridge with interaction_routing config -> Logs include interaction consumer readiness
2. Create question interaction in Redis -> Message appears in Slack with "Answer" button
3. Click "Answer" -> Modal opens with text input
4. Submit answer -> Message updated, response captured in Redis
5. Create choice interaction -> Buttons for each option appear
6. Click option -> Message updated with selection, response in Redis
7. Create acknowledgement -> "Acknowledged" button appears
8. Click "Acknowledged" -> Message updated, response captured
9. Send notification -> Informational message appears, no buttons
10. Create interaction with short timeout -> Timeout message appears after expiration
11. Two agents ask questions simultaneously -> Both independently tracked and routable

---

## Estimates Summary

| Part | Phase | Tasks | Total Estimate |
|------|-------|-------|----------------|
| D | D1: Event Types & Models | T01-T02 | 1.5hr |
| E | E1: Request & Notification | T03-T04 | 2.25hr |
| E | E2: Response & Polling | T05-T07 | 3hr |
| F | F1: Config & Routing | T08-T09 | 1.5hr |
| G | G1: Block Kit Builders | T10-T13 | 2.75hr |
| H | H1: InteractionConsumer | T14-T15 | 2.5hr |
| H | H2: ResponseHandler | T16-T17 | 3hr |
| H | H3: Timeout Monitor | T18 | 1.5hr |
| I | I1: Bridge Integration | T19-T20 | 1.5hr |
| J | J1: Bash Tool | T21 | 1.5hr |
| K | K1: Integration Tests | T22-T25 | 4.25hr |
| L | L1: Documentation | T26-T28 | 2hr |

**Total Estimate:** ~27.25 hours

---

## Critical Path

```
T01 -> T02 -> T03 -> T05 -> T06 -> T16 -> T17 -> T19 -> T22 -> T28
```

The critical path focuses on:
1. New event types (T01)
2. Data models (T02)
3. InteractionDispatcher core (T03)
4. Response recording (T05)
5. Response polling (T06)
6. ResponseHandler answer flow (T16)
7. ResponseHandler choice/ack flow (T17)
8. Bridge integration (T19)
9. Integration tests (T22)
10. Final documentation (T28)

### Parallelization Opportunities

The following groups can be developed concurrently:

- **Group A (no deps):** T08, T10, T11, T12 -- Config models and Block Kit builders
- **Group B (after T01):** T03 and T09 can proceed in parallel once T01 is done
- **Group C (after T03):** T04, T05, T07 can proceed in parallel once T03 is done
- **Group D (after T22):** T23, T24, T25, T26 can proceed in parallel once T22 is done
