# P01-F05: A2A Push Notifications - Tasks

## Progress

- Started: 2026-01-23
- Tasks Complete: 12/12
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

---

## Phase 1: Backend - Redis Notification Queue

### T01: Add NotificationEvent.from_json() class method
- [x] **File**: `src/infrastructure/coordination/types.py`
- [x] Add `from_json(cls, json_str: str)` class method
- [x] Handle JSON parsing and timestamp conversion
- [x] Raise ValueError for invalid JSON
- [x] **Test**: Unit test for serialization round-trip

### T02: Add notification queue key pattern to config
- [x] **File**: `src/infrastructure/coordination/config.py`
- [x] Add `KEY_NOTIFICATION_QUEUE` class variable
- [x] Add `notification_queue_key(instance_id)` method
- [x] **Test**: Unit test for key generation

### T03: Add queue_notification() method
- [x] **File**: `src/infrastructure/coordination/client.py`
- [x] Implement `queue_notification(instance_id, notification)` method
- [x] Use LPUSH to add to list (newest at head)
- [x] Set TTL matching message_ttl_seconds
- [x] Return True on success
- [x] Raise CoordinationError on failure
- [x] **Test**: Unit test with mock Redis

### T04: Add pop_notifications() method
- [x] **File**: `src/infrastructure/coordination/client.py`
- [x] Implement `pop_notifications(instance_id, limit)` method
- [x] Use pipeline with LRANGE + DELETE for atomicity
- [x] Parse each JSON string to NotificationEvent
- [x] Log warnings for parse failures (don't fail entire operation)
- [x] Return list of NotificationEvent (empty if none)
- [x] **Test**: Unit test with mock Redis

### T05: Add _queue_if_offline() helper and enhance publish_message()
- [x] **File**: `src/infrastructure/coordination/client.py`
- [x] Implement `_queue_if_offline(instance_id, notification)` helper
- [x] Check presence, queue if offline/unknown
- [x] Make best-effort (log warnings, don't fail publish)
- [x] Call from `publish_message()` after pipeline (skip for broadcasts)
- [x] **Test**: Unit test for both paths (online/offline)

---

## Phase 2: MCP Integration

### T06: Add coord_get_notifications MCP tool
- [x] **File**: `src/infrastructure/coordination/mcp_server.py`
- [x] Add `coord_get_notifications(limit)` async method
- [x] Add tool schema to `get_tool_schemas()`
- [x] Add handler in `handle_request()` tools/call section
- [x] Return `{ success, count, notifications[] }`
- [x] **Test**: Unit test for MCP server method

### T07: Register coordination MCP server in .mcp.json
- [x] **File**: `.mcp.json`
- [x] Add "coordination" server entry
- [x] Command: `python -m src.infrastructure.coordination.mcp_server`
- [x] Set PYTHONPATH environment variable
- [x] **Test**: Manual verification MCP server starts

---

## Phase 3: Bash Integration

### T08: Add call_python_pop_notifications() helper
- [x] **File**: `scripts/coordination/lib/common.sh`
- [x] Implement Python wrapper function
- [x] Return JSON with notifications array
- [x] Handle errors gracefully
- [x] **Test**: Manual verification

### T09: Add notification check to cli-identity.sh
- [x] **File**: `scripts/cli-identity.sh`
- [x] Add `check_pending_notifications()` function
- [x] Call after identity activation for each instance type
- [x] Display formatted notification summary
- [x] Skip if Redis unavailable (graceful degradation)
- [x] **Test**: Manual verification with real Redis

### T10: Create watch-notifications.sh script
- [x] **File**: `scripts/coordination/watch-notifications.sh` (NEW)
- [x] Subscribe to instance's pub/sub channel
- [x] Parse and display notifications as they arrive
- [x] Handle Ctrl+C cleanly
- [x] **Test**: Manual verification with message send

---

## Phase 4: Testing

### T11: Unit tests for notification methods
- [x] **File**: `tests/unit/infrastructure/test_coordination_client.py`
- [x] Test `queue_notification()` success path
- [x] Test `queue_notification()` Redis error handling
- [x] Test `pop_notifications()` with notifications
- [x] Test `pop_notifications()` empty queue
- [x] Test `pop_notifications()` with parse errors
- [x] Test `_queue_if_offline()` for online instance
- [x] Test `_queue_if_offline()` for offline instance
- [x] **File**: `tests/unit/infrastructure/test_coordination_types.py`
- [x] Test `NotificationEvent.from_json()` valid JSON
- [x] Test `NotificationEvent.from_json()` invalid JSON
- [x] Test round-trip: `to_json()` -> `from_json()`

### T12: Integration tests for notification queue
- [x] **File**: `tests/integration/infrastructure/test_coordination_redis.py`
- [x] Test queue_notification stores in Redis LIST
- [x] Test pop_notifications retrieves and clears
- [x] Test publish_message queues for offline instance
- [x] Test publish_message skips for online instance
- [x] Test full cycle: publish -> queue -> pop

---

## Verification Checklist

Before marking complete:
- [x] All unit tests pass: `pytest tests/unit/infrastructure/test_coordination*.py -v`
- [x] Integration tests pass: `pytest tests/integration/infrastructure/test_coordination*.py -v`
- [x] Linter passes: `ruff check src/infrastructure/coordination/`
- [x] Manual E2E test:
  1. Terminal 1: Start backend session, publish to orchestrator
  2. Terminal 2: Start orchestrator session, verify notification shown
- [x] MCP server starts without errors
