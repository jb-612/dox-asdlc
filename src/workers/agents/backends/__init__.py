"""Agent backends for executing work via different runtimes.

Provides a pluggable backend abstraction so agents can delegate work
to Claude Code CLI, Codex CLI, Cursor CLI, or fall back to direct
LLM API calls.
"""

from src.workers.agents.backends.base import (
    AgentBackend,
    BackendConfig,
    BackendResult,
)

__all__ = [
    "AgentBackend",
    "BackendConfig",
    "BackendResult",
]
