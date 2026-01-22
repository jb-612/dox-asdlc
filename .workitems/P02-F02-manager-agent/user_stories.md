# P02-F02: User Stories

## US-01: Task State Transitions

**As a** Manager Agent
**I want to** enforce valid state transitions
**So that** tasks follow the defined workflow

### Acceptance Criteria

- [ ] State machine defines all valid transitions
- [ ] Invalid transitions raise `TaskStateError`
- [ ] State changes update `updated_at` timestamp
- [ ] State change events are published to stream
- [ ] Terminal states (COMPLETE, FAILED) cannot be exited (except FAILED → PENDING for retry)

### Test Cases

```python
def test_valid_transition_pending_to_in_progress():
    """PENDING → IN_PROGRESS is allowed."""

def test_invalid_transition_complete_to_pending():
    """COMPLETE → PENDING is rejected."""

def test_failed_task_can_retry():
    """FAILED → PENDING is allowed for retry."""
```

---

## US-02: Task Persistence

**As a** Manager Agent
**I want to** persist task state in Redis
**So that** state survives restarts

### Acceptance Criteria

- [ ] Tasks are stored as Redis hashes
- [ ] All task fields are persisted
- [ ] Task updates are atomic
- [ ] Tasks can be retrieved by ID
- [ ] Tasks can be listed by state
- [ ] Tenant prefix is applied in multi-tenant mode

### Test Cases

```python
def test_create_task_persists_to_redis():
    """Task is stored in Redis hash."""

def test_get_task_returns_all_fields():
    """Retrieved task has all original fields."""

def test_update_state_is_atomic():
    """State update doesn't lose other fields."""
```

---

## US-03: Session Tracking

**As a** Manager Agent
**I want to** track active sessions
**So that** I can coordinate work across epics

### Acceptance Criteria

- [ ] Sessions track current Git SHA
- [ ] Sessions list active epic IDs
- [ ] Session status reflects current state
- [ ] Git SHA is updated on commits
- [ ] Sessions are tenant-isolated

### Test Cases

```python
def test_session_tracks_git_sha():
    """Session stores current Git SHA."""

def test_session_updates_on_commit():
    """Git SHA is updated after commit."""

def test_session_tenant_isolation():
    """Sessions use tenant-prefixed keys."""
```

---

## US-04: Exclusive Git Write Access

**As an** administrator
**I want to** restrict Git writes to the Manager Agent
**So that** only governed changes reach protected branches

### Acceptance Criteria

- [ ] Git gateway checks write permissions before operations
- [ ] Protected branches are configurable
- [ ] Write attempts without permission are rejected
- [ ] All Git operations are logged with context
- [ ] Configuration comes from environment variables

### Test Cases

```python
def test_git_gateway_requires_write_permission():
    """Write fails without GIT_WRITE_ACCESS=true."""

def test_protected_branch_enforcement():
    """Direct writes to protected branches are blocked."""

def test_write_operations_are_logged():
    """Git operations produce audit log entries."""
```

---

## US-05: Patch Application

**As a** Manager Agent
**I want to** apply agent-generated patches
**So that** code changes are committed to the repository

### Acceptance Criteria

- [ ] Patches are applied using `git apply`
- [ ] Applied patches are committed with message
- [ ] Commit message includes task context
- [ ] New SHA is returned after commit
- [ ] Failed patches don't leave dirty state
- [ ] Patch application publishes event

### Test Cases

```python
def test_apply_patch_creates_commit():
    """Valid patch results in new commit."""

def test_apply_patch_returns_sha():
    """New Git SHA is returned after commit."""

def test_failed_patch_rolls_back():
    """Failed patch doesn't leave uncommitted changes."""
```

---

## US-06: Fail Count Management

**As a** Manager Agent
**I want to** track task failure counts
**So that** I can trigger RLM mode or escalation

### Acceptance Criteria

- [ ] Fail count is incremented atomically
- [ ] Fail count is persisted in task hash
- [ ] Threshold triggers are configurable
- [ ] fail_count > 4 triggers Debugger agent (per System_Design.md)
- [ ] Reset on successful completion

### Test Cases

```python
def test_fail_count_increments():
    """Fail count increases on failure."""

def test_fail_count_is_atomic():
    """Concurrent increments don't lose counts."""

def test_high_fail_count_triggers_rlm():
    """fail_count > 4 sets mode to 'rlm'."""
```

---

## US-07: Event Consumption and Dispatch

**As a** Manager Agent
**I want to** consume and route events
**So that** the right handler processes each event

### Acceptance Criteria

- [ ] Manager consumes from designated consumer group
- [ ] Events are routed to appropriate handlers
- [ ] Handler exceptions don't crash consumer
- [ ] Processed events are acknowledged
- [ ] Dispatch events are published for workers

### Test Cases

```python
def test_task_created_event_handled():
    """TASK_CREATED event creates task in Redis."""

def test_agent_completed_applies_patch():
    """AGENT_COMPLETED event triggers patch application."""

def test_handler_exception_logged():
    """Handler exceptions are logged, not raised."""
```

---

## US-08: Worker Dispatch

**As a** Manager Agent
**I want to** dispatch tasks to worker agents
**So that** specialized agents process each phase

### Acceptance Criteria

- [ ] Dispatch publishes `AGENT_STARTED` event
- [ ] Event includes task context and agent type
- [ ] Worker picks up event from stream
- [ ] Task state is set to IN_PROGRESS
- [ ] Dispatch is idempotent (same task not dispatched twice)

### Test Cases

```python
def test_dispatch_publishes_event():
    """Dispatch creates AGENT_STARTED event."""

def test_dispatch_updates_task_state():
    """Task moves to IN_PROGRESS on dispatch."""

def test_dispatch_is_idempotent():
    """Dispatching same task twice is no-op."""
```
