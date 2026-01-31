# P08-F02: Slack HITL Bridge - Tasks

## Progress

- Started: Not started
- Tasks Complete: 0/24
- Percentage: 0%
- Status: PLANNED
- Blockers: P08-F01 (Ideas Repository Core for Part C)

---

## Part A: Gate Notification (OUT Direction)

### Phase A1: Configuration & Models

#### T01: Create SlackBridgeConfig and ChannelConfig models

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_config.py`
- [ ] Dependencies: None
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/config.py`

**Implement:**
- `ChannelConfig` model (channel_id, required_role, mention_users, mention_groups)
- `SlackBridgeConfig` model (bot_token, app_token, signing_secret, routing_policy, environment_overrides, rbac_map, ideas_channels, ideas_emoji, consumer_group, consumer_name)
- Use `SecretStr` for sensitive tokens
- Validation for required fields

---

#### T02: Create RBAC validator

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_rbac.py`
- [ ] Dependencies: T01
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/rbac.py`

**Implement:**
- `RBACValidator` class
- `has_role(slack_user_id, required_role)` -> bool
- `can_approve_gate(slack_user_id, gate_type, channel_config)` -> bool
- `get_user_roles(slack_user_id)` -> list[str]

---

#### T03: Create routing policy lookup

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_policy.py`
- [ ] Dependencies: T01
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/policy.py`

**Implement:**
- `RoutingPolicy` class
- `get_channel_for_gate(gate_type, environment=None)` -> ChannelConfig | None
- Environment override support (production vs staging routing)
- Logging for unroutable gate types

---

### Phase A2: Block Kit Messages

#### T04: Create Block Kit message builders

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_blocks.py`
- [ ] Dependencies: None
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/blocks.py`

**Implement:**
- `build_gate_request_blocks(request_id, gate_type, task_id, summary, evidence_url, requester)` -> list[dict]
- `build_approved_blocks(original_blocks, approver_name, timestamp)` -> list[dict]
- `build_rejected_blocks(original_blocks, rejecter_name, reason, timestamp)` -> list[dict]
- `build_rejection_modal(request_id)` -> dict

---

### Phase A3: Gate Consumer

#### T05: Create GateConsumer class

- [ ] Estimate: 2hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_gate_consumer.py`
- [ ] Dependencies: T01, T03, T04
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/gate_consumer.py`

**Implement:**
- `GateConsumer` class with redis_client, slack_client, config
- `run()` async main loop using `read_events_from_group`
- `handle_gate_requested(event)` - filter for GATE_REQUESTED events
- `build_evidence_url(request_id)` - URL to HITL UI evidence view
- Consumer group creation/recovery on startup
- Event acknowledgment after successful Slack post

---

#### T06: Implement duplicate detection for gate posts

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_gate_consumer.py`
- [ ] Dependencies: T05
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/gate_consumer.py` (addition)

**Implement:**
- Track posted request_ids in Redis set with TTL
- `is_already_posted(request_id)` -> bool
- `mark_as_posted(request_id, message_ts)` -> None
- Prevents duplicate Slack messages on consumer restart

---

## Part B: Decision Capture (IN Direction)

### Phase B1: Slack App Setup

#### T07: Create main Slack Bolt app with Socket Mode

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_bridge.py`
- [ ] Dependencies: T01
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/bridge.py`

**Implement:**
- `SlackBridge` class as main entry point
- Slack Bolt `AsyncApp` with Socket Mode
- Configuration loading and validation
- Graceful shutdown handling
- Register action handlers for approve_gate, reject_gate
- Register view handler for rejection_modal submissions

---

#### T08: Create decision handler for button clicks

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_decision_handler.py`
- [ ] Dependencies: T02, T07
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/decision_handler.py`

**Implement:**
- `DecisionHandler` class with redis_client, config
- `handle_approval(request_id, slack_user_id, channel_config)` -> bool
- `handle_rejection(request_id, slack_user_id, reason, channel_config)` -> bool
- RBAC validation before processing
- Publish GATE_APPROVED/GATE_REJECTED to Redis Streams using `publish_event_model`

---

#### T09: Implement message update after decision

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_decision_handler.py`
- [ ] Dependencies: T08
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/decision_handler.py` (addition)

**Implement:**
- `update_message_after_approval(slack_client, channel, message_ts, approver)` -> None
- `update_message_after_rejection(slack_client, channel, message_ts, rejecter, reason)` -> None
- Remove Approve/Reject buttons
- Add decision context to message
- Handle Slack API errors gracefully

---

#### T10: Implement rejection modal flow

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_decision_handler.py`
- [ ] Dependencies: T08
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/decision_handler.py` (addition)

