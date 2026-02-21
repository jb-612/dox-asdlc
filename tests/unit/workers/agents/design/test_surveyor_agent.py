"""Unit tests for Surveyor Agent."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    Risk,
    RiskLevel,
    TechnologyChoice,
    TechSurvey,
)
from src.workers.agents.design.surveyor_agent import (
    SurveyorAgent,
    SurveyorAgentError,
    _build_surveyor_prompt,
    _parse_survey_from_result,
    SURVEYOR_OUTPUT_SCHEMA,
    SURVEYOR_SYSTEM_PROMPT,
)


@pytest.fixture
def mock_backend() -> AsyncMock:
    """Create mock agent backend."""
    backend = AsyncMock()
    backend.backend_name = "mock"
    backend.execute = AsyncMock(return_value=BackendResult(
        success=True,
        output='{"key": "value"}',
        structured_output={"key": "value"},
    ))
    backend.health_check = AsyncMock(return_value=True)
    return backend


@pytest.fixture
def mock_artifact_writer() -> MagicMock:
    """Create mock artifact writer."""
    writer = MagicMock()
    writer.write_artifact = AsyncMock(return_value="/artifacts/test_tech_survey.json")
    return writer


@pytest.fixture
def default_config() -> DesignConfig:
    """Create default config for testing."""
    return DesignConfig(
        max_retries=2,
        retry_delay_seconds=0.01,
        enable_rlm=False,
    )


@pytest.fixture
def agent_context() -> AgentContext:
    """Create test agent context."""
    return AgentContext(
        session_id="test-session-123",
        task_id="task-456",
        tenant_id="test-tenant",
        workspace_path="/test/workspace",
    )


@pytest.fixture
def sample_survey_response() -> dict[str, Any]:
    """Sample combined survey response."""
    return {
        "technologies": [
            {
                "category": "language",
                "selected": "Python 3.11+",
                "alternatives": ["Go", "Node.js"],
                "rationale": "Best async support and team expertise",
                "constraints": ["async support satisfied"],
            },
            {
                "category": "database",
                "selected": "PostgreSQL 15",
                "alternatives": ["MySQL"],
                "rationale": "Required by existing infrastructure",
                "constraints": ["PostgreSQL compatible"],
            },
        ],
        "constraints_analysis": {
            "async support": "Satisfied by asyncio and FastAPI",
            "PostgreSQL compatible": "Using psycopg3 with async support",
        },
        "risk_assessment": [
            {
                "id": "RISK-001",
                "description": "Python GIL may limit CPU-bound tasks",
                "level": "medium",
                "mitigation": "Use multiprocessing for CPU tasks",
                "impact": "May need worker processes",
            }
        ],
        "recommendations": [
            "Use FastAPI for REST API",
            "Implement connection pooling",
        ],
    }


class TestSurveyorAgentInit:
    """Tests for Surveyor Agent initialization."""

    def test_agent_type(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test agent type property."""
        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )
        assert agent.agent_type == "surveyor_agent"


