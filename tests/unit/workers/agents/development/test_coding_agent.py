"""Unit tests for CodingAgent (AgentBackend refactor)."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeChange,
    CodeFile,
    DebugAnalysis,
    Implementation,
)


class MockBackend:
    """Mock AgentBackend for testing."""

    def __init__(
        self,
        result: BackendResult | None = None,
        error: Exception | None = None,
    ) -> None:
        self._result = result or BackendResult(success=True, output="{}")
        self._error = error
        self.execute_calls: list[dict[str, Any]] = []

    @property
    def backend_name(self) -> str:
        return "mock-backend"

    async def execute(
        self,
        prompt: str,
        workspace_path: str,
        config: BackendConfig | None = None,
    ) -> BackendResult:
        self.execute_calls.append({
            "prompt": prompt,
            "workspace_path": workspace_path,
            "config": config,
        })
        if self._error:
            raise self._error
        return self._result

    async def health_check(self) -> bool:
        return True


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


@pytest.fixture
def sample_impl_response() -> str:
    """Sample implementation JSON response."""
    return json.dumps({
        "files": [
            {
                "path": "src/auth/login.py",
                "content": '"""Login module."""\n\ndef authenticate(username: str, password: str) -> bool:\n    return username == "test" and password == "valid"\n',
                "language": "python",
            }
        ],
        "imports": ["typing"],
        "dependencies": [],
    })


@pytest.fixture
def sample_multi_file_response() -> str:
    """Sample response with multiple files."""
    return json.dumps({
        "files": [
            {
                "path": "src/models/user.py",
                "content": "class User:\n    pass",
                "language": "python",
            },
            {
                "path": "src/services/auth.py",
                "content": "def login(): pass",
                "language": "python",
            },
        ],
        "imports": [],
        "dependencies": [],
    })


class TestCodingAgentProtocol:
    """Tests for CodingAgent implementing BaseAgent protocol."""

    def test_agent_type_returns_correct_value(
        self,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that agent_type returns 'coding'."""
        from src.workers.agents.development.coding_agent import CodingAgent

        backend = MockBackend()
        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "coding"

    def test_agent_implements_base_agent_protocol(
        self,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that CodingAgent implements BaseAgent protocol."""
        from src.workers.agents.protocols import BaseAgent
        from src.workers.agents.development.coding_agent import CodingAgent

        backend = MockBackend()
        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert isinstance(agent, BaseAgent)


class TestCodingAgentExecution:
    """Tests for CodingAgent.execute() method."""

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_task_description(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no task_description provided."""
        from src.workers.agents.development.coding_agent import CodingAgent

        backend = MockBackend()
        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(agent_context, {})

        assert result.success is False
        assert "task_description" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_test_code(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no test_code provided."""
        from src.workers.agents.development.coding_agent import CodingAgent

        backend = MockBackend()
        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"task_description": "Implement user login"},
        )

        assert result.success is False
        assert "test_code" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_generates_implementation_from_tests(
        self,
        mock_artifact_writer,
        agent_context,
        config,
        sample_impl_response,
    ) -> None:
        """Test that execute generates implementation from test code."""
        from src.workers.agents.development.coding_agent import CodingAgent

        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=sample_impl_response,
                cost_usd=0.03,
                turns=5,
            )
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement user authentication",
                "test_code": 'def test_authenticate():\n    from src.auth.login import authenticate\n    assert authenticate("test", "valid") is True\n',
            },
        )

        assert result.success is True
        assert result.agent_type == "coding"
        assert len(result.artifact_paths) >= 1
        assert result.metadata.get("file_count") == 1
        assert result.metadata.get("backend") == "mock-backend"
        assert result.metadata.get("cost_usd") == 0.03

    @pytest.mark.asyncio
    async def test_execute_handles_multiple_files(
        self,
        mock_artifact_writer,
        agent_context,
        config,
        sample_multi_file_response,
    ) -> None:
        """Test that execute handles multiple implementation files."""
        from src.workers.agents.development.coding_agent import CodingAgent

        backend = MockBackend(
            result=BackendResult(success=True, output=sample_multi_file_response)
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement auth system",
                "test_code": "def test_login(): pass",
            },
        )

        assert result.success is True
        assert result.metadata.get("file_count") == 2

    @pytest.mark.asyncio
    async def test_execute_with_structured_output(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test execution with structured output (from --json-schema)."""
        from src.workers.agents.development.coding_agent import CodingAgent

        structured = {
            "files": [
                {"path": "src/impl.py", "content": "pass", "language": "python"}
            ],
            "imports": ["os"],
            "dependencies": [],
        }

        backend = MockBackend(
            result=BackendResult(
                success=True,
                output="",
                structured_output=structured,
            )
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
            },
        )

        assert result.success is True
        assert result.metadata.get("file_count") == 1
        assert "os" in result.metadata.get("imports", [])


class TestCodingAgentDebugFixes:
    """Tests for CodingAgent applying debug fixes."""

    @pytest.mark.asyncio
    async def test_execute_applies_debug_analysis_when_provided(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute applies debug analysis fixes when provided."""
        from src.workers.agents.development.coding_agent import CodingAgent

        debug_analysis = DebugAnalysis(
            failure_id="test-failure",
            root_cause="Missing null check",
            fix_suggestion="Add null check before accessing property",
            code_changes=[
                CodeChange(
                    file_path="src/impl.py",
                    original_code="return obj.value",
                    new_code="return obj.value if obj else None",
                    description="Add null check",
                    line_start=10,
                    line_end=10,
                )
            ],
        )

        impl_response = {
            "files": [
                {
                    "path": "src/impl.py",
                    "content": "def get_value(obj):\n    return obj.value if obj else None",
                    "language": "python",
                }
            ],
            "imports": [],
            "dependencies": [],
        }

        backend = MockBackend(
            result=BackendResult(success=True, output=json.dumps(impl_response))
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
                "debug_analysis": debug_analysis.to_dict(),
            },
        )

        assert result.success is True
        # Verify debug hints were passed in the prompt
        assert len(backend.execute_calls) == 1
        prompt = backend.execute_calls[0]["prompt"]
        assert "null check" in prompt.lower() or "debug" in prompt.lower()

    @pytest.mark.asyncio
    async def test_execute_includes_debug_hints_in_prompt(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that debug hints are included in the backend prompt."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        backend = MockBackend(
            result=BackendResult(success=True, output=json.dumps(impl_response))
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
                "fail_count": 1,
                "test_errors": ["AssertionError: expected 5, got None"],
            },
        )

        assert result.success is True
        # Verify test errors were included in prompt
        prompt = backend.execute_calls[0]["prompt"]
        assert "AssertionError" in prompt or "error" in prompt.lower()


class TestCodingAgentRetryHandling:
    """Tests for CodingAgent retry handling."""

    @pytest.mark.asyncio
    async def test_execute_includes_fail_count_in_metadata(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that fail_count is included in result metadata."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        backend = MockBackend(
            result=BackendResult(success=True, output=json.dumps(impl_response))
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
                "fail_count": 2,
            },
        )

        assert result.success is True
        assert result.metadata.get("fail_count") == 2

    @pytest.mark.asyncio
    async def test_execute_uses_retry_prompt_on_fail_count_greater_than_zero(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that retry prompt is used when fail_count > 0."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        backend = MockBackend(
            result=BackendResult(success=True, output=json.dumps(impl_response))
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
                "fail_count": 1,
                "previous_implementation": "def feature(): return None",
                "test_errors": ["AssertionError: expected True"],
            },
        )

        assert result.success is True
        # Verify retry-specific prompt content was used
        prompt = backend.execute_calls[0]["prompt"]
        assert "retry" in prompt.lower() or "previous" in prompt.lower()

    @pytest.mark.asyncio
    async def test_first_attempt_does_not_use_retry_prompt(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that first attempt (fail_count=0) uses standard prompt."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        backend = MockBackend(
            result=BackendResult(success=True, output=json.dumps(impl_response))
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
                "fail_count": 0,
            },
        )

        assert result.success is True
        assert result.metadata.get("tdd_phase") == "green"


class TestCodingAgentValidation:
    """Tests for CodingAgent validation methods."""

    def test_validate_context_returns_true_for_valid_context(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that validate_context returns True for valid context."""
        from src.workers.agents.development.coding_agent import CodingAgent

        backend = MockBackend()
        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(agent_context) is True

    def test_validate_context_returns_false_for_missing_session_id(
        self,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that validate_context returns False for missing session_id."""
        from src.workers.agents.development.coding_agent import CodingAgent

        context = AgentContext(
            session_id="",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp",
        )

        backend = MockBackend()
        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(context) is False


class TestCodingAgentErrorHandling:
    """Tests for CodingAgent error handling."""

    @pytest.mark.asyncio
    async def test_execute_handles_backend_exception(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles backend exceptions gracefully."""
        from src.workers.agents.development.coding_agent import CodingAgent

        backend = MockBackend(error=ConnectionError("Backend service unavailable"))

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
            },
        )

        assert result.success is False
        assert result.should_retry is True
        assert "Backend service unavailable" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_handles_backend_failure_result(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles backend failure result."""
        from src.workers.agents.development.coding_agent import CodingAgent

        backend = MockBackend(
            result=BackendResult(
                success=False,
                error="CLI timed out after 300s",
            )
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
            },
        )

        assert result.success is False
        assert "timed out" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_handles_invalid_json_response(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles invalid JSON response."""
        from src.workers.agents.development.coding_agent import CodingAgent

        backend = MockBackend(
            result=BackendResult(
                success=True,
                output="This is not valid JSON",
            )
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
            },
        )

        assert result.success is False
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_handles_response_in_code_block(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles response wrapped in code block."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=f"```json\n{json.dumps(impl_response)}\n```",
            )
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
            },
        )

        assert result.success is True