**Implement:**
- `open_rejection_modal(trigger_id, request_id)` -> None
- `handle_rejection_modal_submit(view_submission)` -> dict
- Extract reason from modal input
- Validate reason is not empty
- Call handle_rejection with extracted reason

---

### Phase B2: Integration with HITLDispatcher

#### T11: Create event publisher for decisions

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_decision_handler.py`
- [ ] Dependencies: T08
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/decision_handler.py` (addition)

**Implement:**
- Build `ASDLCEvent` with EventType.GATE_APPROVED or GATE_REJECTED
- Include metadata: request_id, decision_id, reviewer (Slack user ID), reason, conditions
- Use `publish_event_model` from redis_streams
- Log event publication for audit

---

#### T12: Handle already-decided gates

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_decision_handler.py`
- [ ] Dependencies: T08
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/decision_handler.py` (addition)

**Implement:**
- Check gate status before processing decision
- If not PENDING, return ephemeral message "Gate already decided"
- Prevent race conditions with Redis locking
- Log attempted double-decisions

---

## Part C: Ideas Ingestion (IN Direction)

### Phase C1: Idea Handlers

#### T13: Create IdeaHandler class

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_idea_handler.py`
- [ ] Dependencies: T01, P08-F01
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/idea_handler.py`

**Implement:**
- `IdeaHandler` class with ideas_service, config
- `handle_message(event)` - process message in ideas channel
- `handle_reaction(event)` - process emoji reaction
- Filter for configured channels and emoji

---

#### T14: Implement idea creation from Slack message

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_idea_handler.py`
- [ ] Dependencies: T13
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/idea_handler.py` (addition)

**Implement:**
- `create_idea_from_message(message)` -> Idea | None
- Build source_ref: `slack:{team_id}:{channel_id}:{message_ts}`
- Check for duplicate via source_ref
- Call IdeasService.create_idea with source="SLACK"
- Handle word limit validation

---

#### T15: Implement reaction-based idea capture

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_idea_handler.py`
- [ ] Dependencies: T13, T14
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/idea_handler.py` (addition)

**Implement:**
- Validate reaction matches configured emoji
- Fetch original message via Slack API if needed
- Attribute idea to original author (not reactor)
- Add confirmation reaction to indicate capture

---

## Part D: Docker & Operations

### Phase D1: Containerization

#### T16: Create Dockerfile for Slack Bridge

- [ ] Estimate: 45min
- [ ] Tests: Manual verification
- [ ] Dependencies: T07
- [ ] Agent: devops

**File:** `docker/slack-bridge/Dockerfile`

**Implement:**
- Python 3.11 base image
- Install dependencies from requirements.txt
- Copy src/infrastructure/slack_bridge
- Entrypoint: python -m src.infrastructure.slack_bridge.bridge
- Health check configuration

---

#### T17: Create requirements.txt for Slack Bridge

- [ ] Estimate: 15min
- [ ] Tests: N/A
- [ ] Dependencies: None
- [ ] Agent: devops

**File:** `docker/slack-bridge/requirements.txt`

**Implement:**
- slack-bolt>=1.18.0
- slack-sdk>=3.23.0
- redis>=4.5.0
- pydantic>=2.0.0
- Pin versions for reproducibility

---

#### T18: Add slack-bridge to docker-compose.yml

- [ ] Estimate: 30min
- [ ] Tests: Manual verification
- [ ] Dependencies: T16, T17
- [ ] Agent: devops

**File:** `docker/docker-compose.yml` (addition)

**Implement:**
- slack-bridge service definition
- Environment variables for config
- Depends on: redis
- Volume mount for config file (optional)
- Network configuration

---

### Phase D2: Operations

#### T19: Implement health check endpoint

- [ ] Estimate: 45min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_bridge.py`
- [ ] Dependencies: T07
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/bridge.py` (addition)

**Implement:**
- Optional HTTP server for /health endpoint
- Check Slack connection status
- Check Redis connection status
- Return JSON with component statuses

---

#### T20: Implement startup validation

- [ ] Estimate: 30min
- [ ] Tests: `tests/unit/infrastructure/slack_bridge/test_bridge.py`
- [ ] Dependencies: T07
- [ ] Agent: backend

**File:** `src/infrastructure/slack_bridge/bridge.py` (addition)

**Implement:**
- Validate config on startup
- Test Slack token with auth.test API call
- Test Redis connection
- Log startup status and version
- Fail fast with clear error messages

---

## Part E: Testing & Documentation

### Phase E1: Integration Tests

#### T21: Create integration tests with mocked Slack

- [ ] Estimate: 2hr
- [ ] Tests: `tests/integration/infrastructure/test_slack_bridge.py`
- [ ] Dependencies: T05, T08, T13
- [ ] Agent: backend

