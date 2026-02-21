"""Unit tests for UTestAgent (AgentBackend-based)."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import TestCase, TestSuite, TestType
from src.workers.agents.development.utest_agent import (
    UTestAgent,
    UTEST_OUTPUT_SCHEMA,
    _build_utest_prompt,
    _parse_test_suite_from_result,
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
def mock_artifact_writer(tmp_path) -> MagicMock:
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
def agent_context() -> AgentContext:
    """Create a test agent context."""
    return AgentContext(
        session_id="test-session",
        task_id="test-task",
        tenant_id="default",
        workspace_path="/tmp/workspace",
    )


@pytest.fixture
def config() -> DevelopmentConfig:
    """Create test configuration."""
    return DevelopmentConfig()


@pytest.fixture
def sample_test_response() -> dict[str, Any]:
    """Sample successful test generation response."""
    return {
        "test_cases": [
            {
                "id": "TC-001",
                "name": "test_should_authenticate_valid_user",
                "description": "Test that valid credentials authenticate successfully",
                "test_type": "unit",
                "code": (
                    'def test_should_authenticate_valid_user():\n'
                    '    """Test that valid credentials authenticate successfully."""\n'
                    '    # Arrange\n'
                    '    user = User(username="test", password="valid")\n'
                    '    # Act\n'
                    '    result = authenticate(user)\n'
                    '    # Assert\n'
                    '    assert result.success is True'
                ),
                "requirement_ref": "AC-001",
            }
        ],
        "setup_code": "import pytest\nfrom myapp.auth import authenticate, User",
        "fixtures": ["db_session"],
    }


class TestUTestOutputSchema:
    """Tests for the UTEST_OUTPUT_SCHEMA constant."""

    def test_schema_is_a_dict(self) -> None:
        """Test that the schema is a dict."""
        assert isinstance(UTEST_OUTPUT_SCHEMA, dict)

    def test_schema_requires_test_cases(self) -> None:
        """Test that the schema requires test_cases."""
        assert "test_cases" in UTEST_OUTPUT_SCHEMA.get("required", [])

    def test_schema_defines_test_case_properties(self) -> None:
        """Test that test_cases items have required properties."""
        items = (
            UTEST_OUTPUT_SCHEMA["properties"]["test_cases"]["items"]
        )
        assert "id" in items["properties"]
        assert "name" in items["properties"]
        assert "code" in items["properties"]
        assert items["required"] == ["id", "name", "code"]

    def test_schema_test_type_enum(self) -> None:
        """Test that test_type has enum constraint."""
        items = (
            UTEST_OUTPUT_SCHEMA["properties"]["test_cases"]["items"]
        )
        assert items["properties"]["test_type"]["enum"] == [
            "unit", "integration", "e2e",
        ]


class TestBuildUtestPrompt:
    """Tests for the _build_utest_prompt helper."""

    def test_includes_task_description(self) -> None:
        """Test that the prompt contains the task description."""
        prompt = _build_utest_prompt(
            task_description="Implement user login",
            acceptance_criteria=["User can log in"],
            existing_context=None,
        )
        assert "Implement user login" in prompt

    def test_includes_acceptance_criteria(self) -> None:
        """Test that the prompt contains acceptance criteria."""
        prompt = _build_utest_prompt(
            task_description="Task",
            acceptance_criteria=["AC one", "AC two"],
            existing_context=None,
        )
        assert "AC one" in prompt
        assert "AC two" in prompt

    def test_includes_context_when_provided(self) -> None:
        """Test that context is included when provided."""
        prompt = _build_utest_prompt(
            task_description="Task",
            acceptance_criteria=["AC"],
            existing_context="class User:\n    pass",
        )
        assert "class User:" in prompt

    def test_includes_json_output_instructions(self) -> None:
        """Test that JSON output format instructions are appended."""
        prompt = _build_utest_prompt(
            task_description="Task",
            acceptance_criteria=["AC"],
            existing_context=None,
        )
        assert "test_cases" in prompt
        assert "requirement_ref" in prompt


class TestParseTestSuiteFromResult:
    """Tests for the _parse_test_suite_from_result helper."""

    def test_parses_structured_output(
        self,
        sample_test_response: dict[str, Any],
    ) -> None:
        """Test parsing from structured_output field."""
        result = BackendResult(
            success=True,
            output="",
            structured_output=sample_test_response,
        )
        parsed = _parse_test_suite_from_result(result)
        assert parsed is not None
        assert "test_cases" in parsed

    def test_parses_json_output(
        self,
        sample_test_response: dict[str, Any],
    ) -> None:
        """Test parsing JSON from output string."""
        result = BackendResult(
            success=True,
            output=json.dumps(sample_test_response),
        )
        parsed = _parse_test_suite_from_result(result)
        assert parsed is not None
        assert "test_cases" in parsed

    def test_parses_json_in_code_block(
        self,
        sample_test_response: dict[str, Any],
    ) -> None:
        """Test parsing JSON from a markdown code block."""
        output = f"Here are the tests:\n```json\n{json.dumps(sample_test_response)}\n```\n"
        result = BackendResult(success=True, output=output)
        parsed = _parse_test_suite_from_result(result)
        assert parsed is not None
        assert "test_cases" in parsed

    def test_returns_none_for_empty_output(self) -> None:
        """Test that empty output returns None."""
        result = BackendResult(success=True, output="")
        assert _parse_test_suite_from_result(result) is None

    def test_returns_none_for_invalid_content(self) -> None:
        """Test that invalid content returns None."""
        result = BackendResult(success=True, output="not json at all")
        assert _parse_test_suite_from_result(result) is None

    def test_returns_none_when_test_cases_missing(self) -> None:
        """Test that result without test_cases returns None."""
        result = BackendResult(
            success=True,
            output=json.dumps({"something_else": []}),
        )
        parsed = _parse_test_suite_from_result(result)
        assert parsed is None


class TestUTestAgentProtocol:
    """Tests for UTestAgent implementing DomainAgent protocol."""

    def test_agent_type_returns_correct_value(
        self,
        mock_artifact_writer: MagicMock,
        config: DevelopmentConfig,
    ) -> None:
        """Test that agent_type returns 'utest'."""
        backend = MockBackend()
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )
        assert agent.agent_type == "utest"

    def test_agent_implements_base_agent_protocol(
        self,
        mock_artifact_writer: MagicMock,
        config: DevelopmentConfig,
    ) -> None:
        """Test that UTestAgent implements BaseAgent protocol."""
        from src.workers.agents.protocols import BaseAgent

        backend = MockBackend()
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )
        assert isinstance(agent, BaseAgent)


class TestUTestAgentExecution:
    """Tests for UTestAgent.execute() method."""

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_task_description(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that execute returns error when no task_description provided."""
        backend = MockBackend()
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(agent_context, {})

        assert result.success is False
        assert "task_description" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_acceptance_criteria(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that execute returns error when no acceptance_criteria provided."""
        backend = MockBackend()
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"task_description": "Implement user login"},
        )

        assert result.success is False
        assert "acceptance_criteria" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_generates_test_suite_from_acceptance_criteria(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
        sample_test_response: dict[str, Any],
    ) -> None:
        """Test that execute generates test suite from acceptance criteria."""
        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=json.dumps(sample_test_response),
                cost_usd=0.02,
                turns=1,
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement user authentication",
                "acceptance_criteria": [
                    "User can authenticate with valid credentials",
                    "Invalid credentials return error",
                ],
            },
        )

        assert result.success is True
        assert result.agent_type == "utest"
        assert len(result.artifact_paths) >= 1
        assert result.metadata.get("test_count") == 1

    @pytest.mark.asyncio
    async def test_execute_maps_tests_to_acceptance_criteria(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that generated tests map to acceptance criteria."""
        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_valid_login",
                    "description": "Valid login test",
                    "test_type": "unit",
                    "code": "def test_valid_login(): pass",
                    "requirement_ref": "AC-001",
                },
                {
                    "id": "TC-002",
                    "name": "test_invalid_login",
                    "description": "Invalid login test",
                    "test_type": "unit",
                    "code": "def test_invalid_login(): pass",
                    "requirement_ref": "AC-002",
                },
            ],
            "setup_code": "import pytest",
            "fixtures": [],
        }

        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=json.dumps(test_response),
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement login",
                "acceptance_criteria": [
                    "AC-001: Valid credentials authenticate",
                    "AC-002: Invalid credentials fail",
                ],
            },
        )

        assert result.success is True
        assert result.metadata.get("test_count") == 2
        assert "criteria_coverage" in result.metadata

    @pytest.mark.asyncio
    async def test_execute_generates_valid_pytest_code(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that execute generates valid pytest code."""
        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_example",
                    "description": "Example test",
                    "test_type": "unit",
                    "code": (
                        'def test_example():\n'
                        '    """Test example functionality."""\n'
                        '    assert True'
                    ),
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": "import pytest",
            "fixtures": [],
        }

        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=json.dumps(test_response),
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "acceptance_criteria": ["Feature works"],
            },
        )

        assert result.success is True
        mock_artifact_writer.write_artifact.assert_called()
        call_kwargs = mock_artifact_writer.write_artifact.call_args_list[0][1]
        content = call_kwargs.get("content", "")
        assert "def test_" in content or "test_cases" in content

    @pytest.mark.asyncio
    async def test_execute_creates_fixtures_when_needed(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that execute creates fixtures when needed."""
        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_with_fixture",
                    "description": "Test using fixture",
                    "test_type": "unit",
                    "code": (
                        'def test_with_fixture(db_session):\n'
                        '    """Test with database fixture."""\n'
                        '    assert db_session is not None'
                    ),
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": (
                'import pytest\n\n'
                '@pytest.fixture\n'
                'def db_session():\n'
                '    """Provide database session."""\n'
                '    session = create_session()\n'
                '    yield session\n'
                '    session.close()'
            ),
            "fixtures": ["db_session"],
        }

        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=json.dumps(test_response),
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement database feature",
                "acceptance_criteria": ["Feature works with database"],
            },
        )

        assert result.success is True
        assert "fixtures" in result.metadata
        assert "db_session" in result.metadata["fixtures"]

    @pytest.mark.asyncio
    async def test_execute_with_structured_output(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
        sample_test_response: dict[str, Any],
    ) -> None:
        """Test execution with structured output (from --json-schema)."""
        backend = MockBackend(
            result=BackendResult(
                success=True,
                output="",
                structured_output=sample_test_response,
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement auth",
                "acceptance_criteria": ["Auth works"],
            },
        )

        assert result.success is True
        assert result.metadata["test_count"] == 1


