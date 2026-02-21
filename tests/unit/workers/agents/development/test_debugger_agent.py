"""Unit tests for DebuggerAgent (AgentBackend refactor)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, PropertyMock

import pytest

from src.workers.agents.backends.base import BackendResult
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.protocols import AgentContext


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_backend():
    """Create a mock AgentBackend."""
    backend = MagicMock()
    type(backend).backend_name = PropertyMock(return_value="test-backend")
    backend.execute = AsyncMock()
    backend.health_check = AsyncMock(return_value=True)
    return backend


@pytest.fixture
def mock_artifact_writer(tmp_path):
    """Create a mock artifact writer."""
    writer = MagicMock()
    writer.workspace_path = str(tmp_path)

    async def write_artifact(**kwargs):
        path = tmp_path / kwargs.get("filename", "artifact.json")
        path.write_text(kwargs.get("content", "{}"))
        return str(path)

    writer.write_artifact = AsyncMock(side_effect=write_artifact)
    return writer


@pytest.fixture
def agent_context():
    """Create a test agent context."""
    return AgentContext(
        session_id="test-session",
        task_id="test-task",
        tenant_id="default",
        workspace_path="/tmp/workspace",
    )


@pytest.fixture
def config():
    """Create test configuration."""
    return DevelopmentConfig()


def _make_backend_result(analysis_response: dict, **kwargs) -> BackendResult:
    """Helper to create a successful BackendResult from a dict."""
    return BackendResult(
        success=True,
        output=json.dumps(analysis_response),
        structured_output=analysis_response,
        **kwargs,
    )


# ---------------------------------------------------------------------------
# Protocol / construction tests
# ---------------------------------------------------------------------------


class TestDebuggerAgentProtocol:
    """Tests for DebuggerAgent implementing BaseAgent protocol."""

    def test_agent_type_returns_correct_value(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that agent_type returns 'debugger'."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "debugger"

    def test_agent_implements_base_agent_protocol(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that DebuggerAgent implements BaseAgent protocol."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent
        from src.workers.agents.protocols import BaseAgent

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert isinstance(agent, BaseAgent)


# ---------------------------------------------------------------------------
# Execution tests
# ---------------------------------------------------------------------------


class TestDebuggerAgentExecution:
    """Tests for DebuggerAgent.execute() method."""

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_test_output(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no test_output provided."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(agent_context, {})

        assert result.success is False
        assert "test_output" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_implementation(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no implementation provided."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"test_output": "FAILED test_feature - AssertionError"},
        )

        assert result.success is False
        assert "implementation" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_generates_debug_analysis(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute generates debug analysis from test failures."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "The function returns None instead of the expected value",
            "fix_suggestion": "Add return statement with computed value",
            "code_changes": [
                {
                    "file_path": "src/impl.py",
                    "original_code": "def calculate():\n    result = 5 + 3",
                    "new_code": "def calculate():\n    result = 5 + 3\n    return result",
                    "description": "Add missing return statement",
                    "line_start": 1,
                    "line_end": 2,
                }
            ],
        }

        mock_backend.execute.return_value = _make_backend_result(analysis_response)

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_calculate - AssertionError: expected 8, got None",
                "implementation": "def calculate():\n    result = 5 + 3",
            },
        )

        assert result.success is True
        assert result.agent_type == "debugger"
        assert len(result.artifact_paths) >= 1
        assert result.metadata.get("root_cause") is not None

    @pytest.mark.asyncio
    async def test_execute_returns_code_changes(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns actionable code changes."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Missing null check",
            "fix_suggestion": "Add null check before accessing property",
            "code_changes": [
                {
                    "file_path": "src/impl.py",
                    "original_code": "return obj.value",
                    "new_code": "return obj.value if obj else None",
                    "description": "Add null check",
                    "line_start": 10,
                    "line_end": 10,
                }
            ],
        }

        mock_backend.execute.return_value = _make_backend_result(analysis_response)

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_get_value - AttributeError: NoneType has no attribute 'value'",
                "implementation": "def get_value(obj):\n    return obj.value",
            },
        )

        assert result.success is True
        assert "code_changes" in result.metadata
        assert len(result.metadata["code_changes"]) >= 1


# ---------------------------------------------------------------------------
# Backend integration tests (replaces RLM integration tests)
# ---------------------------------------------------------------------------


class TestDebuggerAgentBackendIntegration:
    """Tests for DebuggerAgent backend integration."""

    @pytest.mark.asyncio
    async def test_execute_calls_backend_with_correct_config(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that backend.execute is called with proper BackendConfig."""
        from src.workers.agents.development.debugger_agent import (
            DEBUGGER_OUTPUT_SCHEMA,
            DEBUGGER_SYSTEM_PROMPT,
            DebuggerAgent,
        )

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error",
            "fix_suggestion": "Fix the logic",
            "code_changes": [],
        }

        mock_backend.execute.return_value = _make_backend_result(analysis_response)

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        mock_backend.execute.assert_called_once()
        call_kwargs = mock_backend.execute.call_args[1]
        backend_config = call_kwargs["config"]

        assert backend_config.model == config.debugger_model
        assert backend_config.output_schema == DEBUGGER_OUTPUT_SCHEMA
        assert backend_config.timeout_seconds == config.test_timeout_seconds
        assert backend_config.allowed_tools == ["Read", "Glob", "Grep"]
        assert backend_config.system_prompt == DEBUGGER_SYSTEM_PROMPT

    @pytest.mark.asyncio
    async def test_execute_reports_backend_name_in_metadata(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that metadata includes the backend name."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error",
            "fix_suggestion": "Fix the logic",
            "code_changes": [],
        }

        mock_backend.execute.return_value = _make_backend_result(analysis_response)

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is True
        assert result.metadata.get("backend") == "test-backend"

    @pytest.mark.asyncio
    async def test_execute_handles_backend_failure_gracefully(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles backend failure gracefully."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        mock_backend.execute.return_value = BackendResult(
            success=False,
            output="",
            error="Backend execution timed out",
        )

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is False
        assert result.should_retry is True
        assert "timed out" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_includes_cost_when_available(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that cost metadata is included when the backend reports it."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error",
            "fix_suggestion": "Fix the logic",
            "code_changes": [],
        }

        mock_backend.execute.return_value = _make_backend_result(
            analysis_response, cost_usd=0.05,
        )

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is True
        assert result.metadata.get("cost_usd") == 0.05


