# P02-F01: User Stories

## US-01: Event Publishing with Validation

**As a** system component
**I want to** publish validated events to the stream
**So that** downstream consumers receive well-formed event data

### Acceptance Criteria

- [ ] Events are validated against the `ASDLCEvent` model before publishing
- [ ] Invalid events raise `ValidationError` with descriptive message
- [ ] Published events automatically include timestamp and tenant context
- [ ] Event ID is returned after successful publish
- [ ] Events support all types defined in `EventType` enum

### Test Cases

```python
def test_publish_event_validates_required_fields():
    """Publish rejects events missing required fields."""

def test_publish_event_includes_tenant_context():
    """Publish adds tenant_id from current context."""

def test_publish_event_returns_event_id():
    """Publish returns Redis-assigned event ID."""
```

---

## US-02: Event Consumption from Consumer Groups

**As a** handler service
**I want to** consume events from my assigned consumer group
**So that** I can process events exactly once across multiple instances

### Acceptance Criteria

- [ ] Consumer reads from specified consumer group
- [ ] Multiple consumers in same group see different messages (load balancing)
- [ ] Consumer acknowledges processed messages
- [ ] Unacknowledged messages become pending
- [ ] Consumer can specify block timeout for polling

### Test Cases

```python
def test_consumer_reads_from_group():
    """Consumer receives events published to stream."""

def test_consumer_group_distributes_messages():
    """Two consumers in same group receive different messages."""

def test_consumer_acknowledges_processed():
    """Processed events are removed from pending list."""
```

---

## US-03: Idempotent Event Processing

**As a** handler service
**I want to** skip duplicate events
**So that** I never process the same event twice

### Acceptance Criteria

- [ ] Events have unique idempotency keys
- [ ] Processed keys are tracked in Redis with TTL
- [ ] Duplicate events are acknowledged but not reprocessed
- [ ] Idempotency check is atomic (no race conditions)
- [ ] TTL is configurable (default 7 days)

### Test Cases

```python
def test_idempotency_tracker_prevents_reprocessing():
    """Second attempt to process same key is skipped."""

def test_idempotency_key_generated_if_missing():
    """Events without idempotency_key get one generated."""

def test_idempotency_keys_expire():
    """Keys are removed after TTL expires."""
```

---

## US-04: Recovery from Crash

**As an** orchestrator
**I want to** recover pending events after restart
**So that** no events are lost during crashes

### Acceptance Criteria

- [ ] On startup, consumer checks `XPENDING` for stuck messages
- [ ] Pending messages are re-processed (respecting idempotency)
- [ ] Stale messages from dead consumers are claimed
- [ ] Recovery completes before normal consumption starts
- [ ] Recovery metrics are logged

### Test Cases

```python
def test_recovery_processes_pending_events():
    """Pending events are processed after restart."""

def test_recovery_skips_already_processed():
    """Idempotent events are acked without reprocessing."""

def test_recovery_claims_from_dead_consumers():
    """Stale messages are claimed from inactive consumers."""
```

---

## US-05: Tenant-Aware Streams

**As a** multi-tenant deployment
**I want to** isolate events by tenant
**So that** tenants cannot see each other's events

### Acceptance Criteria

- [ ] Stream keys include tenant prefix when multi-tenancy enabled
- [ ] Events include `tenant_id` field
- [ ] Consumer only receives events for current tenant
- [ ] Single-tenant mode uses unprefixed keys
- [ ] Tenant context is propagated through entire flow

### Test Cases

```python
def test_publish_uses_tenant_prefixed_stream():
    """Events go to tenant-specific stream in multi-tenant mode."""

def test_consumer_filters_by_tenant():
    """Consumer only receives events for its tenant."""

def test_single_tenant_uses_default_stream():
    """Single-tenant mode uses unprefixed stream name."""
```

---

## US-06: Event Handler Protocol

**As a** developer
**I want to** implement handlers using a standard protocol
**So that** my handlers integrate seamlessly with the consumer

### Acceptance Criteria

- [ ] `EventHandler` protocol is defined and documented
- [ ] Handlers declare which event types they process
- [ ] Handler returns result indicating success/retry/failure
- [ ] Consumer respects handler result for ack/nack
- [ ] Handler errors are caught and logged

### Test Cases

```python
def test_handler_protocol_is_satisfied():
    """Custom handler satisfies EventHandler protocol."""

def test_handler_can_handle_filters_events():
    """Only events matching can_handle are dispatched."""

def test_handler_retry_nacks_message():
    """should_retry=True causes message to be nacked."""
```

---

## US-07: Stream Monitoring

**As an** operator
**I want to** monitor stream health
**So that** I can detect backlogs and failures

### Acceptance Criteria

- [ ] `get_stream_info()` returns length, groups, pending counts
- [ ] Dead letter count is tracked
- [ ] Consumer lag is calculable from pending info
- [ ] Health check includes stream connectivity
- [ ] Metrics are structured for logging/export

### Test Cases

```python
def test_stream_info_includes_pending_count():
    """Stream info shows pending messages per group."""

def test_stream_info_handles_missing_stream():
    """Returns sensible defaults when stream doesn't exist."""
```
