"""Agent backend protocol and data classes.

Defines the interface that all agent backends must implement,
whether they wrap a CLI tool (Claude Code, Codex) or call
LLM APIs directly.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass
class BackendConfig:
    """Configuration for a backend execution.

    Attributes:
        max_turns: Maximum agentic turns (CLI backends only).
        max_budget_usd: Maximum cost in USD (CLI backends only).
        model: Model override (e.g. "sonnet", "opus").
        output_schema: JSON Schema for structured output validation.
        allowed_tools: Tools to auto-approve (CLI backends only).
        timeout_seconds: Hard timeout for execution.
        system_prompt: System prompt override.
        extra_flags: Additional CLI flags (CLI backends only).
    """

    max_turns: int | None = None
    max_budget_usd: float | None = None
    model: str | None = None
    output_schema: dict[str, Any] | None = None
    allowed_tools: list[str] | None = None
    timeout_seconds: int = 300
    system_prompt: str | None = None
    extra_flags: list[str] = field(default_factory=list)


@dataclass
class BackendResult:
    """Result from a backend execution.

    Attributes:
        success: Whether execution completed successfully.
        output: Text output from the backend.
        structured_output: Parsed JSON if output_schema was provided.
        session_id: Session ID for resumption (CLI backends).
        cost_usd: Total cost in USD (if available).
        turns: Number of agentic turns used (if available).
        error: Error message if execution failed.
        metadata: Additional backend-specific metadata.
    """

    success: bool
    output: str = ""
    structured_output: dict[str, Any] | None = None
    session_id: str | None = None
    cost_usd: float | None = None
    turns: int | None = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class AgentBackend(Protocol):
    """Protocol for agent execution backends.

    Implementations wrap different runtimes:
    - CLIAgentBackend: Claude Code CLI, Codex CLI (subprocess)
    - LLMAgentBackend: Direct LLM API calls (legacy)

    Example:
        backend = CLIAgentBackend(cli="claude")
        result = await backend.execute(
            prompt="Break this PRD into features and tasks",
            workspace_path="/workspace/project",
            config=BackendConfig(max_turns=20),
        )
    """

    @property
    def backend_name(self) -> str:
        """Return the backend identifier (e.g. 'claude-cli', 'codex-cli')."""
        ...

    async def execute(
        self,
        prompt: str,
        workspace_path: str,
        config: BackendConfig | None = None,
    ) -> BackendResult:
        """Execute a prompt using this backend.

        Args:
            prompt: The task prompt for the agent.
            workspace_path: Working directory for execution.
            config: Optional execution configuration.

        Returns:
            BackendResult with output and metadata.
        """
        ...

    async def health_check(self) -> bool:
        """Check if this backend is available and functional.

        Returns:
            True if the backend can accept work.
        """
        ...