# ---------------------------------------------------------------------------
# Root cause analysis tests
# ---------------------------------------------------------------------------


class TestDebuggerAgentRootCauseAnalysis:
    """Tests for DebuggerAgent root cause analysis."""

    @pytest.mark.asyncio
    async def test_execute_identifies_root_cause(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute identifies root cause of failures."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Off-by-one error in loop condition",
            "fix_suggestion": "Change < to <= in loop condition",
            "code_changes": [
                {
                    "file_path": "src/impl.py",
                    "original_code": "for i in range(len(items)):",
                    "new_code": "for i in range(len(items) + 1):",
                    "description": "Fix off-by-one error",
                    "line_start": 5,
                    "line_end": 5,
                }
            ],
        }

        mock_backend.execute.return_value = _make_backend_result(analysis_response)

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_process_all - AssertionError: expected 5 items processed, got 4",
                "implementation": "def process_all(items):\n    for i in range(len(items)):\n        process(items[i])",
            },
        )

        assert result.success is True
        assert "off-by-one" in result.metadata.get("root_cause", "").lower()

    @pytest.mark.asyncio
    async def test_execute_uses_stack_trace_when_provided(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute includes stack trace in the prompt."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Division by zero when input is empty list",
            "fix_suggestion": "Add check for empty list before division",
            "code_changes": [],
        }

        mock_backend.execute.return_value = _make_backend_result(analysis_response)

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_average - ZeroDivisionError",
                "implementation": "def average(nums):\n    return sum(nums) / len(nums)",
                "stack_trace": """Traceback (most recent call last):
  File "test_impl.py", line 5, in test_average
    result = average([])
  File "impl.py", line 2, in average
    return sum(nums) / len(nums)
ZeroDivisionError: division by zero""",
            },
        )

        assert result.success is True
        # Verify the stack trace was included in the prompt sent to the backend
        call_kwargs = mock_backend.execute.call_args[1]
        prompt = call_kwargs["prompt"]
        assert "ZeroDivisionError" in prompt
        assert "Traceback" in prompt


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------


