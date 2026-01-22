# P02-F02: Tasks

## Task Breakdown

### T01: Implement Task State Machine
**File:** `src/orchestrator/state_machine.py`
**Test:** `tests/unit/test_state_machine.py`

- [ ] Define `TaskState` enum with all states
- [ ] Define valid transition map
- [ ] Implement `can_transition()` method
- [ ] Implement `transition()` method with validation
- [ ] Raise `TaskStateError` on invalid transitions
- [ ] Write unit tests for all transitions

**Estimate:** 1h

---

### T02: Implement Task Model and Manager
**File:** `src/orchestrator/task_manager.py`
**Test:** `tests/unit/test_task_manager.py`

- [ ] Define `Task` dataclass with all fields
- [ ] Implement `TaskManager.create_task()`
- [ ] Implement `TaskManager.get_task()`
- [ ] Implement `TaskManager.update_state()` with state machine
- [ ] Implement `TaskManager.increment_fail_count()` atomically
- [ ] Implement `TaskManager.list_tasks_by_state()`
- [ ] Add tenant-prefixed key support
- [ ] Write unit tests with mock Redis

**Estimate:** 1.5h

---

### T03: Implement Session Manager
**File:** `src/orchestrator/task_manager.py`
**Test:** `tests/unit/test_task_manager.py`

- [ ] Define `Session` dataclass
- [ ] Implement `SessionManager.create_session()`
- [ ] Implement `SessionManager.get_session()`
- [ ] Implement `SessionManager.update_git_sha()`
- [ ] Add tenant-prefixed key support
- [ ] Write unit tests

**Estimate:** 1h

---

### T04: Implement Git Gateway
**File:** `src/orchestrator/git_gateway.py`
**Test:** `tests/unit/test_git_gateway.py`

- [ ] Create `GitGateway` class with repo path config
- [ ] Implement `is_write_allowed()` from environment
- [ ] Implement `apply_patch()` with git apply + commit
- [ ] Implement `verify_sha_exists()`
- [ ] Implement `get_current_sha()`
- [ ] Implement `create_branch()`
- [ ] Implement `merge_branch()`
- [ ] Add comprehensive error handling
- [ ] Write unit tests with mock repository

**Estimate:** 2h

---

### T05: Implement Manager Agent Core
**File:** `src/orchestrator/manager_agent.py`
**Test:** `tests/unit/test_manager_agent.py`

- [ ] Create `ManagerAgent` class
- [ ] Inject TaskManager, SessionManager, GitGateway
- [ ] Implement `start()` to begin event consumption
- [ ] Implement `stop()` for graceful shutdown
- [ ] Wire up `EventConsumer` from P02-F01
- [ ] Add logging for all operations

**Estimate:** 1.5h

---

### T06: Implement Event Handlers
**File:** `src/orchestrator/manager_agent.py`
**Test:** `tests/unit/test_manager_agent.py`

- [ ] Implement `handle_task_created()`
- [ ] Implement `handle_agent_completed()` with patch application
- [ ] Implement `handle_gate_approved()`
- [ ] Implement `handle_task_failed()` with fail count
- [ ] Add handler routing based on event type
- [ ] Write unit tests for each handler

**Estimate:** 2h

---

### T07: Implement Worker Dispatch
**File:** `src/orchestrator/manager_agent.py`
**Test:** `tests/unit/test_manager_agent.py`

- [ ] Implement `dispatch_to_worker()`
- [ ] Publish `AGENT_STARTED` event
- [ ] Update task state to IN_PROGRESS
- [ ] Include context pack path in event
- [ ] Add idempotency check (don't re-dispatch)
- [ ] Write unit tests

**Estimate:** 1h

---

### T08: Integration Tests
**File:** `tests/integration/test_manager_workflow.py`

- [ ] Test full task lifecycle: create → dispatch → complete
- [ ] Test state transitions through events
- [ ] Test Git operations with test repository
- [ ] Test fail count increment and RLM trigger
- [ ] Test session tracking through workflow

**Estimate:** 2h

---

## Progress

- Started: 2026-01-22
- Tasks Complete: 8/8
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

## Completion Notes

All tasks implemented:
- [x] T01: Task State Machine - 19 tests
- [x] T02: Task Model and Manager - 10 tests
- [x] T03: Session Manager - 5 tests
- [x] T04: Git Gateway - 9 tests
- [x] T05: Manager Agent Core - 2 tests
- [x] T06: Event Handlers - 6 tests
- [x] T07: Worker Dispatch - 2 tests

Total: 53 tests passing

## Dependency Notes

- Requires P02-F01 (EventConsumer, ASDLCEvent) - implement first
- Uses `TenantContext` from P06-F05 (available)
- Uses `TaskStateError` from `src/core/exceptions.py` (available)
- Git operations require `gitpython` package