class TestUTestAgentTestSuiteGeneration:
    """Tests for UTestAgent test suite generation."""

    @pytest.mark.asyncio
    async def test_generates_tests_that_will_fail_initially(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that generated tests are designed to fail initially (TDD red phase)."""
        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_should_create_user",
                    "description": "Test user creation",
                    "test_type": "unit",
                    "code": (
                        'def test_should_create_user():\n'
                        '    """Test that user creation works."""\n'
                        '    # This import will fail - implementation doesn\'t exist yet\n'
                        '    from myapp.users import create_user\n'
                        '    user = create_user(name="test")\n'
                        '    assert user.id is not None'
                    ),
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": "import pytest",
            "fixtures": [],
        }

        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=json.dumps(test_response),
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement user creation",
                "acceptance_criteria": ["User can be created"],
            },
        )

        assert result.success is True
        assert result.metadata.get("tdd_phase") == "red"

    @pytest.mark.asyncio
    async def test_handles_response_in_code_block(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that responses in code blocks are parsed correctly."""
        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_feature",
                    "description": "Feature test",
                    "test_type": "unit",
                    "code": "def test_feature(): assert True",
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": "",
            "fixtures": [],
        }

        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=f"```json\n{json.dumps(test_response)}\n```",
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Feature",
                "acceptance_criteria": ["Feature works"],
            },
        )

        assert result.success is True


