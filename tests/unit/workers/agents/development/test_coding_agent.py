"""Unit tests for CodingAgent."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeChange,
    CodeFile,
    DebugAnalysis,
    Implementation,
)
from src.workers.llm.client import LLMResponse


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client."""
    client = MagicMock()
    client.generate = AsyncMock()
    client.model_name = "test-model"
    client.count_tokens = AsyncMock(return_value=1000)
    return client


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
def mock_rlm_integration():
    """Create a mock RLM integration."""
    from src.workers.rlm.integration import RLMIntegrationResult

    rlm = MagicMock()
    rlm.should_use_rlm = MagicMock(return_value=MagicMock(should_trigger=False))
    rlm.explore = AsyncMock(return_value=RLMIntegrationResult(
        used_rlm=True,
        trigger_result=None,
        rlm_result=None,
        formatted_output="## RLM Exploration\nFound relevant patterns.",
    ))
    rlm.process_with_rlm_check = AsyncMock(return_value=RLMIntegrationResult(
        used_rlm=False,
        trigger_result=MagicMock(should_trigger=False),
        rlm_result=None,
        formatted_output="",
    ))
    return rlm


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


class TestCodingAgentProtocol:
    """Tests for CodingAgent implementing BaseAgent protocol."""

    def test_agent_type_returns_correct_value(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that agent_type returns 'coding'."""
        from src.workers.agents.development.coding_agent import CodingAgent

        agent = CodingAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "coding"

    def test_agent_implements_base_agent_protocol(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that CodingAgent implements BaseAgent protocol."""
        from src.workers.agents.protocols import BaseAgent
        from src.workers.agents.development.coding_agent import CodingAgent

        agent = CodingAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert isinstance(agent, BaseAgent)


class TestCodingAgentExecution:
    """Tests for CodingAgent.execute() method."""

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_task_description(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no task_description provided."""
        from src.workers.agents.development.coding_agent import CodingAgent

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no test_code provided."""
        from src.workers.agents.development.coding_agent import CodingAgent

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute generates implementation from test code."""
        from src.workers.agents.development.coding_agent import CodingAgent

        # Mock LLM response with implementation
        impl_response = {
            "files": [
                {
                    "path": "src/auth/login.py",
                    "content": '''"""Login module."""

def authenticate(username: str, password: str) -> bool:
    """Authenticate a user.

    Args:
        username: User's username.
        password: User's password.

    Returns:
        bool: True if authenticated successfully.
    """
    return username == "test" and password == "valid"
''',
                    "language": "python",
                }
            ],
            "imports": ["typing"],
            "dependencies": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement user authentication",
                "test_code": """def test_authenticate():
    from src.auth.login import authenticate
    assert authenticate("test", "valid") is True
""",
            },
        )

        assert result.success is True
        assert result.agent_type == "coding"
        assert len(result.artifact_paths) >= 1
        assert result.metadata.get("file_count") == 1

    @pytest.mark.asyncio
    async def test_execute_handles_multiple_files(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles multiple implementation files."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
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
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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


class TestCodingAgentRLMIntegration:
    """Tests for CodingAgent RLM integration."""

    @pytest.mark.asyncio
    async def test_execute_uses_standard_llm_on_first_attempt(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that first attempt (fail_count=0) uses standard LLM."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        assert result.metadata.get("used_rlm") is False

    @pytest.mark.asyncio
    async def test_execute_uses_rlm_on_retry_when_enabled(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that retry attempts (fail_count>0) use RLM when enabled."""
        from src.workers.agents.development.coding_agent import CodingAgent
        from src.workers.rlm.integration import RLMIntegrationResult

        # Configure RLM to trigger on retry
        mock_rlm_integration.should_use_rlm.return_value = MagicMock(should_trigger=True)
        mock_rlm_integration.explore.return_value = RLMIntegrationResult(
            used_rlm=True,
            trigger_result=None,
            rlm_result=None,
            formatted_output="## RLM Analysis\nFound patterns for implementation.",
        )

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
                "fail_count": 2,  # Retry attempt
            },
        )

        assert result.success is True
        assert result.metadata.get("used_rlm") is True
        mock_rlm_integration.should_use_rlm.assert_called()

    @pytest.mark.asyncio
    async def test_execute_does_not_use_rlm_when_disabled(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
    ) -> None:
        """Test that RLM is not used when disabled in config."""
        from src.workers.agents.development.coding_agent import CodingAgent

        config = DevelopmentConfig(enable_rlm=False)

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "test_code": "def test_feature(): pass",
                "fail_count": 3,
            },
        )

        assert result.success is True
        # RLM should not be used even on retry
        assert result.metadata.get("used_rlm") is False


class TestCodingAgentDebugFixes:
    """Tests for CodingAgent applying debug fixes."""

    @pytest.mark.asyncio
    async def test_execute_applies_debug_analysis_when_provided(
        self,
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        # Verify debug hints were passed to LLM
        call_kwargs = mock_llm_client.generate.call_args[1]
        prompt = call_kwargs.get("prompt", "")
        assert "null check" in prompt.lower() or "debug" in prompt.lower()

    @pytest.mark.asyncio
    async def test_execute_includes_debug_hints_in_prompt(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that debug hints are included in the LLM prompt."""
        from src.workers.agents.development.coding_agent import CodingAgent

        impl_response = {
            "files": [{"path": "src/impl.py", "content": "pass", "language": "python"}],
            "imports": [],
            "dependencies": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        call_kwargs = mock_llm_client.generate.call_args[1]
        prompt = call_kwargs.get("prompt", "")
        assert "AssertionError" in prompt or "error" in prompt.lower()


class TestCodingAgentRetryHandling:
    """Tests for CodingAgent retry handling."""

    @pytest.mark.asyncio
    async def test_execute_includes_fail_count_in_metadata(
        self,
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        # Verify retry-specific prompt was used
        call_kwargs = mock_llm_client.generate.call_args[1]
        prompt = call_kwargs.get("prompt", "")
        assert "retry" in prompt.lower() or "previous" in prompt.lower()


class TestCodingAgentValidation:
    """Tests for CodingAgent validation methods."""

    def test_validate_context_returns_true_for_valid_context(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that validate_context returns True for valid context."""
        from src.workers.agents.development.coding_agent import CodingAgent

        agent = CodingAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(agent_context) is True

    def test_validate_context_returns_false_for_missing_session_id(
        self,
        mock_llm_client,
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

        agent = CodingAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(context) is False


class TestCodingAgentErrorHandling:
    """Tests for CodingAgent error handling."""

    @pytest.mark.asyncio
    async def test_execute_handles_llm_exception(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles LLM exceptions gracefully."""
        from src.workers.agents.development.coding_agent import CodingAgent

        mock_llm_client.generate.side_effect = Exception("LLM service unavailable")

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        assert "LLM service unavailable" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_handles_invalid_json_response(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles invalid JSON response."""
        from src.workers.agents.development.coding_agent import CodingAgent

        mock_llm_client.generate.return_value = LLMResponse(
            content="This is not valid JSON",
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=f"```json\n{json.dumps(impl_response)}\n```",
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(impl_response),
            model="test-model",
        )

        agent = CodingAgent(
            llm_client=mock_llm_client,
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
        call_kwargs = mock_llm_client.generate.call_args[1]
        prompt = call_kwargs.get("prompt", "")
        assert "BaseModel" in prompt or "context" in prompt.lower()
