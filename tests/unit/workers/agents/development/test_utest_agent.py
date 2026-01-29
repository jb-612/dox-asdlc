"""Unit tests for UTestAgent."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import TestCase, TestSuite, TestType
from src.workers.llm.client import LLMResponse


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client."""
    client = MagicMock()
    client.generate = AsyncMock()
    client.model_name = "test-model"
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


class TestUTestAgentProtocol:
    """Tests for UTestAgent implementing DomainAgent protocol."""

    def test_agent_type_returns_correct_value(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that agent_type returns 'utest'."""
        from src.workers.agents.development.utest_agent import UTestAgent

        agent = UTestAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "utest"

    def test_agent_implements_base_agent_protocol(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that UTestAgent implements BaseAgent protocol."""
        from src.workers.agents.protocols import BaseAgent
        from src.workers.agents.development.utest_agent import UTestAgent

        agent = UTestAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert isinstance(agent, BaseAgent)


class TestUTestAgentExecution:
    """Tests for UTestAgent.execute() method."""

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_task_description(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no task_description provided."""
        from src.workers.agents.development.utest_agent import UTestAgent

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no acceptance_criteria provided."""
        from src.workers.agents.development.utest_agent import UTestAgent

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute generates test suite from acceptance criteria."""
        from src.workers.agents.development.utest_agent import UTestAgent

        # Mock LLM response with test cases
        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_should_authenticate_valid_user",
                    "description": "Test that valid credentials authenticate successfully",
                    "test_type": "unit",
                    "code": """def test_should_authenticate_valid_user():
    \"\"\"Test that valid credentials authenticate successfully.\"\"\"
    # Arrange
    user = User(username="test", password="valid")
    # Act
    result = authenticate(user)
    # Assert
    assert result.success is True""",
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": "import pytest\nfrom myapp.auth import authenticate, User",
            "fixtures": ["db_session"],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(test_response),
            model="test-model",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that generated tests map to acceptance criteria."""
        from src.workers.agents.development.utest_agent import UTestAgent

        # Mock LLM response with multiple test cases mapped to criteria
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(test_response),
            model="test-model",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        # Check that criteria mapping is in metadata
        assert "criteria_coverage" in result.metadata

    @pytest.mark.asyncio
    async def test_execute_generates_valid_pytest_code(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute generates valid pytest code."""
        from src.workers.agents.development.utest_agent import UTestAgent

        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_example",
                    "description": "Example test",
                    "test_type": "unit",
                    "code": """def test_example():
    \"\"\"Test example functionality.\"\"\"
    assert True""",
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": "import pytest",
            "fixtures": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(test_response),
            model="test-model",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        # Verify artifact was written with pytest code
        mock_artifact_writer.write_artifact.assert_called()
        call_kwargs = mock_artifact_writer.write_artifact.call_args_list[0][1]
        content = call_kwargs.get("content", "")
        assert "def test_" in content or "test_cases" in content

    @pytest.mark.asyncio
    async def test_execute_creates_fixtures_when_needed(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute creates fixtures when needed."""
        from src.workers.agents.development.utest_agent import UTestAgent

        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_with_fixture",
                    "description": "Test using fixture",
                    "test_type": "unit",
                    "code": """def test_with_fixture(db_session):
    \"\"\"Test with database fixture.\"\"\"
    assert db_session is not None""",
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": """import pytest

@pytest.fixture
def db_session():
    \"\"\"Provide database session.\"\"\"
    session = create_session()
    yield session
    session.close()""",
            "fixtures": ["db_session"],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(test_response),
            model="test-model",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
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


class TestUTestAgentTestSuiteGeneration:
    """Tests for UTestAgent test suite generation."""

    @pytest.mark.asyncio
    async def test_generates_tests_that_will_fail_initially(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that generated tests are designed to fail initially (TDD red phase)."""
        from src.workers.agents.development.utest_agent import UTestAgent

        # Test code that references non-existent implementation
        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_should_create_user",
                    "description": "Test user creation",
                    "test_type": "unit",
                    "code": """def test_should_create_user():
    \"\"\"Test that user creation works.\"\"\"
    # This import will fail - implementation doesn't exist yet
    from myapp.users import create_user

    user = create_user(name="test")
    assert user.id is not None""",
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": "import pytest",
            "fixtures": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(test_response),
            model="test-model",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        # Metadata should indicate tests are for TDD red phase
        assert result.metadata.get("tdd_phase") == "red"

    @pytest.mark.asyncio
    async def test_handles_llm_response_in_code_block(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that LLM responses in code blocks are parsed correctly."""
        from src.workers.agents.development.utest_agent import UTestAgent

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

        # Wrap response in code block
        mock_llm_client.generate.return_value = LLMResponse(
            content=f"```json\n{json.dumps(test_response)}\n```",
            model="test-model",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that validate_context returns True for valid context."""
        from src.workers.agents.development.utest_agent import UTestAgent

        agent = UTestAgent(
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
        from src.workers.agents.development.utest_agent import UTestAgent

        context = AgentContext(
            session_id="",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(context) is False

    def test_validate_context_returns_false_for_missing_task_id(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that validate_context returns False for missing task_id."""
        from src.workers.agents.development.utest_agent import UTestAgent

        context = AgentContext(
            session_id="test-session",
            task_id="",
            tenant_id="default",
            workspace_path="/tmp",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(context) is False


class TestUTestAgentErrorHandling:
    """Tests for UTestAgent error handling."""

    @pytest.mark.asyncio
    async def test_execute_handles_llm_exception(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles LLM exceptions gracefully."""
        from src.workers.agents.development.utest_agent import UTestAgent

        mock_llm_client.generate.side_effect = Exception("LLM service unavailable")

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        from src.workers.agents.development.utest_agent import UTestAgent

        mock_llm_client.generate.return_value = LLMResponse(
            content="This is not valid JSON",
            model="test-model",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that execute uses context pack for better test generation."""
        from src.workers.agents.development.utest_agent import UTestAgent

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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(test_response),
            model="test-model",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        call_kwargs = mock_llm_client.generate.call_args[1]
        prompt = call_kwargs.get("prompt", "")
        assert "User" in prompt or "context" in prompt.lower()


class TestUTestAgentOutputFormats:
    """Tests for UTestAgent output formats."""

    @pytest.mark.asyncio
    async def test_writes_test_suite_as_json_artifact(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that test suite is written as JSON artifact."""
        from src.workers.agents.development.utest_agent import UTestAgent

        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_feature",
                    "description": "Feature test",
                    "test_type": "unit",
                    "code": "def test_feature(): pass",
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": "",
            "fixtures": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(test_response),
            model="test-model",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        # Verify JSON artifact was written
        json_calls = [
            call
            for call in mock_artifact_writer.write_artifact.call_args_list
            if "json" in call[1].get("filename", "").lower()
        ]
        assert len(json_calls) >= 1

    @pytest.mark.asyncio
    async def test_writes_test_file_as_python_artifact(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that test code is written as Python artifact."""
        from src.workers.agents.development.utest_agent import UTestAgent

        test_response = {
            "test_cases": [
                {
                    "id": "TC-001",
                    "name": "test_feature",
                    "description": "Feature test",
                    "test_type": "unit",
                    "code": "def test_feature(): pass",
                    "requirement_ref": "AC-001",
                }
            ],
            "setup_code": "import pytest",
            "fixtures": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(test_response),
            model="test-model",
        )

        agent = UTestAgent(
            llm_client=mock_llm_client,
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
        # Verify Python artifact was written
        py_calls = [
            call
            for call in mock_artifact_writer.write_artifact.call_args_list
            if call[1].get("filename", "").endswith(".py")
        ]
        assert len(py_calls) >= 1
