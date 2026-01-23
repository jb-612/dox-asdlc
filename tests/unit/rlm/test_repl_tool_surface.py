"""Unit tests for REPLToolSurface registry."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from unittest.mock import Mock, MagicMock

import pytest

from src.core.exceptions import RLMToolError
from src.workers.rlm.tools.registry import REPLToolSurface, ToolInvocation


@dataclass
class MockFileTools:
    """Mock FileTools for testing."""

    repo_root: str = "/test/repo"

    def list_files(
        self,
        directory: str = ".",
        pattern: str = "*",
        recursive: bool = False,
        max_results: int = 1000,
    ) -> list[str]:
        """Mock list_files."""
        return ["file1.py", "file2.py"]

    def read_file(
        self,
        file_path: str,
        start_line: int | None = None,
        end_line: int | None = None,
    ) -> str:
        """Mock read_file."""
        return f"content of {file_path}"

    def grep(
        self,
        pattern: str,
        paths: list[str] | None = None,
        context_lines: int = 0,
        max_results: int = 100,
    ) -> list[dict[str, Any]]:
        """Mock grep."""
        return [{"file_path": "test.py", "line_number": 1, "line_content": pattern}]

    def file_exists(self, file_path: str) -> bool:
        """Mock file_exists."""
        return True

    def get_file_info(self, file_path: str) -> dict[str, Any]:
        """Mock get_file_info."""
        return {"path": file_path, "size": 100, "lines": 10}


@dataclass
class MockSymbolTools:
    """Mock SymbolTools for testing."""

    repo_root: str = "/test/repo"

    def extract_symbols(self, file_path: str) -> list[dict[str, Any]]:
        """Mock extract_symbols."""
        return [{"name": "TestClass", "kind": "class", "line": 1}]

    def parse_ast(self, file_path: str) -> dict[str, Any]:
        """Mock parse_ast."""
        return {"type": "module", "children": []}

    def find_symbol(
        self,
        symbol_name: str,
        file_path: str | None = None,
    ) -> list[dict[str, Any]]:
        """Mock find_symbol."""
        return [{"name": symbol_name, "file": "test.py", "line": 1}]

    def find_symbols_by_kind(
        self,
        kind: str,
        file_path: str | None = None,
    ) -> list[dict[str, Any]]:
        """Mock find_symbols_by_kind."""
        return [{"name": "Test", "kind": kind, "line": 1}]

    def get_function_signature(
        self,
        function_name: str,
        file_path: str | None = None,
    ) -> str | None:
        """Mock get_function_signature."""
        return f"def {function_name}():"

    def get_imports(self, file_path: str) -> list[str]:
        """Mock get_imports."""
        return ["import os", "from typing import Any"]


class MockLLMQueryTool:
    """Mock LLMQueryTool for testing."""

    def query(
        self,
        prompt: str,
        context: str = "",
        system_prompt: str | None = None,
        max_tokens: int | None = None,
    ) -> Mock:
        """Mock query."""
        result = Mock()
        result.response = f"Response to: {prompt}"
        result.cached = False
        result.tokens_used = 50
        return result


class TestREPLToolSurfaceCreation:
    """Tests for REPLToolSurface creation."""

    def test_create_with_required_tools(self) -> None:
        """Test creating surface with required tools only."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        # Should have file and symbol tools
        available = surface.get_available_tools()
        assert "list_files" in available
        assert "read_file" in available
        assert "grep" in available
        assert "extract_symbols" in available
        assert "parse_ast" in available
        # Should NOT have llm_query
        assert "llm_query" not in available

    def test_create_with_llm_tool(self) -> None:
        """Test creating surface with LLM tool."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()
        llm_tool = MockLLMQueryTool()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
            llm_query_tool=llm_tool,
        )

        available = surface.get_available_tools()
        assert "llm_query" in available

    def test_create_with_allowed_tools(self) -> None:
        """Test creating surface with tool allowlist."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
            allowed_tools={"list_files", "read_file"},
        )

        available = surface.get_available_tools()
        assert available == ["list_files", "read_file"] or set(available) == {
            "list_files",
            "read_file",
        }


