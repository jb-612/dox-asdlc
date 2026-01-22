# P02-F02: Manager Agent and Commit Gateway

## Technical Design

### Overview

The Manager Agent is the exclusive commit gateway and state machine owner for the aSDLC system. It is the only component with write access to protected Git branches. It consumes events from Redis Streams, manages task state transitions, dispatches work to agent workers, and applies patches to the repository.

### Architecture Reference

From `docs/System_Design.md` Section 4.1:
- Container 1: Orchestrator and Governance
- Has exclusive Git write access to protected branches
- Consumes Redis Streams and dispatches work
- Writes gate decisions and merges patches

### Dependencies

**Internal:**
- P02-F01: Redis event streams (events, consumer_group) ✅
- P01-F01: Infrastructure (Docker, Redis) ✅
- P06-F05: Multi-tenancy (TenantContext) ✅

**External:**
- `gitpython` (Git operations)
- `redis.asyncio` (state hashes)

### Components

#### 1. Task State Machine (`src/orchestrator/state_machine.py`)

```python
class TaskState(str, Enum):
    PENDING = "pending"           # Created but not started
    IN_PROGRESS = "in_progress"   # Agent working on it
    TESTING = "testing"           # Running tests
    REVIEW = "review"             # Code review in progress
    BLOCKED_HITL = "blocked_hitl" # Waiting for human approval
    COMPLETE = "complete"         # Done
    FAILED = "failed"             # Permanently failed

class TaskStateMachine:
    """Manages valid task state transitions."""

    TRANSITIONS: dict[TaskState, set[TaskState]] = {
        TaskState.PENDING: {TaskState.IN_PROGRESS, TaskState.FAILED},
        TaskState.IN_PROGRESS: {TaskState.TESTING, TaskState.FAILED, TaskState.BLOCKED_HITL},
        TaskState.TESTING: {TaskState.REVIEW, TaskState.IN_PROGRESS, TaskState.FAILED},
        TaskState.REVIEW: {TaskState.BLOCKED_HITL, TaskState.IN_PROGRESS, TaskState.FAILED},
        TaskState.BLOCKED_HITL: {TaskState.COMPLETE, TaskState.IN_PROGRESS, TaskState.FAILED},
        TaskState.COMPLETE: set(),  # Terminal state
        TaskState.FAILED: {TaskState.PENDING},  # Can retry
    }

    def can_transition(self, from_state: TaskState, to_state: TaskState) -> bool:
        """Check if transition is valid."""

    def transition(self, task: Task, to_state: TaskState) -> Task:
        """Transition task to new state if valid."""
```

#### 2. Task Manager (`src/orchestrator/task_manager.py`)

```python
@dataclass
class Task:
    """Task entity with state and metadata."""
    task_id: str
    session_id: str
    epic_id: str
    state: TaskState
    fail_count: int = 0
    current_agent: str | None = None
    git_sha: str | None = None
    artifact_paths: list[str] = field(default_factory=list)
    created_at: datetime
    updated_at: datetime

class TaskManager:
    """Manages task state in Redis hashes."""

    KEY_PREFIX = "asdlc:task:"

    async def create_task(self, task: Task) -> Task:
        """Create new task in Redis."""

    async def get_task(self, task_id: str) -> Task | None:
        """Get task by ID."""

    async def update_state(
        self,
        task_id: str,
        new_state: TaskState,
        **updates,
    ) -> Task:
        """Update task state with validation."""

    async def increment_fail_count(self, task_id: str) -> int:
        """Atomically increment fail count."""

    async def list_tasks_by_state(
        self,
        state: TaskState,
        session_id: str | None = None,
    ) -> list[Task]:
        """List tasks in given state."""
```

#### 3. Session Manager (`src/orchestrator/task_manager.py`)

```python
@dataclass
class Session:
    """Session tracking current work."""
    session_id: str
    tenant_id: str
    current_git_sha: str
    active_epic_ids: list[str]
    created_at: datetime
    status: str = "active"

class SessionManager:
    """Manages session state in Redis hashes."""

    KEY_PREFIX = "asdlc:session:"

    async def create_session(self, session: Session) -> Session:
        """Create new session."""

    async def get_session(self, session_id: str) -> Session | None:
        """Get session by ID."""

    async def update_git_sha(self, session_id: str, git_sha: str) -> None:
        """Update session's current Git SHA."""
```

#### 4. Git Gateway (`src/orchestrator/git_gateway.py`)