class TestUTestAgentValidation:
    """Tests for UTestAgent validation methods."""

    def test_validate_context_returns_true_for_valid_context(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that validate_context returns True for valid context."""
        backend = MockBackend()
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )
        assert agent.validate_context(agent_context) is True

    def test_validate_context_returns_false_for_missing_session_id(
        self,
        mock_artifact_writer: MagicMock,
        config: DevelopmentConfig,
    ) -> None:
        """Test that validate_context returns False for missing session_id."""
        context = AgentContext(
            session_id="",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp",
        )
        backend = MockBackend()
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )
        assert agent.validate_context(context) is False

    def test_validate_context_returns_false_for_missing_task_id(
        self,
        mock_artifact_writer: MagicMock,
        config: DevelopmentConfig,
    ) -> None:
        """Test that validate_context returns False for missing task_id."""
        context = AgentContext(
            session_id="test-session",
            task_id="",
            tenant_id="default",
            workspace_path="/tmp",
        )
        backend = MockBackend()
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )
        assert agent.validate_context(context) is False


class TestUTestAgentErrorHandling:
    """Tests for UTestAgent error handling."""

    @pytest.mark.asyncio
    async def test_execute_handles_backend_exception(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that execute handles backend exceptions gracefully."""
        backend = MockBackend(error=ConnectionError("Backend unavailable"))
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "acceptance_criteria": ["Feature works"],
            },
        )

        assert result.success is False
        assert result.should_retry is True
        assert "Backend unavailable" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_handles_backend_failure_result(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that execute handles a BackendResult with success=False."""
        backend = MockBackend(
            result=BackendResult(
                success=False,
                error="CLI timed out after 300s",
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "acceptance_criteria": ["Feature works"],
            },
        )

        assert result.success is False
        assert result.should_retry is True
        assert "timed out" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_handles_invalid_json_response(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
    ) -> None:
        """Test that execute handles invalid JSON response."""
        backend = MockBackend(
            result=BackendResult(
                success=True,
                output="This is not valid JSON",
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Implement feature",
                "acceptance_criteria": ["Feature works"],
            },
        )

        assert result.success is False
        assert result.should_retry is True


class TestUTestAgentContextUsage:
    """Tests for UTestAgent context pack usage."""

    @pytest.mark.asyncio
    async def test_execute_uses_context_pack_when_provided(
        self,
        mock_artifact_writer: MagicMock,
        config: DevelopmentConfig,
    ) -> None:
        """Test that execute uses context pack for better test generation."""
        context = AgentContext(
            session_id="test-session",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp/workspace",
            context_pack={
                "files": [
                    {
                        "path": "src/auth/models.py",
                        "content": "class User:\n    pass",
                    }
                ],
                "interfaces": ["User"],
            },
        )

        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_user_model",
                    "description": "Test User model",
                    "test_type": "unit",
                    "code": "def test_user_model(): pass",
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": "",
            "fixtures": [],
        }

        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=json.dumps(test_response),
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context,
            {
                "task_description": "Implement user model",
                "acceptance_criteria": ["User model exists"],
            },
        )

        assert result.success is True
        # Verify context was used in the prompt
        call = backend.execute_calls[0]
        prompt = call["prompt"]
        assert "User" in prompt or "context" in prompt.lower()


class TestUTestAgentOutputFormats:
    """Tests for UTestAgent output formats."""

    @pytest.mark.asyncio
    async def test_writes_test_suite_as_json_artifact(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
        sample_test_response: dict[str, Any],
    ) -> None:
        """Test that test suite is written as JSON artifact."""
        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=json.dumps(sample_test_response),
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Feature",
                "acceptance_criteria": ["Works"],
            },
        )

        assert result.success is True
        json_calls = [
            call
            for call in mock_artifact_writer.write_artifact.call_args_list
            if "json" in call[1].get("filename", "").lower()
        ]
        assert len(json_calls) >= 1

    @pytest.mark.asyncio
    async def test_writes_test_file_as_python_artifact(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
        sample_test_response: dict[str, Any],
    ) -> None:
        """Test that test code is written as Python artifact."""
        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=json.dumps(sample_test_response),
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Feature",
                "acceptance_criteria": ["Works"],
            },
        )

        assert result.success is True
        py_calls = [
            call
            for call in mock_artifact_writer.write_artifact.call_args_list
            if call[1].get("filename", "").endswith(".py")
        ]
        assert len(py_calls) >= 1


class TestUTestAgentBackendConfig:
    """Tests for UTestAgent passing correct config to backend."""

    @pytest.mark.asyncio
    async def test_execute_passes_correct_config_to_backend(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
        sample_test_response: dict[str, Any],
    ) -> None:
        """Test that the BackendConfig passed to backend is correct."""
        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=json.dumps(sample_test_response),
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        await agent.execute(
            agent_context,
            {
                "task_description": "Feature",
                "acceptance_criteria": ["Works"],
            },
        )

        assert len(backend.execute_calls) == 1
        call = backend.execute_calls[0]
        backend_config = call["config"]
        assert backend_config.output_schema == UTEST_OUTPUT_SCHEMA
        assert backend_config.timeout_seconds == 300
        assert backend_config.allowed_tools == ["Read", "Glob", "Grep"]
        assert backend_config.model == config.utest_model
        assert call["workspace_path"] == agent_context.workspace_path

    @pytest.mark.asyncio
    async def test_execute_includes_backend_metadata(
        self,
        mock_artifact_writer: MagicMock,
        agent_context: AgentContext,
        config: DevelopmentConfig,
        sample_test_response: dict[str, Any],
    ) -> None:
        """Test that backend metadata is included in result."""
        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=json.dumps(sample_test_response),
                cost_usd=0.03,
                turns=2,
                session_id="ses-123",
            ),
        )
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "task_description": "Feature",
                "acceptance_criteria": ["Works"],
            },
        )

        assert result.success is True
        assert result.metadata["backend"] == "mock-backend"
        assert result.metadata["cost_usd"] == 0.03
        assert result.metadata["turns"] == 2
        assert result.metadata["session_id"] == "ses-123"