class TestDebuggerAgentValidation:
    """Tests for DebuggerAgent validation methods."""

    def test_validate_context_returns_true_for_valid_context(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that validate_context returns True for valid context."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(agent_context) is True

    def test_validate_context_returns_false_for_missing_session_id(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that validate_context returns False for missing session_id."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        context = AgentContext(
            session_id="",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp",
        )

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(context) is False

    def test_validate_context_returns_false_for_missing_task_id(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that validate_context returns False for missing task_id."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        context = AgentContext(
            session_id="test-session",
            task_id="",
            tenant_id="default",
            workspace_path="/tmp",
        )

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(context) is False


# ---------------------------------------------------------------------------
# Error handling tests
# ---------------------------------------------------------------------------


class TestDebuggerAgentErrorHandling:
    """Tests for DebuggerAgent error handling."""

    @pytest.mark.asyncio
    async def test_execute_handles_backend_exception(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles backend exceptions gracefully."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        mock_backend.execute.side_effect = Exception("Backend service unavailable")

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is False
        assert result.should_retry is True
        assert "Backend service unavailable" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_handles_invalid_json_response(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles invalid JSON response."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        mock_backend.execute.return_value = BackendResult(
            success=True,
            output="This is not valid JSON",
        )

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is False
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_handles_response_in_code_block(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles response wrapped in code block."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error",
            "fix_suggestion": "Fix the logic",
            "code_changes": [],
        }

        # Return output as text in code block (no structured_output)
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output=f"```json\n{json.dumps(analysis_response)}\n```",
        )

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is True


# ---------------------------------------------------------------------------
# Output format tests
# ---------------------------------------------------------------------------


class TestDebuggerAgentOutputFormats:
    """Tests for DebuggerAgent output formats."""

    @pytest.mark.asyncio
    async def test_writes_debug_analysis_as_json_artifact(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that debug analysis is written as JSON artifact."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error",
            "fix_suggestion": "Fix it",
            "code_changes": [],
        }

        mock_backend.execute.return_value = _make_backend_result(analysis_response)

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is True
        # Verify JSON artifact was written
        json_calls = [
            call
            for call in mock_artifact_writer.write_artifact.call_args_list
            if "json" in call[1].get("filename", "").lower()
        ]
        assert len(json_calls) >= 1

    @pytest.mark.asyncio
    async def test_writes_debug_analysis_as_markdown_artifact(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that debug analysis is written as markdown artifact."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error in calculation",
            "fix_suggestion": "Fix the calculation",
            "code_changes": [
                {
                    "file_path": "src/impl.py",
                    "original_code": "return x + y",
                    "new_code": "return x * y",
                    "description": "Change addition to multiplication",
                    "line_start": 5,
                    "line_end": 5,
                }
            ],
        }

        mock_backend.execute.return_value = _make_backend_result(analysis_response)

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_multiply - AssertionError: expected 20, got 9",
                "implementation": "def multiply(x, y):\n    return x + y",
            },
        )

        assert result.success is True
        # Verify markdown artifact was written
        md_calls = [
            call
            for call in mock_artifact_writer.write_artifact.call_args_list
            if call[1].get("filename", "").endswith(".md")
        ]
        assert len(md_calls) >= 1


# ---------------------------------------------------------------------------
# Context usage tests
# ---------------------------------------------------------------------------


