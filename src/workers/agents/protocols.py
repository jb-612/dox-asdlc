"""Agent protocols for aSDLC worker framework.

Defines the BaseAgent protocol and related data structures for
agent implementations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass
class AgentResult:
    """Result from agent execution.

    Attributes:
        success: Whether the agent completed successfully.
        agent_type: Type identifier of the agent that produced this result.
        task_id: The task ID that was processed.
        error_message: Error description if execution failed.
        should_retry: Whether the event should be retried on failure.
        artifact_paths: Paths to artifacts produced by the agent.
        metadata: Additional execution metadata.
    """

    success: bool
    agent_type: str
    task_id: str
    error_message: str | None = None
    should_retry: bool = False
    artifact_paths: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentContext:
    """Execution context for an agent.

    Provides all information needed for agent execution including
    identifiers, workspace paths, and optional context pack data.

    Attributes:
        session_id: The aSDLC session identifier.
        task_id: The task being executed.
        tenant_id: Tenant identifier for multi-tenancy.
        workspace_path: Path to the workspace directory.
        context_pack: Optional context pack data from Repo Mapper.
        metadata: Additional context metadata (git_sha, epic_id, etc.).
    """

    session_id: str
    task_id: str
    tenant_id: str
    workspace_path: str
    context_pack: dict[str, Any] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class BaseAgent(Protocol):
    """Protocol defining the agent interface.

    All domain agents must implement this protocol to be dispatched
    by the worker pool.

    Required:
    - agent_type: Property returning the agent type identifier
    - execute(): Main execution method

    Optional methods (not part of protocol, implement if needed):
    - validate_context(context): Return True if context is valid
    - cleanup(context): Cleanup after execution
    """

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier.

        Returns:
            str: Unique identifier for this agent type (e.g., "coding", "reviewer").
        """
        ...

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute the agent's main task.

        Args:
            context: Execution context with session/task info and workspace.
            event_metadata: Additional metadata from the triggering event.

        Returns:
            AgentResult: Result of the execution including success status
                and any produced artifacts.
        """
        ...