**Implement:**
- Mock Slack WebClient responses
- Test full gate request -> Slack message flow
- Test approve button -> GATE_APPROVED event flow
- Test reject modal -> GATE_REJECTED event flow
- Test idea reaction -> idea creation flow
- Test RBAC denial scenarios

---

#### T22: Create end-to-end test script

- [ ] Estimate: 1hr
- [ ] Tests: Manual execution
- [ ] Dependencies: T21
- [ ] Agent: backend

**File:** `tests/e2e/test_slack_bridge_e2e.py`

**Implement:**
- Requires real Slack workspace (test workspace)
- Creates test gate request in Redis
- Verifies message appears in Slack
- Simulates button click (if possible with test tokens)
- Verifies decision event in Redis

---

### Phase E2: Documentation

#### T23: Create Slack app setup documentation

- [ ] Estimate: 1hr
- [ ] Tests: N/A (documentation)
- [ ] Dependencies: T18
- [ ] Agent: orchestrator

**File:** `docs/integrations/slack-hitl-bridge.md`

**Implement:**
- Slack app creation instructions
- Required OAuth scopes: chat:write, reactions:write, reactions:read, channels:history, users:read
- Socket Mode setup
- Bot token vs App token explanation
- Configuration file format with examples
- Troubleshooting guide

---

#### T24: Create RBAC configuration guide

- [ ] Estimate: 30min
- [ ] Tests: N/A (documentation)
- [ ] Dependencies: T23
- [ ] Agent: orchestrator

**File:** `docs/integrations/slack-hitl-bridge.md` (addition)

**Implement:**
- RBAC map format explanation
- Role definitions and gate type mappings
- How to find Slack user IDs
- Best practices for role assignment
- Example configurations for different team structures

---

## Task Dependencies Graph

```
Part A (Gate OUT):
T01 ───┬──► T02 ───────────────┐
       │                       │
       ├──► T03 ───────────────┤
       │                       │
       └──────────────────────►├──► T05 ───► T06
                               │
T04 ───────────────────────────┘

Part B (Decision IN):
T01 ───► T07 ───┬──► T08 ───┬──► T09
                │           │
T02 ────────────┘           ├──► T10
                            │
                            ├──► T11
                            │
                            └──► T12

Part C (Ideas IN):
T01 ───► T13 ───► T14 ───► T15
         │
P08-F01 ─┘

Part D (Docker):
T07 ───► T16 ───┬──► T18
T17 ────────────┘
T07 ───► T19
T07 ───► T20

Part E (Testing):
T05, T08, T13 ───► T21 ───► T22
T18 ───► T23 ───► T24
```

---

## Verification Checklist

### Unit Tests
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_config.py`
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_rbac.py`
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_policy.py`
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_blocks.py`
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_gate_consumer.py`
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_bridge.py`
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_decision_handler.py`
- [ ] `pytest tests/unit/infrastructure/slack_bridge/test_idea_handler.py`

### Integration Tests
- [ ] `pytest tests/integration/infrastructure/test_slack_bridge.py`

### Manual Verification
1. Start bridge with valid config -> Logs "ready" message
2. Create gate request in Redis -> Message appears in Slack
3. Click Approve as authorized user -> Gate approved, message updated
4. Click Reject as authorized user -> Modal opens, rejection recorded
5. Click Approve as unauthorized user -> Ephemeral error
6. React with emoji in ideas channel -> Idea created
7. Restart bridge -> Pending events recovered

---

## Estimates Summary

| Part | Phase | Tasks | Total Estimate |
|------|-------|-------|----------------|
| A | A1: Config & Models | T01-T03 | 2.5hr |
| A | A2: Block Kit | T04 | 1hr |
| A | A3: Consumer | T05-T06 | 2.75hr |
| B | B1: App Setup | T07-T10 | 5hr |
| B | B2: HITLDispatcher | T11-T12 | 1.75hr |
| C | C1: Idea Handlers | T13-T15 | 3.5hr |
| D | D1: Container | T16-T18 | 1.5hr |
| D | D2: Operations | T19-T20 | 1.25hr |
| E | E1: Testing | T21-T22 | 3hr |
| E | E2: Docs | T23-T24 | 1.5hr |

**Total Estimate:** ~24 hours

---

## Critical Path

```
T01 -> T07 -> T08 -> T11 -> T21 -> T23
```

The critical path focuses on:
1. Configuration models (T01)
2. Main Slack app (T07)
3. Decision handler (T08)
4. Event publishing (T11)
5. Integration tests (T21)
6. Documentation (T23)

Parts A (gate notification) and C (ideas) can be developed in parallel with Part B after T01 is complete.