class TestDebuggerAgentContextUsage:
    """Tests for DebuggerAgent context pack usage."""

    @pytest.mark.asyncio
    async def test_execute_uses_context_pack_when_provided(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that execute includes context pack hints in the prompt."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        context = AgentContext(
            session_id="test-session",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp/workspace",
            context_pack={
                "files": [
                    {
                        "path": "src/models/user.py",
                        "content": "class User:\n    def __init__(self, name): self.name = name",
                    }
                ],
                "interfaces": ["User"],
            },
        )

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "User model initialization issue",
            "fix_suggestion": "Fix User initialization",
            "code_changes": [],
        }

        mock_backend.execute.return_value = _make_backend_result(analysis_response)

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context,
            {
                "test_output": "FAILED test_user - TypeError",
                "implementation": "def create_user(): return User()",
            },
        )

        assert result.success is True
        # Verify context hints were included in the prompt
        call_kwargs = mock_backend.execute.call_args[1]
        prompt = call_kwargs["prompt"]
        assert "src/models/user.py" in prompt
        assert "User" in prompt


# ---------------------------------------------------------------------------
# Test context handling tests
# ---------------------------------------------------------------------------


class TestDebuggerAgentTestContextUsage:
    """Tests for DebuggerAgent test context handling."""

    @pytest.mark.asyncio
    async def test_execute_uses_test_code_when_provided(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute includes test code in the prompt."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Test expectation mismatch",
            "fix_suggestion": "Fix implementation to match test",
            "code_changes": [],
        }

        mock_backend.execute.return_value = _make_backend_result(analysis_response)

        agent = DebuggerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_add - AssertionError: expected 5, got 4",
                "implementation": "def add(a, b):\n    return a + b - 1",
                "test_code": """def test_add():
    assert add(2, 3) == 5
""",
            },
        )

        assert result.success is True
        # Verify test code was included in the prompt
        call_kwargs = mock_backend.execute.call_args[1]
        prompt = call_kwargs["prompt"]
        assert "test_add" in prompt
        assert "add(2, 3)" in prompt


# ---------------------------------------------------------------------------
# Module-level function tests
# ---------------------------------------------------------------------------


class TestBuildDebugPrompt:
    """Tests for _build_debug_prompt module-level function."""

    def test_basic_prompt_includes_test_output_and_implementation(self) -> None:
        """Test that the basic prompt includes required sections."""
        from src.workers.agents.development.debugger_agent import _build_debug_prompt

        prompt = _build_debug_prompt(
            test_output="FAILED test_x",
            implementation="def x(): pass",
        )

        assert "## Test Output" in prompt
        assert "FAILED test_x" in prompt
        assert "## Implementation Being Tested" in prompt
        assert "def x(): pass" in prompt
        assert "## Required Output Format" in prompt

    def test_prompt_includes_stack_trace_when_provided(self) -> None:
        """Test that stack trace section is added when provided."""
        from src.workers.agents.development.debugger_agent import _build_debug_prompt

        prompt = _build_debug_prompt(
            test_output="FAILED",
            implementation="pass",
            stack_trace="Traceback: line 5",
        )

        assert "## Stack Trace" in prompt
        assert "Traceback: line 5" in prompt

    def test_prompt_includes_test_code_when_provided(self) -> None:
        """Test that test code section is added when provided."""
        from src.workers.agents.development.debugger_agent import _build_debug_prompt

        prompt = _build_debug_prompt(
            test_output="FAILED",
            implementation="pass",
            test_code="def test_foo(): assert True",
        )

        assert "## Test Code" in prompt
        assert "def test_foo()" in prompt

    def test_prompt_includes_context_hints_when_provided(self) -> None:
        """Test that context hints section is added when provided."""
        from src.workers.agents.development.debugger_agent import _build_debug_prompt

        prompt = _build_debug_prompt(
            test_output="FAILED",
            implementation="pass",
            context_hints=["Related file: src/foo.py", "Relevant interfaces: Bar"],
        )

        assert "## Context Hints" in prompt
        assert "- Related file: src/foo.py" in prompt
        assert "- Relevant interfaces: Bar" in prompt

    def test_prompt_omits_optional_sections_when_none(self) -> None:
        """Test that optional sections are omitted when not provided."""
        from src.workers.agents.development.debugger_agent import _build_debug_prompt

        prompt = _build_debug_prompt(
            test_output="FAILED",
            implementation="pass",
        )

        assert "## Stack Trace" not in prompt
        assert "## Test Code" not in prompt
        assert "## Context Hints" not in prompt