class TestREPLToolSurfaceToolInfo:
    """Tests for tool information methods."""

    def test_get_tool_descriptions(self) -> None:
        """Test getting tool descriptions."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        descriptions = surface.get_tool_descriptions()

        assert "list_files" in descriptions
        assert "pattern" in descriptions["list_files"].lower()
        assert "grep" in descriptions
        assert "search" in descriptions["grep"].lower()

    def test_get_tool_descriptions_respects_allowlist(self) -> None:
        """Test that descriptions respect allowlist."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
            allowed_tools={"list_files"},
        )

        descriptions = surface.get_tool_descriptions()

        assert "list_files" in descriptions
        assert "grep" not in descriptions

    def test_is_tool_allowed(self) -> None:
        """Test is_tool_allowed method."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
            allowed_tools={"list_files", "read_file"},
        )

        assert surface.is_tool_allowed("list_files") is True
        assert surface.is_tool_allowed("read_file") is True
        assert surface.is_tool_allowed("grep") is False
        assert surface.is_tool_allowed("nonexistent") is False

    def test_is_tool_allowed_no_allowlist(self) -> None:
        """Test is_tool_allowed without allowlist."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        assert surface.is_tool_allowed("list_files") is True
        assert surface.is_tool_allowed("grep") is True
        assert surface.is_tool_allowed("extract_symbols") is True


class TestREPLToolSurfaceInvoke:
    """Tests for tool invocation."""

    def test_invoke_list_files(self) -> None:
        """Test invoking list_files."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        result = surface.invoke("list_files", directory="src/", pattern="*.py")

        assert result == ["file1.py", "file2.py"]

    def test_invoke_read_file(self) -> None:
        """Test invoking read_file."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        result = surface.invoke("read_file", file_path="test.py")

        assert "content of test.py" in result

    def test_invoke_grep(self) -> None:
        """Test invoking grep."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        result = surface.invoke("grep", pattern="TODO", paths=["src/"])

        assert len(result) == 1
        assert result[0]["line_content"] == "TODO"

    def test_invoke_extract_symbols(self) -> None:
        """Test invoking extract_symbols."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        result = surface.invoke("extract_symbols", file_path="test.py")

        assert len(result) == 1
        assert result[0]["name"] == "TestClass"

    def test_invoke_llm_query(self) -> None:
        """Test invoking llm_query."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()
        llm_tool = MockLLMQueryTool()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
            llm_query_tool=llm_tool,
        )

        result = surface.invoke("llm_query", prompt="Analyze this code")

        assert "Response to: Analyze this code" in result.response

    def test_invoke_unknown_tool_raises_error(self) -> None:
        """Test that invoking unknown tool raises error."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        with pytest.raises(RLMToolError) as exc_info:
            surface.invoke("unknown_tool")

        assert "Unknown tool" in str(exc_info.value)

    def test_invoke_disallowed_tool_raises_error(self) -> None:
        """Test that invoking disallowed tool raises error."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
            allowed_tools={"list_files"},
        )

        with pytest.raises(RLMToolError) as exc_info:
            surface.invoke("grep", pattern="test")

        assert "not allowed" in str(exc_info.value)


class TestREPLToolSurfaceInvokeSafe:
    """Tests for safe invocation."""

    def test_invoke_safe_success(self) -> None:
        """Test invoke_safe returns result on success."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        result, error = surface.invoke_safe("list_files")

        assert result == ["file1.py", "file2.py"]
        assert error is None

    def test_invoke_safe_failure(self) -> None:
        """Test invoke_safe returns error on failure."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        result, error = surface.invoke_safe("unknown_tool")

        assert result is None
        assert error is not None
        assert "Unknown tool" in error


class TestREPLToolSurfaceInvocationLogging:
    """Tests for invocation logging."""

    def test_invocations_are_logged(self) -> None:
        """Test that invocations are logged."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        surface.invoke("list_files")
        surface.invoke("read_file", file_path="test.py")

        invocations = surface.get_invocations()

        assert len(invocations) == 2
        assert invocations[0].tool_name == "list_files"
        assert invocations[1].tool_name == "read_file"

    def test_invocation_records_arguments(self) -> None:
        """Test that invocation records arguments."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        surface.invoke("list_files", directory="src/", pattern="*.py")

        invocations = surface.get_invocations()

        assert invocations[0].arguments["directory"] == "src/"
        assert invocations[0].arguments["pattern"] == "*.py"

    def test_invocation_records_success(self) -> None:
        """Test that invocation records success status."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        surface.invoke("list_files")

        invocations = surface.get_invocations()

        assert invocations[0].success is True
        assert invocations[0].error is None

    def test_invocation_records_failure(self) -> None:
        """Test that invocation records failure."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        try:
            surface.invoke("unknown_tool")
        except RLMToolError:
            pass

        invocations = surface.get_invocations()

        assert len(invocations) == 1
        assert invocations[0].success is False
        assert invocations[0].error is not None

    def test_invocation_records_duration(self) -> None:
        """Test that invocation records duration."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        surface.invoke("list_files")

        invocations = surface.get_invocations()

        assert invocations[0].duration_ms >= 0

    def test_get_tool_calls(self) -> None:
        """Test get_tool_calls conversion."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        surface.invoke("list_files")

        tool_calls = surface.get_tool_calls()

        assert len(tool_calls) == 1
        assert tool_calls[0].tool_name == "list_files"

    def test_get_invocation_count(self) -> None:
        """Test get_invocation_count."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        assert surface.get_invocation_count() == 0

        surface.invoke("list_files")
        surface.invoke("read_file", file_path="test.py")

        assert surface.get_invocation_count() == 2

    def test_clear_invocations(self) -> None:
        """Test clearing invocations."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        surface.invoke("list_files")
        surface.invoke("read_file", file_path="test.py")

        cleared = surface.clear_invocations()

        assert cleared == 2
        assert surface.get_invocation_count() == 0


class TestREPLToolSurfaceStats:
    """Tests for statistics."""

    def test_get_success_rate(self) -> None:
        """Test success rate calculation."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        # Two successful, one failed
        surface.invoke("list_files")
        surface.invoke("read_file", file_path="test.py")
        try:
            surface.invoke("unknown_tool")
        except RLMToolError:
            pass

        rate = surface.get_success_rate()

        assert rate == pytest.approx(66.67, rel=0.1)

    def test_get_success_rate_no_invocations(self) -> None:
        """Test success rate with no invocations."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        rate = surface.get_success_rate()

        assert rate == 0.0

    def test_get_stats(self) -> None:
        """Test get_stats method."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()
        llm_tool = MockLLMQueryTool()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
            llm_query_tool=llm_tool,
        )

        surface.invoke("list_files")
        surface.invoke("list_files")
        surface.invoke("read_file", file_path="test.py")

        stats = surface.get_stats()

        assert stats["total_invocations"] == 3
        assert stats["success_rate"] == 100.0
        assert stats["has_llm_tool"] is True
        assert stats["tool_counts"]["list_files"] == 2
        assert stats["tool_counts"]["read_file"] == 1


