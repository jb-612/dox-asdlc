# P02-F01: Tasks

## Task Breakdown

### T01: Create Event Models
**File:** `src/core/events.py`
**Test:** `tests/unit/test_events.py`

- [ ] Define `EventType` enum with all event types
- [ ] Create `ASDLCEvent` Pydantic model with validation
- [ ] Create `HandlerResult` dataclass
- [ ] Create `RecoveryResult` dataclass
- [ ] Add idempotency key generation helper
- [ ] Write unit tests for model validation

**Estimate:** 1h

---

### T02: Extend Publish with Validation
**File:** `src/infrastructure/redis_streams.py`
**Test:** `tests/unit/test_redis_streams.py`

- [ ] Create `publish_event_model()` accepting `ASDLCEvent`
- [ ] Add tenant context injection (from TenantContext)
- [ ] Generate idempotency key if not provided
- [ ] Add stream name resolution with tenant prefix
- [ ] Write unit tests for validated publishing
- [ ] Keep existing `publish_event()` for backwards compatibility

**Estimate:** 1h

---

### T03: Implement Idempotency Tracker
**File:** `src/infrastructure/redis_streams.py`
**Test:** `tests/unit/test_redis_streams.py`

- [ ] Create `IdempotencyTracker` class
- [ ] Implement `is_processed()` with atomic check
- [ ] Implement `mark_processed()` with TTL
- [ ] Support tenant-prefixed keys
- [ ] Write unit tests with mock Redis
- [ ] Write integration test with real Redis

**Estimate:** 1h

---

### T04: Implement Event Consumer
**File:** `src/infrastructure/consumer_group.py`
**Test:** `tests/unit/test_consumer_group.py`

- [ ] Create `EventConsumer` class
- [ ] Implement `start()` method with XREADGROUP loop
- [ ] Implement `stop()` for graceful shutdown
- [ ] Implement `acknowledge()` method
- [ ] Add configurable block timeout and batch size
- [ ] Wire in idempotency tracker for deduplication
- [ ] Write unit tests with mocked Redis

**Estimate:** 2h

---

### T05: Implement Event Handler Protocol
**File:** `src/infrastructure/consumer_group.py`
**Test:** `tests/unit/test_consumer_group.py`

- [ ] Define `EventHandler` Protocol class
- [ ] Add `can_handle()` method to protocol
- [ ] Implement handler dispatch in consumer
- [ ] Handle `HandlerResult` for ack/nack decisions
- [ ] Add error handling for handler exceptions
- [ ] Write tests for handler protocol compliance

**Estimate:** 1h

---

### T06: Implement Recovery Protocol
**File:** `src/infrastructure/consumer_group.py`
**Test:** `tests/unit/test_consumer_group.py`

- [ ] Implement `process_pending()` using XPENDING
- [ ] Implement `claim_stale_messages()` using XCLAIM
- [ ] Integrate idempotency check in recovery
- [ ] Return `RecoveryResult` with metrics
- [ ] Add configurable idle time threshold
- [ ] Write unit tests for recovery scenarios

**Estimate:** 1.5h

---

### T07: Add Tenant-Aware Stream Operations
**File:** `src/infrastructure/redis_streams.py`
**Test:** `tests/unit/test_redis_streams.py`

- [ ] Create `get_stream_name()` with tenant awareness
- [ ] Update `ensure_stream_exists()` for tenant prefix
- [ ] Update `create_consumer_group()` for tenant prefix
- [ ] Update `get_stream_info()` for tenant prefix
- [ ] Write tests for single-tenant and multi-tenant modes

**Estimate:** 1h

---

### T08: Integration Tests
**File:** `tests/integration/test_stream_processing.py`

- [ ] Test end-to-end publish → consume → ack flow
- [ ] Test consumer group load balancing
- [ ] Test idempotent processing prevents duplicates
- [ ] Test recovery after simulated crash
- [ ] Test tenant isolation in multi-tenant mode

**Estimate:** 1.5h

---

## Progress

- Started: 2026-01-22
- Tasks Complete: 8/8
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

## Completion Notes

All tasks implemented:
- [x] T01: Event models (src/core/events.py) - 18 tests
- [x] T02: Extended publish with validation - 4 tests
- [x] T03: Idempotency tracker - 4 tests
- [x] T04: Event consumer - 6 tests
- [x] T05: Event handler protocol - 2 tests
- [x] T06: Recovery protocol - 2 tests
- [x] T07: Tenant-aware stream operations - 4 tests
- [x] T08: Integration tests - 5 tests

Total: 51 tests passing

## Dependency Notes

- Uses `TenantContext` from P06-F05 (available)
- Uses `RedisConfig` from P01-F01 (available)
- Uses exceptions from `src/core/exceptions.py` (available)