class TestParseDebugFromResult:
    """Tests for _parse_debug_from_result module-level function."""

    def test_parses_structured_output(self) -> None:
        """Test parsing from structured_output field."""
        from src.workers.agents.development.debugger_agent import (
            _parse_debug_from_result,
        )

        result = BackendResult(
            success=True,
            output="",
            structured_output={
                "failure_id": "f-001",
                "root_cause": "bad logic",
                "fix_suggestion": "fix it",
                "code_changes": [
                    {
                        "file_path": "a.py",
                        "new_code": "x = 1",
                        "description": "set x",
                    }
                ],
            },
        )

        analysis = _parse_debug_from_result(result, task_id="t1")

        assert analysis is not None
        assert analysis.failure_id == "f-001"
        assert analysis.root_cause == "bad logic"
        assert len(analysis.code_changes) == 1

    def test_falls_back_to_text_output_parsing(self) -> None:
        """Test falling back to parsing JSON from text output."""
        from src.workers.agents.development.debugger_agent import (
            _parse_debug_from_result,
        )

        data = {
            "root_cause": "missing return",
            "fix_suggestion": "add return",
            "code_changes": [],
        }

        result = BackendResult(
            success=True,
            output=json.dumps(data),
        )

        analysis = _parse_debug_from_result(result, task_id="t2")

        assert analysis is not None
        assert analysis.root_cause == "missing return"
        assert analysis.failure_id == "t2-failure"  # fallback

    def test_returns_none_for_unparseable_output(self) -> None:
        """Test that None is returned when output cannot be parsed."""
        from src.workers.agents.development.debugger_agent import (
            _parse_debug_from_result,
        )

        result = BackendResult(
            success=True,
            output="totally not json",
        )

        analysis = _parse_debug_from_result(result, task_id="t3")

        assert analysis is None


class TestDebuggerOutputSchema:
    """Tests for DEBUGGER_OUTPUT_SCHEMA constant."""

    def test_schema_requires_root_cause(self) -> None:
        """Test that schema requires root_cause field."""
        from src.workers.agents.development.debugger_agent import (
            DEBUGGER_OUTPUT_SCHEMA,
        )

        assert "root_cause" in DEBUGGER_OUTPUT_SCHEMA["required"]

    def test_schema_requires_fix_suggestion(self) -> None:
        """Test that schema requires fix_suggestion field."""
        from src.workers.agents.development.debugger_agent import (
            DEBUGGER_OUTPUT_SCHEMA,
        )

        assert "fix_suggestion" in DEBUGGER_OUTPUT_SCHEMA["required"]

    def test_schema_requires_code_changes(self) -> None:
        """Test that schema requires code_changes field."""
        from src.workers.agents.development.debugger_agent import (
            DEBUGGER_OUTPUT_SCHEMA,
        )

        assert "code_changes" in DEBUGGER_OUTPUT_SCHEMA["required"]

    def test_code_change_items_require_file_path(self) -> None:
        """Test that code_change items require file_path."""
        from src.workers.agents.development.debugger_agent import (
            DEBUGGER_OUTPUT_SCHEMA,
        )

        items_schema = DEBUGGER_OUTPUT_SCHEMA["properties"]["code_changes"]["items"]
        assert "file_path" in items_schema["required"]

    def test_code_change_items_require_new_code(self) -> None:
        """Test that code_change items require new_code."""
        from src.workers.agents.development.debugger_agent import (
            DEBUGGER_OUTPUT_SCHEMA,
        )

        items_schema = DEBUGGER_OUTPUT_SCHEMA["properties"]["code_changes"]["items"]
        assert "new_code" in items_schema["required"]