```python
class GitGateway:
    """Exclusive Git write access for the Manager Agent.

    This class enforces that only the orchestrator container
    can write to protected branches.
    """

    def __init__(
        self,
        repo_path: str,
        protected_branches: list[str] = ["main", "develop"],
    ):
        ...

    async def apply_patch(
        self,
        patch_path: str,
        commit_message: str,
        task_id: str,
    ) -> str:
        """Apply patch and commit. Returns new SHA."""

    async def verify_sha_exists(self, sha: str) -> bool:
        """Verify a commit SHA exists in the repo."""

    async def get_current_sha(self, branch: str = "HEAD") -> str:
        """Get current commit SHA."""

    async def create_branch(
        self,
        branch_name: str,
        from_ref: str = "HEAD",
    ) -> None:
        """Create a new branch."""

    async def merge_branch(
        self,
        source_branch: str,
        target_branch: str = "main",
        commit_message: str | None = None,
    ) -> str:
        """Merge source into target. Returns new SHA."""

    def is_write_allowed(self) -> bool:
        """Check if this instance has Git write permissions."""
```

#### 5. Manager Agent (`src/orchestrator/manager_agent.py`)

```python
class ManagerAgent:
    """Core orchestration agent.

    Consumes events from Redis Streams, manages task state,
    dispatches work to workers, and applies Git changes.
    """

    def __init__(
        self,
        task_manager: TaskManager,
        session_manager: SessionManager,
        git_gateway: GitGateway,
        event_publisher: EventPublisher,
    ):
        ...

    async def start(self) -> None:
        """Start consuming events and processing."""

    async def stop(self) -> None:
        """Graceful shutdown."""

    async def handle_task_created(self, event: ASDLCEvent) -> None:
        """Handle new task creation."""

    async def handle_agent_completed(self, event: ASDLCEvent) -> None:
        """Handle agent completion, apply patches."""

    async def handle_gate_approved(self, event: ASDLCEvent) -> None:
        """Handle HITL approval, advance state."""

    async def dispatch_to_worker(
        self,
        task: Task,
        agent_type: str,
    ) -> None:
        """Dispatch task to agent worker pool."""
```

### Redis Hash Schema

**Task Hash (`asdlc:task:{task_id}`):**
```
{
    "task_id": "uuid",
    "session_id": "uuid",
    "epic_id": "epic-123",
    "state": "in_progress",
    "fail_count": "2",
    "current_agent": "coding-agent",
    "git_sha": "abc123",
    "artifact_paths": "/patches/task-1.patch,/reports/task-1.md",
    "created_at": "2026-01-22T10:00:00Z",
    "updated_at": "2026-01-22T10:30:00Z"
}
```

**Session Hash (`asdlc:session:{session_id}`):**
```
{
    "session_id": "uuid",
    "tenant_id": "acme-corp",
    "current_git_sha": "abc123",
    "active_epic_ids": "epic-1,epic-2",
    "created_at": "2026-01-22T09:00:00Z",
    "status": "active"
}
```

### Event Flow

```
┌──────────────────┐
│  Event Stream    │
│  asdlc:events    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Manager Agent   │
│  (Consumer)      │
└────────┬─────────┘
         │
    ┌────┴────┬────────────┐
    ▼         ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Task   │ │ Git    │ │ Worker │
│ State  │ │Gateway │ │Dispatch│
└────────┘ └────────┘ └────────┘
```

### Security Considerations

1. **Exclusive Write Access**: Only Manager Agent container has Git credentials
2. **Protected Branches**: Configuration specifies which branches require gateway
3. **Audit Trail**: All Git operations logged with task context
4. **Patch Validation**: Patches validated before application

### Error Handling

- **State transition failures**: Log and publish error event
- **Git operation failures**: Increment fail_count, potentially block task
- **Worker dispatch failures**: Retry with backoff

### Testing Strategy

1. **Unit tests**: State machine transitions, task/session CRUD
2. **Integration tests**: Full event → state → Git flow
3. **Mock tests**: Git operations with mock repository

### Files to Create

| File | Action |
|------|--------|
| `src/orchestrator/state_machine.py` | Create |
| `src/orchestrator/task_manager.py` | Create |
| `src/orchestrator/git_gateway.py` | Create |
| `src/orchestrator/manager_agent.py` | Create |
| `tests/unit/test_state_machine.py` | Create |
| `tests/unit/test_task_manager.py` | Create |
| `tests/unit/test_git_gateway.py` | Create |
| `tests/unit/test_manager_agent.py` | Create |
| `tests/integration/test_manager_workflow.py` | Create |
