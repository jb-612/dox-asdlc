"""Task and session management for aSDLC orchestration.

Provides persistent storage of task state and session tracking in Redis hashes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis

from src.core.config import get_redis_config, get_tenant_config
from src.core.exceptions import TaskNotFoundError, TaskStateError
from src.core.redis_client import get_redis_client
from src.core.tenant import TenantContext
from src.orchestrator.state_machine import TaskState, TaskStateMachine

logger = logging.getLogger(__name__)


@dataclass
class Task:
    """Task entity with state and metadata.

    Tasks are the primary work units in the aSDLC workflow.
    Their state is managed by the TaskStateMachine.
    """

    task_id: str
    session_id: str
    epic_id: str
    state: TaskState
    created_at: datetime
    updated_at: datetime
    fail_count: int = 0
    current_agent: str | None = None
    git_sha: str | None = None
    artifact_paths: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, str]:
        """Serialize task to Redis hash format.

        Redis hashes store string values, so we convert all fields.
        """
        data = {
            "task_id": self.task_id,
            "session_id": self.session_id,
            "epic_id": self.epic_id,
            "state": self.state.value,
            "fail_count": str(self.fail_count),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

        if self.current_agent:
            data["current_agent"] = self.current_agent
        if self.git_sha:
            data["git_sha"] = self.git_sha
        if self.artifact_paths:
            data["artifact_paths"] = ",".join(self.artifact_paths)

        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Task:
        """Deserialize task from Redis hash format."""
        artifact_paths_str = data.get("artifact_paths", "")
        if isinstance(artifact_paths_str, str) and artifact_paths_str:
            artifact_paths = artifact_paths_str.split(",")
        else:
            artifact_paths = []

        return cls(
            task_id=data.get("task_id", ""),
            session_id=data.get("session_id", ""),
            epic_id=data.get("epic_id", ""),
            state=TaskState(data.get("state", "pending")),
            fail_count=int(data.get("fail_count", "0")),
            current_agent=data.get("current_agent"),
            git_sha=data.get("git_sha"),
            artifact_paths=artifact_paths,
            created_at=datetime.fromisoformat(
                data.get("created_at", datetime.now(timezone.utc).isoformat())
            ),
            updated_at=datetime.fromisoformat(
                data.get("updated_at", datetime.now(timezone.utc).isoformat())
            ),
        )


@dataclass
class Session:
    """Session tracking current work context.

    Sessions group related tasks and track the current Git SHA.
    """

    session_id: str
    tenant_id: str
    current_git_sha: str
    active_epic_ids: list[str]
    created_at: datetime
    status: str = "active"

    def to_dict(self) -> dict[str, str]:
        """Serialize session to Redis hash format."""
        return {
            "session_id": self.session_id,
            "tenant_id": self.tenant_id,
            "current_git_sha": self.current_git_sha,
            "active_epic_ids": ",".join(self.active_epic_ids),
            "created_at": self.created_at.isoformat(),
            "status": self.status,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Session:
        """Deserialize session from Redis hash format."""
        epic_ids_str = data.get("active_epic_ids", "")
        if isinstance(epic_ids_str, str) and epic_ids_str:
            active_epic_ids = epic_ids_str.split(",")
        else:
            active_epic_ids = []

        return cls(
            session_id=data.get("session_id", ""),
            tenant_id=data.get("tenant_id", ""),
            current_git_sha=data.get("current_git_sha", ""),
            active_epic_ids=active_epic_ids,
            created_at=datetime.fromisoformat(
                data.get("created_at", datetime.now(timezone.utc).isoformat())
            ),
            status=data.get("status", "active"),
        )


class TaskManager:
    """Manages task state in Redis hashes.

    Provides CRUD operations for tasks with state machine validation.
    """

    KEY_PREFIX = "asdlc:task:"

    def __init__(self, client: redis.Redis | None = None):
        """Initialize the task manager.

        Args:
            client: Redis client. Will create one if not provided.
        """
        self._client = client
        self._state_machine = TaskStateMachine()

    async def _get_client(self) -> redis.Redis:
        """Get or create the Redis client."""
        if self._client is None:
            self._client = await get_redis_client()
        return self._client

    def _get_key(self, task_id: str) -> str:
        """Get the Redis key for a task.

        Args:
            task_id: The task identifier.

        Returns:
            The full Redis key with optional tenant prefix.
        """
        base_key = f"{self.KEY_PREFIX}{task_id}"

        tenant_config = get_tenant_config()
        if tenant_config.enabled:
            try:
                tenant_id = TenantContext.get_current_tenant()
                return f"tenant:{tenant_id}:{base_key}"
            except Exception:
                return f"tenant:{tenant_config.default_tenant}:{base_key}"

        return base_key

    async def create_task(self, task: Task) -> Task:
        """Create a new task in Redis.

        Args:
            task: The task to create.

        Returns:
            The created task.
        """
        client = await self._get_client()
        key = self._get_key(task.task_id)

        await client.hset(key, mapping=task.to_dict())
        logger.info(f"Created task: {task.task_id}")

        return task

    async def get_task(self, task_id: str) -> Task | None:
        """Get a task by ID.

        Args:
            task_id: The task identifier.

        Returns:
            The task if found, None otherwise.
        """
        client = await self._get_client()
        key = self._get_key(task_id)

        data = await client.hgetall(key)
        if not data:
            return None

        return Task.from_dict(data)

    async def update_state(
        self,
        task_id: str,
        new_state: TaskState,
        **updates: Any,
    ) -> Task:
        """Update task state with validation.

        Args:
            task_id: The task identifier.
            new_state: The target state.
            **updates: Additional fields to update.

        Returns:
            The updated task.

        Raises:
            TaskNotFoundError: If task doesn't exist.
            TaskStateError: If transition is invalid.
        """
        task = await self.get_task(task_id)
        if task is None:
            raise TaskNotFoundError(
                f"Task not found: {task_id}",
                details={"task_id": task_id},
            )

        # Validate transition
        self._state_machine.validate_transition(task.state, new_state)

        # Update the task
        client = await self._get_client()
        key = self._get_key(task_id)

        task.state = new_state
        task.updated_at = datetime.now(timezone.utc)

        # Apply additional updates
        for field_name, value in updates.items():
            if hasattr(task, field_name):
                setattr(task, field_name, value)

        await client.hset(key, mapping=task.to_dict())
        logger.info(f"Updated task {task_id} state: {new_state.value}")

        return task

    async def increment_fail_count(self, task_id: str) -> int:
        """Atomically increment the fail count.

        Args:
            task_id: The task identifier.

        Returns:
            The new fail count.
        """
        client = await self._get_client()
        key = self._get_key(task_id)

        count = await client.hincrby(key, "fail_count", 1)

        # Also update the updated_at timestamp
        await client.hset(
            key, "updated_at", datetime.now(timezone.utc).isoformat()
        )

        logger.debug(f"Task {task_id} fail count: {count}")
        return count

    async def list_tasks_by_state(
        self,
        state: TaskState,
        session_id: str | None = None,
    ) -> list[Task]:
        """List tasks in a given state.

        Note: This is a scan operation and may be slow for large datasets.
        Consider adding a secondary index for production use.

        Args:
            state: Filter by this state.
            session_id: Optional session filter.

        Returns:
            List of tasks matching the criteria.
        """
        client = await self._get_client()

        # Determine key pattern
        tenant_config = get_tenant_config()
        if tenant_config.enabled:
            try:
                tenant_id = TenantContext.get_current_tenant()
                pattern = f"tenant:{tenant_id}:{self.KEY_PREFIX}*"
            except Exception:
                pattern = f"tenant:{tenant_config.default_tenant}:{self.KEY_PREFIX}*"
        else:
            pattern = f"{self.KEY_PREFIX}*"

        tasks = []
        async for key in client.scan_iter(match=pattern, count=100):
            data = await client.hgetall(key)
            if data and data.get("state") == state.value:
                if session_id is None or data.get("session_id") == session_id:
                    tasks.append(Task.from_dict(data))

        return tasks


class SessionManager:
    """Manages session state in Redis hashes."""

    KEY_PREFIX = "asdlc:session:"

    def __init__(self, client: redis.Redis | None = None):
        """Initialize the session manager.

        Args:
            client: Redis client. Will create one if not provided.
        """
        self._client = client

    async def _get_client(self) -> redis.Redis:
        """Get or create the Redis client."""
        if self._client is None:
            self._client = await get_redis_client()
        return self._client

    def _get_key(self, session_id: str) -> str:
        """Get the Redis key for a session."""
        base_key = f"{self.KEY_PREFIX}{session_id}"

        tenant_config = get_tenant_config()
        if tenant_config.enabled:
            try:
                tenant_id = TenantContext.get_current_tenant()
                return f"tenant:{tenant_id}:{base_key}"
            except Exception:
                return f"tenant:{tenant_config.default_tenant}:{base_key}"

        return base_key

    async def create_session(self, session: Session) -> Session:
        """Create a new session in Redis.

        Args:
            session: The session to create.

        Returns:
            The created session.
        """
        client = await self._get_client()
        key = self._get_key(session.session_id)

        await client.hset(key, mapping=session.to_dict())
        logger.info(f"Created session: {session.session_id}")

        return session

    async def get_session(self, session_id: str) -> Session | None:
        """Get a session by ID.

        Args:
            session_id: The session identifier.

        Returns:
            The session if found, None otherwise.
        """
        client = await self._get_client()
        key = self._get_key(session_id)

        data = await client.hgetall(key)
        if not data:
            return None

        return Session.from_dict(data)

    async def update_git_sha(self, session_id: str, git_sha: str) -> None:
        """Update the session's current Git SHA.

        Args:
            session_id: The session identifier.
            git_sha: The new Git SHA.
        """
        client = await self._get_client()
        key = self._get_key(session_id)

        await client.hset(key, "current_git_sha", git_sha)
        logger.debug(f"Updated session {session_id} Git SHA: {git_sha}")

    async def add_active_epic(self, session_id: str, epic_id: str) -> None:
        """Add an epic to the session's active list.

        Args:
            session_id: The session identifier.
            epic_id: The epic to add.
        """
        session = await self.get_session(session_id)
        if session is None:
            return

        if epic_id not in session.active_epic_ids:
            session.active_epic_ids.append(epic_id)

            client = await self._get_client()
            key = self._get_key(session_id)
            await client.hset(
                key, "active_epic_ids", ",".join(session.active_epic_ids)
            )

    async def update_status(self, session_id: str, status: str) -> None:
        """Update the session status.

        Args:
            session_id: The session identifier.
            status: The new status.
        """
        client = await self._get_client()
        key = self._get_key(session_id)

        await client.hset(key, "status", status)
        logger.info(f"Updated session {session_id} status: {status}")
