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
from src.workers.agents.backends.response_parser import parse_json_from_response

__all__ = [
    "AgentBackend",
    "BackendConfig",
    "BackendResult",
    "parse_json_from_response",
]
