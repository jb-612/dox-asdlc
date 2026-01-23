"""REPLToolSurface registry for RLM exploration.

Aggregates all tools and provides unified dispatch and invocation logging.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from src.core.exceptions import RLMToolError
from src.workers.rlm.models import ToolCall

logger = logging.getLogger(__name__)


# Tool registry type: name -> (callable, description)
ToolRegistry = dict[str, tuple[Callable[..., Any], str]]


@dataclass
class ToolInvocation:
    """Record of a single tool invocation.

    Attributes:
        tool_name: Name of the tool invoked
        arguments: Arguments passed to the tool
        result: Result from the tool (truncated if large)
        success: Whether the invocation succeeded
        error: Error message if failed
        duration_ms: Execution duration in milliseconds
        timestamp: When the invocation occurred
    """

    tool_name: str
    arguments: dict[str, Any]
    result: str
    success: bool
    error: str | None
    duration_ms: float
    timestamp: datetime

    def to_tool_call(self) -> ToolCall:
        """Convert to ToolCall model."""
        return ToolCall(
            tool_name=self.tool_name,
            arguments=self.arguments,
            result=self.result if self.success else f"Error: {self.error}",
            duration_ms=self.duration_ms,
            timestamp=self.timestamp,
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "tool_name": self.tool_name,
            "arguments": self.arguments,
            "result": self.result,
            "success": self.success,
            "error": self.error,
            "duration_ms": self.duration_ms,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class REPLToolSurface:
    """Unified tool surface for RLM exploration.

    Aggregates file tools, symbol tools, and LLM query tools into a
    single interface with consistent invocation logging.

    Attributes:
        file_tools: FileTools instance for file operations
        symbol_tools: SymbolTools instance for symbol operations
        llm_query_tool: LLMQueryTool instance for LLM queries (optional)
        allowed_tools: Set of allowed tool names (None = all allowed)

    Example:
        surface = REPLToolSurface(
            file_tools=FileTools(repo_root="/path/to/repo"),
            symbol_tools=SymbolTools(repo_root="/path/to/repo"),
            llm_query_tool=llm_tool,
        )

        result = surface.invoke("list_files", directory="src/", pattern="*.py")
        result = surface.invoke("grep", pattern="TODO", paths=["src/"])
    """

    file_tools: Any  # FileTools
    symbol_tools: Any  # SymbolTools
    llm_query_tool: Any | None = None  # LLMQueryTool
    allowed_tools: set[str] | None = None
    _registry: ToolRegistry = field(default_factory=dict, init=False)
    _invocations: list[ToolInvocation] = field(default_factory=list, init=False)

    def __post_init__(self) -> None:
        """Initialize the tool registry."""
        self._build_registry()

    def _build_registry(self) -> None:
        """Build the tool registry from available tools."""
        # File tools
        self._registry["list_files"] = (
            self.file_tools.list_files,
            "List files matching a pattern in a directory",
        )
        self._registry["read_file"] = (
            self.file_tools.read_file,
            "Read contents of a file",
        )
        self._registry["grep"] = (
            self.file_tools.grep,
            "Search for pattern in files",
        )
        self._registry["file_exists"] = (
            self.file_tools.file_exists,
            "Check if a file exists",
        )
        self._registry["get_file_info"] = (
            self.file_tools.get_file_info,
            "Get metadata about a file",
        )

        # Symbol tools
        self._registry["extract_symbols"] = (
            self.symbol_tools.extract_symbols,
            "Extract symbols from a file",
        )
        self._registry["parse_ast"] = (
            self.symbol_tools.parse_ast,
            "Parse abstract syntax tree of a file",
        )
        self._registry["find_symbol"] = (
            self.symbol_tools.find_symbol,
            "Find a specific symbol by name",
        )
        self._registry["find_symbols_by_kind"] = (
            self.symbol_tools.find_symbols_by_kind,
            "Find symbols of a specific kind",
        )
        self._registry["get_function_signature"] = (
            self.symbol_tools.get_function_signature,
            "Get signature of a function",
        )
        self._registry["get_imports"] = (
            self.symbol_tools.get_imports,
            "Get imports from a file",
        )

        # LLM query tool (if available)
        if self.llm_query_tool is not None:
            self._registry["llm_query"] = (
                self.llm_query_tool.query,
                "Query LLM for analysis",
            )

        logger.debug(f"Built tool registry with {len(self._registry)} tools")

    def get_available_tools(self) -> list[str]:
        """Get list of available tool names.

        Returns:
            List of tool names that can be invoked
        """
        if self.allowed_tools is not None:
            return [t for t in self._registry.keys() if t in self.allowed_tools]
        return list(self._registry.keys())

    def get_tool_descriptions(self) -> dict[str, str]:
        """Get descriptions of all available tools.

        Returns:
            Dictionary mapping tool names to descriptions
        """
        available = set(self.get_available_tools())
        return {
            name: desc
            for name, (_, desc) in self._registry.items()
            if name in available
        }

    def is_tool_allowed(self, tool_name: str) -> bool:
        """Check if a tool is allowed to be invoked.

        Args:
            tool_name: Name of the tool to check

        Returns:
            True if the tool exists and is allowed
        """
        if tool_name not in self._registry:
            return False
        if self.allowed_tools is None:
            return True
        return tool_name in self.allowed_tools

    def invoke(self, tool_name: str, **kwargs: Any) -> Any:
        """Invoke a tool by name.

        Args:
            tool_name: Name of the tool to invoke
            **kwargs: Arguments to pass to the tool

        Returns:
            Result from the tool

        Raises:
            RLMToolError: If tool is not found or not allowed
        """
        timestamp = datetime.now(timezone.utc)
        start_time = time.perf_counter()

        # Check if tool exists
        if tool_name not in self._registry:
            raise RLMToolError(f"Unknown tool: {tool_name}")

        # Check if tool is allowed
        if not self.is_tool_allowed(tool_name):
            raise RLMToolError(
                f"Tool not allowed: {tool_name}. "
                f"Allowed tools: {self.allowed_tools}"
            )

        tool_func, _ = self._registry[tool_name]

        try:
            result = tool_func(**kwargs)
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Format result for logging
            result_str = self._format_result(result)

            invocation = ToolInvocation(
                tool_name=tool_name,
                arguments=kwargs,
                result=result_str,
                success=True,
                error=None,
                duration_ms=duration_ms,
                timestamp=timestamp,
            )
            self._invocations.append(invocation)

            logger.debug(
                f"Tool invocation: {tool_name}({self._format_args(kwargs)}) "
                f"-> {len(result_str)} chars in {duration_ms:.1f}ms"
            )

            return result

        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000

            invocation = ToolInvocation(
                tool_name=tool_name,
                arguments=kwargs,
                result="",
                success=False,
                error=str(e),
                duration_ms=duration_ms,
                timestamp=timestamp,
            )
            self._invocations.append(invocation)

            logger.warning(
                f"Tool invocation failed: {tool_name}({self._format_args(kwargs)}) "
                f"-> {e}"
            )

            raise

    def invoke_safe(self, tool_name: str, **kwargs: Any) -> tuple[Any, str | None]:
        """Invoke a tool, returning error instead of raising.

        Args:
            tool_name: Name of the tool to invoke
            **kwargs: Arguments to pass to the tool

        Returns:
            Tuple of (result, error). If successful, error is None.
            If failed, result is None and error contains the message.
        """
        try:
            result = self.invoke(tool_name, **kwargs)
            return result, None
        except Exception as e:
            return None, str(e)

    def _format_result(self, result: Any, max_length: int = 500) -> str:
        """Format a result for logging.

        Args:
            result: The result to format
            max_length: Maximum length before truncation

        Returns:
            String representation of the result
        """
        if result is None:
            return "None"

        if isinstance(result, str):
            result_str = result
        elif isinstance(result, (list, dict)):
            import json
            try:
                result_str = json.dumps(result, default=str)
            except Exception:
                result_str = str(result)
        else:
            result_str = str(result)

        if len(result_str) > max_length:
            return result_str[:max_length] + f"... ({len(result_str)} chars total)"
        return result_str

    def _format_args(self, args: dict[str, Any], max_length: int = 100) -> str:
        """Format arguments for logging.

        Args:
            args: Arguments dictionary
            max_length: Maximum length per argument

        Returns:
            Formatted string representation
        """
        parts = []
        for key, value in args.items():
            value_str = str(value)
            if len(value_str) > max_length:
                value_str = value_str[:max_length] + "..."
            parts.append(f"{key}={value_str!r}")
        return ", ".join(parts)

    def get_invocations(self) -> list[ToolInvocation]:
        """Get all tool invocations.

        Returns:
            List of ToolInvocation records
        """
        return list(self._invocations)

    def get_tool_calls(self) -> list[ToolCall]:
        """Get all invocations as ToolCall models.

        Returns:
            List of ToolCall records
        """
        return [inv.to_tool_call() for inv in self._invocations]

    def get_invocation_count(self) -> int:
        """Get total number of invocations."""
        return len(self._invocations)

    def get_success_rate(self) -> float:
        """Get success rate as percentage.

        Returns:
            Success rate (0-100), or 0 if no invocations
        """
        if not self._invocations:
            return 0.0
        successful = sum(1 for inv in self._invocations if inv.success)
        return (successful / len(self._invocations)) * 100

    def clear_invocations(self) -> int:
        """Clear invocation history.

        Returns:
            Number of invocations cleared
        """
        count = len(self._invocations)
        self._invocations.clear()
        return count

    def get_stats(self) -> dict[str, Any]:
        """Get tool surface statistics.

        Returns:
            Dictionary with statistics
        """
        tool_counts: dict[str, int] = {}
        for inv in self._invocations:
            tool_counts[inv.tool_name] = tool_counts.get(inv.tool_name, 0) + 1

        return {
            "total_invocations": len(self._invocations),
            "success_rate": self.get_success_rate(),
            "available_tools": len(self.get_available_tools()),
            "tool_counts": tool_counts,
            "has_llm_tool": self.llm_query_tool is not None,
        }

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"REPLToolSurface(tools={len(self.get_available_tools())}, "
            f"invocations={len(self._invocations)})"
        )