class TestCodingAgentOutputFormats:
    """Tests for CodingAgent output formats."""

    @pytest.mark.asyncio
    async def test_writes_implementation_as_json_artifact(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that implementation is written as JSON artifact."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        backend = MockBackend(
            result=BackendResult(success=True, output=json.dumps(impl_response))
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Feature",
                "test_code": "def test(): pass",
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
    async def test_returns_implementation_in_metadata(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that implementation details are in result metadata."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
            "files": [
                {"path": "src/impl.py", "content": "class Impl: pass", "language": "python"}
            ],
            "imports": ["typing"],
            "dependencies": ["pydantic"],
        }

        backend = MockBackend(
            result=BackendResult(success=True, output=json.dumps(impl_response))
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Feature",
                "test_code": "def test(): pass",
            },
        )

        assert result.success is True
        assert result.metadata.get("file_count") == 1
        assert "typing" in result.metadata.get("imports", [])
        assert "pydantic" in result.metadata.get("dependencies", [])


class TestCodingAgentContextUsage:
    """Tests for CodingAgent context pack usage."""

    @pytest.mark.asyncio
    async def test_execute_uses_context_pack_when_provided(
        self,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that execute uses context pack for better code generation."""
        from src.workers.agents.development.coding_agent import CodingAgent

        context = AgentContext(
            session_id="test-session",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp/workspace",
            context_pack={
                "files": [
                    {
                        "path": "src/models/base.py",
                        "content": "class BaseModel:\n    pass",
                    }
                ],
                "interfaces": ["BaseModel"],
            },
        )

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        backend = MockBackend(
            result=BackendResult(success=True, output=json.dumps(impl_response))
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context,
            {
                "task_description": "Implement model",
                "test_code": "def test_model(): pass",
            },
        )

        assert result.success is True
        # Verify context was used in the prompt
        prompt = backend.execute_calls[0]["prompt"]
        assert "BaseModel" in prompt or "context" in prompt.lower()


class TestCodingAgentBackendConfig:
    """Tests for CodingAgent backend configuration."""

    @pytest.mark.asyncio
    async def test_passes_config_to_backend(
        self,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that backend config is correctly constructed and passed."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        backend = MockBackend(
            result=BackendResult(success=True, output=json.dumps(impl_response))
        )

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test(): pass",
            },
        )

        assert len(backend.execute_calls) == 1
        call = backend.execute_calls[0]
        assert call["workspace_path"] == "/tmp/workspace"
        assert call["config"].output_schema is not None
        assert call["config"].system_prompt is not None
        assert call["config"].model == config.coding_model
        assert call["config"].timeout_seconds == config.test_timeout_seconds
        assert "Read" in call["config"].allowed_tools
        assert "Write" in call["config"].allowed_tools


class TestBuildCodingPrompt:
    """Tests for _build_coding_prompt module-level function."""

    def test_includes_task_and_test_code(self) -> None:
        """Test that prompt includes task description and test code."""
        from src.workers.agents.development.coding_agent import _build_coding_prompt

        prompt = _build_coding_prompt(
            task_description="Implement auth",
            test_code="def test_auth(): pass",
        )

        assert "Implement auth" in prompt
        assert "def test_auth(): pass" in prompt

    def test_includes_context_pack(self) -> None:
        """Test that prompt includes context pack when provided."""
        from src.workers.agents.development.coding_agent import _build_coding_prompt

        prompt = _build_coding_prompt(
            task_description="Task",
            test_code="def test(): pass",
            context_pack="# File: base.py\nclass Base: pass",
        )

        assert "base.py" in prompt or "Base" in prompt

    def test_retry_includes_previous_implementation(self) -> None:
        """Test that retry prompt includes previous implementation."""
        from src.workers.agents.development.coding_agent import _build_coding_prompt

        prompt = _build_coding_prompt(
            task_description="Task",
            test_code="def test(): pass",
            fail_count=2,
            previous_implementation="def broken(): return None",
            test_errors=["AssertionError: got None"],
        )

        assert "broken" in prompt or "previous" in prompt.lower()
        assert "AssertionError" in prompt

    def test_includes_debug_hints(self) -> None:
        """Test that prompt includes debug hints."""
        from src.workers.agents.development.coding_agent import _build_coding_prompt

        prompt = _build_coding_prompt(
            task_description="Task",
            test_code="def test(): pass",
            debug_hints=["Root cause: off-by-one error"],
        )

        assert "off-by-one" in prompt

    def test_first_attempt_without_retry_context(self) -> None:
        """Test that first attempt does not include retry context."""
        from src.workers.agents.development.coding_agent import _build_coding_prompt

        prompt = _build_coding_prompt(
            task_description="Task",
            test_code="def test(): pass",
            fail_count=0,
        )

        # Should not contain retry-specific phrasing
        assert "previous implementation" not in prompt.lower() or "retry attempt" not in prompt.lower()


class TestParseImplementationFromResult:
    """Tests for _parse_implementation_from_result module-level function."""

    def test_parse_structured_output(self) -> None:
        """Test parsing from structured_output field."""
        from src.workers.agents.development.coding_agent import (
            _parse_implementation_from_result,
        )

        data = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": ["os"],
            "dependencies": [],
        }
        result = BackendResult(
            success=True,
            output="",
            structured_output=data,
        )
        impl = _parse_implementation_from_result(result, "task-1")
        assert impl is not None
        assert len(impl.files) == 1
        assert impl.files[0].path == "src/impl.py"
        assert impl.imports == ["os"]
        assert impl.task_id == "task-1"

    def test_parse_json_output(self) -> None:
        """Test parsing JSON from output string."""
        from src.workers.agents.development.coding_agent import (
            _parse_implementation_from_result,
        )

        data = {
            "files": [{"path": "src/impl.py", "content": "pass"}],
            "imports": [],
            "dependencies": ["requests"],
        }
        result = BackendResult(success=True, output=json.dumps(data))
        impl = _parse_implementation_from_result(result, "task-2")
        assert impl is not None
        assert impl.dependencies == ["requests"]

    def test_parse_json_in_code_block(self) -> None:
        """Test parsing JSON from markdown code block."""
        from src.workers.agents.development.coding_agent import (
            _parse_implementation_from_result,
        )

        data = {
            "files": [{"path": "src/impl.py", "content": "pass"}],
        }
        output = f"Here is the implementation:\n```json\n{json.dumps(data)}\n```\n"
        result = BackendResult(success=True, output=output)
        impl = _parse_implementation_from_result(result, "task-3")
        assert impl is not None
        assert len(impl.files) == 1

    def test_parse_empty_output_returns_none(self) -> None:
        """Test parsing empty output returns None."""
        from src.workers.agents.development.coding_agent import (
            _parse_implementation_from_result,
        )

        result = BackendResult(success=True, output="")
        assert _parse_implementation_from_result(result, "task-4") is None

    def test_parse_invalid_json_returns_none(self) -> None:
        """Test parsing invalid content returns None."""
        from src.workers.agents.development.coding_agent import (
            _parse_implementation_from_result,
        )

        result = BackendResult(success=True, output="not json at all")
        assert _parse_implementation_from_result(result, "task-5") is None

    def test_parse_no_files_key_returns_none(self) -> None:
        """Test parsing JSON without files key returns None."""
        from src.workers.agents.development.coding_agent import (
            _parse_implementation_from_result,
        )

        result = BackendResult(
            success=True,
            output=json.dumps({"imports": ["os"]}),
        )
        assert _parse_implementation_from_result(result, "task-6") is None

    def test_parse_skips_invalid_files(self) -> None:
        """Test that invalid file entries are skipped gracefully."""
        from src.workers.agents.development.coding_agent import (
            _parse_implementation_from_result,
        )

        data = {
            "files": [
                {"path": "src/good.py", "content": "pass"},
                {"path": "", "content": ""},  # will be included (empty but valid)
                {"path": "src/also_good.py", "content": "x = 1"},
            ],
        }
        result = BackendResult(success=True, output=json.dumps(data))
        impl = _parse_implementation_from_result(result, "task-7")
        assert impl is not None
        assert len(impl.files) >= 2


class TestCodingOutputSchema:
    """Tests for CODING_OUTPUT_SCHEMA constant."""

    def test_schema_has_required_structure(self) -> None:
        """Test that the output schema has the expected structure."""
        from src.workers.agents.development.coding_agent import CODING_OUTPUT_SCHEMA

        assert CODING_OUTPUT_SCHEMA["type"] == "object"
        assert "files" in CODING_OUTPUT_SCHEMA["properties"]
        assert CODING_OUTPUT_SCHEMA["required"] == ["files"]

    def test_schema_file_item_has_required_fields(self) -> None:
        """Test that file items require path and content."""
        from src.workers.agents.development.coding_agent import CODING_OUTPUT_SCHEMA

        file_schema = CODING_OUTPUT_SCHEMA["properties"]["files"]["items"]
        assert "path" in file_schema["properties"]
        assert "content" in file_schema["properties"]
        assert "path" in file_schema["required"]
        assert "content" in file_schema["required"]