class TestSurveyorAgentExecute:
    """Tests for Surveyor Agent execute method."""

    @pytest.mark.asyncio
    async def test_execute_success(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_survey_response: dict[str, Any],
    ) -> None:
        """Test successful execution."""
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output=json.dumps(sample_survey_response),
            structured_output=sample_survey_response,
        )

        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "prd_content": "The system must handle async requests.",
                "prd_reference": "PRD-TEST-001",
            },
        )

        assert result.success is True
        assert result.agent_type == "surveyor_agent"
        assert result.task_id == agent_context.task_id
        assert len(result.artifact_paths) > 0
        assert result.metadata["technology_count"] == 2
        assert result.metadata["prd_reference"] == "PRD-TEST-001"
        assert result.metadata["backend"] == "mock"
        # Single backend call for entire survey
        mock_backend.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_missing_prd_content(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution fails without PRD content."""
        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={},  # No prd_content
        )

        assert result.success is False
        assert "prd_content" in result.error_message
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_analysis_failure_unparseable(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution handles unparseable backend output."""
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output="not valid json",
            structured_output=None,
        )

        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"prd_content": "Some PRD content"},
        )

        assert result.success is False
        assert "analyze technology needs" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_backend_failure(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution handles backend failure."""
        mock_backend.execute.return_value = BackendResult(
            success=False,
            output="",
            error="Backend unavailable",
        )

        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"prd_content": "PRD content"},
        )

        assert result.success is False
        assert "Backend unavailable" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_with_context_pack(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        sample_survey_response: dict[str, Any],
    ) -> None:
        """Test execution with existing context pack."""
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output=json.dumps(sample_survey_response),
            structured_output=sample_survey_response,
        )

        context = AgentContext(
            session_id="test-session",
            task_id="task-123",
            tenant_id="test-tenant",
            workspace_path="/test",
            context_pack={
                "structure": {"src/": "directory"},
                "dependencies": ["fastapi", "pydantic"],
                "key_files": ["main.py", "config.py"],
            },
        )

        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=context,
            event_metadata={"prd_content": "PRD content here"},
        )

        assert result.success is True


class TestSurveyorAgentHelpers:
    """Tests for helper methods."""

    def test_summarize_context_pack(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test context pack summarization."""
        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        context_pack = {
            "structure": {"src/": "dir", "tests/": "dir"},
            "dependencies": ["fastapi", "pydantic", "redis"],
            "key_files": ["main.py", "config.py"],
        }

        summary = agent._summarize_context_pack(context_pack)

        assert "Project Structure" in summary
        assert "Dependencies" in summary
        assert "Key Files" in summary

    def test_summarize_empty_context_pack(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test summarizing empty context pack."""
        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        summary = agent._summarize_context_pack({})
        assert summary == ""

    def test_extract_existing_patterns(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test extracting existing patterns."""
        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        context_pack = {
            "files": ["main.py", "config.py", "app.tsx", "utils.ts"],
            "infrastructure": ["Docker", "Redis"],
        }

        patterns = agent._extract_existing_patterns(context_pack)

        assert "Python" in patterns
        assert "TypeScript" in patterns
        assert "Infrastructure" in patterns

    def test_validate_context_valid(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test context validation with valid context."""
        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        assert agent.validate_context(agent_context) is True

    def test_validate_context_invalid(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test context validation with invalid context."""
        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        invalid_context = AgentContext(
            session_id="",  # Empty session ID
            task_id="task-123",
            tenant_id="tenant",
            workspace_path="/test",
        )

        assert agent.validate_context(invalid_context) is False


class TestSurveyorAgentTechSurveyBuilding:
    """Tests for TechSurvey building."""

    def test_build_tech_survey(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test building TechSurvey from response data."""
        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        rec_data = {
            "technologies": [
                {
                    "category": "language",
                    "selected": "Python",
                    "alternatives": ["Go"],
                    "rationale": "Team expertise",
                    "constraints": [],
                }
            ],
            "constraints_analysis": {"async": "satisfied"},
            "risk_assessment": [
                {
                    "id": "RISK-001",
                    "description": "GIL limitation",
                    "level": "medium",
                    "mitigation": "Use multiprocessing",
                    "impact": "Minor",
                }
            ],
            "recommendations": ["Use FastAPI"],
        }

        survey = agent._build_tech_survey(rec_data, "PRD-001")

        assert len(survey.technologies) == 1
        assert survey.technologies[0].selected == "Python"
        assert len(survey.risk_assessment) == 1
        assert survey.risk_assessment[0].level == RiskLevel.MEDIUM
        assert survey.prd_reference == "PRD-001"

    def test_build_tech_survey_with_invalid_risk_level(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test building TechSurvey with invalid risk level."""
        agent = SurveyorAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        rec_data = {
            "technologies": [],
            "constraints_analysis": {},
            "risk_assessment": [
                {
                    "id": "RISK-001",
                    "description": "Some risk",
                    "level": "invalid_level",  # Invalid
                    "mitigation": "Fix it",
                    "impact": "Some impact",
                }
            ],
            "recommendations": [],
        }

        survey = agent._build_tech_survey(rec_data, "PRD-001")

        # Invalid risk should be skipped
        assert len(survey.risk_assessment) == 0


class TestSurveyorModuleFunctions:
    """Tests for module-level functions and constants."""

    def test_output_schema_has_required_keys(self) -> None:
        """Test that the output schema has the required structure."""
        assert "type" in SURVEYOR_OUTPUT_SCHEMA
        assert SURVEYOR_OUTPUT_SCHEMA["type"] == "object"
        props = SURVEYOR_OUTPUT_SCHEMA["properties"]
        assert "technologies" in props
        assert "constraints_analysis" in props
        assert "risk_assessment" in props
        assert "recommendations" in props

    def test_system_prompt_is_nonempty(self) -> None:
        """Test that the system prompt is defined."""
        assert SURVEYOR_SYSTEM_PROMPT
        assert "Technology Surveyor" in SURVEYOR_SYSTEM_PROMPT

    def test_build_surveyor_prompt_basic(self) -> None:
        """Test building a basic surveyor prompt."""
        prompt = _build_surveyor_prompt(
            prd_content="Build a user authentication system",
            prd_reference="PRD-001",
        )

        assert "PRD Document" in prompt
        assert "PRD Reference" in prompt
        assert "Build a user authentication system" in prompt
        assert "PRD-001" in prompt

    def test_build_surveyor_prompt_with_context(self) -> None:
        """Test building prompt with context and patterns."""
        prompt = _build_surveyor_prompt(
            prd_content="PRD content",
            prd_reference="PRD-001",
            context_pack_summary="### Dependencies\n- fastapi",
            existing_patterns="### Languages\n- Python",
            additional_context="Team prefers Python",
        )

        assert "Existing Codebase Context" in prompt
        assert "Existing Technology Patterns" in prompt
        assert "Additional Context" in prompt
        assert "Team prefers Python" in prompt

    def test_parse_survey_from_result_structured_output(self) -> None:
        """Test parsing from structured output."""
        result = BackendResult(
            success=True,
            output="",
            structured_output={
                "technologies": [{"category": "language", "selected": "Python"}],
            },
        )

        data = _parse_survey_from_result(result)
        assert data is not None
        assert "technologies" in data

    def test_parse_survey_from_result_text_output(self) -> None:
        """Test parsing from text output."""
        result = BackendResult(
            success=True,
            output='{"technologies": [{"category": "language", "selected": "Python"}]}',
            structured_output=None,
        )

        data = _parse_survey_from_result(result)
        assert data is not None
        assert data["technologies"][0]["selected"] == "Python"

    def test_parse_survey_from_result_invalid(self) -> None:
        """Test parsing returns None for invalid output."""
        result = BackendResult(
            success=True,
            output="not json at all",
            structured_output=None,
        )

        data = _parse_survey_from_result(result)
        assert data is None

    def test_parse_survey_from_result_missing_technologies(self) -> None:
        """Test parsing returns None when technologies key is missing."""
        result = BackendResult(
            success=True,
            output='{"recommendations": []}',
            structured_output={"recommendations": []},
        )

        data = _parse_survey_from_result(result)
        assert data is None