class TestToolInvocation:
    """Tests for ToolInvocation dataclass."""

    def test_to_tool_call(self) -> None:
        """Test conversion to ToolCall."""
        from datetime import datetime, timezone

        invocation = ToolInvocation(
            tool_name="list_files",
            arguments={"directory": "src/"},
            result='["file1.py"]',
            success=True,
            error=None,
            duration_ms=5.5,
            timestamp=datetime.now(timezone.utc),
        )

        tool_call = invocation.to_tool_call()

        assert tool_call.tool_name == "list_files"
        assert tool_call.arguments == {"directory": "src/"}
        assert tool_call.result == '["file1.py"]'
        assert tool_call.duration_ms == 5.5

    def test_to_tool_call_with_error(self) -> None:
        """Test conversion includes error in result."""
        from datetime import datetime, timezone

        invocation = ToolInvocation(
            tool_name="unknown",
            arguments={},
            result="",
            success=False,
            error="Unknown tool",
            duration_ms=1.0,
            timestamp=datetime.now(timezone.utc),
        )

        tool_call = invocation.to_tool_call()

        assert "Error: Unknown tool" in tool_call.result

    def test_to_dict(self) -> None:
        """Test conversion to dictionary."""
        from datetime import datetime, timezone

        timestamp = datetime.now(timezone.utc)
        invocation = ToolInvocation(
            tool_name="list_files",
            arguments={"directory": "src/"},
            result='["file1.py"]',
            success=True,
            error=None,
            duration_ms=5.5,
            timestamp=timestamp,
        )

        data = invocation.to_dict()

        assert data["tool_name"] == "list_files"
        assert data["arguments"] == {"directory": "src/"}
        assert data["success"] is True
        assert data["timestamp"] == timestamp.isoformat()


class TestREPLToolSurfaceRepr:
    """Tests for string representation."""

    def test_repr(self) -> None:
        """Test string representation."""
        file_tools = MockFileTools()
        symbol_tools = MockSymbolTools()

        surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
        )

        surface.invoke("list_files")

        repr_str = repr(surface)

        assert "REPLToolSurface" in repr_str
        assert "tools=" in repr_str
        assert "invocations=1" in repr_str
