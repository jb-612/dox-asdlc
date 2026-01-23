"""Unit tests for Surveyor Agent."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    Risk,
    RiskLevel,
    TechnologyChoice,
    TechSurvey,
)
from src.workers.agents.design.surveyor_agent import SurveyorAgent, SurveyorAgentError


@dataclass
class MockLLMResponse:
    """Mock LLM response."""

    content: str


@pytest.fixture
def mock_llm_client() -> MagicMock:
    """Create mock LLM client."""
    client = MagicMock()
    client.generate = AsyncMock()
    return client


@pytest.fixture
def mock_artifact_writer() -> MagicMock:
    """Create mock artifact writer."""
    writer = MagicMock()
    writer.write_artifact = AsyncMock(return_value="/artifacts/test_tech_survey.json")
    return writer


@pytest.fixture
def mock_rlm_integration() -> MagicMock:
    """Create mock RLM integration."""
    integration = MagicMock()
    integration.explore = AsyncMock()
    return integration


@pytest.fixture
def default_config() -> DesignConfig:
    """Create default config for testing."""
    return DesignConfig(
        max_retries=2,
        retry_delay_seconds=0.01,  # Fast retries for tests
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
def sample_tech_analysis_response() -> str:
    """Sample technology analysis response."""
    return json.dumps({
        "technology_needs": [
            {
                "category": "language",
                "requirement": "High-performance async language",
                "constraints": ["must support async"],
                "priority": "critical",
                "nfr_impact": ["performance"],
            },
            {
                "category": "database",
                "requirement": "Relational database with JSON support",
                "constraints": ["PostgreSQL compatible"],
                "priority": "high",
                "nfr_impact": ["reliability"],
            },
        ],
        "existing_decisions": [
            {
                "category": "database",
                "decision": "PostgreSQL",
                "source": "prd",
            }
        ],
        "research_topics": ["async Python frameworks"],
    })


@pytest.fixture
def sample_evaluations_response() -> str:
    """Sample evaluations response."""
    return json.dumps({
        "evaluations": [
            {
                "category": "language",
                "options": [
                    {
                        "name": "Python",
                        "pros": ["rich ecosystem", "team expertise"],
                        "cons": ["GIL limitations"],
                        "fit_score": 4,
                        "fit_rationale": "Good async support with asyncio",
                    },
                    {
                        "name": "Go",
                        "pros": ["excellent concurrency"],
                        "cons": ["smaller ecosystem"],
                        "fit_score": 3,
                        "fit_rationale": "Good but less familiar to team",
                    },
                ],
                "constraints_met": ["must support async"],
                "recommendation": "Python",
                "confidence": "high",
            }
        ],
        "integration_notes": ["Python integrates well with PostgreSQL"],
        "concerns": ["Consider connection pooling"],
    })


@pytest.fixture
def sample_recommendations_response() -> str:
    """Sample recommendations response."""
    return json.dumps({
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
    })


class TestSurveyorAgentInit:
    """Tests for Surveyor Agent initialization."""

    def test_agent_type(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test agent type property."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )
        assert agent.agent_type == "surveyor_agent"

    def test_agent_with_optional_dependencies(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        mock_rlm_integration: MagicMock,
    ) -> None:
        """Test agent with optional RLM integration."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
            rlm_integration=mock_rlm_integration,
        )
        assert agent._rlm_integration is mock_rlm_integration


class TestSurveyorAgentExecute:
    """Tests for Surveyor Agent execute method."""

    @pytest.mark.asyncio
    async def test_execute_success(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_tech_analysis_response: str,
        sample_evaluations_response: str,
        sample_recommendations_response: str,
    ) -> None:
        """Test successful execution."""
        # Setup mock responses for each LLM call
        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_tech_analysis_response),
            MockLLMResponse(content=sample_evaluations_response),
            MockLLMResponse(content=sample_recommendations_response),
        ]

        agent = SurveyorAgent(
            llm_client=mock_llm_client,
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

    @pytest.mark.asyncio
    async def test_execute_missing_prd_content(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution fails without PRD content."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
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
    async def test_execute_analysis_failure(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution handles analysis failure."""
        # Return invalid JSON to cause analysis failure
        mock_llm_client.generate.return_value = MockLLMResponse(
            content="not valid json"
        )

        agent = SurveyorAgent(
            llm_client=mock_llm_client,
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
    async def test_execute_with_context_pack(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        sample_tech_analysis_response: str,
        sample_evaluations_response: str,
        sample_recommendations_response: str,
    ) -> None:
        """Test execution with existing context pack."""
        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_tech_analysis_response),
            MockLLMResponse(content=sample_evaluations_response),
            MockLLMResponse(content=sample_recommendations_response),
        ]

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
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=context,
            event_metadata={"prd_content": "PRD content here"},
        )

        assert result.success is True


class TestSurveyorAgentRlmIntegration:
    """Tests for RLM integration in Surveyor Agent."""

    @pytest.mark.asyncio
    async def test_rlm_triggered_when_enabled(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        mock_rlm_integration: MagicMock,
        agent_context: AgentContext,
        sample_tech_analysis_response: str,
        sample_evaluations_response: str,
        sample_recommendations_response: str,
    ) -> None:
        """Test RLM is triggered when enabled and research needed."""
        config = DesignConfig(
            enable_rlm=True,
            max_retries=1,
            retry_delay_seconds=0.01,
        )

        # Mock RLM trigger check response
        rlm_trigger_response = json.dumps({
            "needs_research": True,
            "research_priority": "high",
            "research_queries": ["async Python frameworks comparison"],
            "reasoning": "Need to compare options",
        })

        # Mock RLM exploration result
        mock_rlm_result = MagicMock()
        mock_rlm_result.error = None
        mock_rlm_result.formatted_output = "RLM found FastAPI is best for async"
        mock_rlm_integration.explore.return_value = mock_rlm_result

        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_tech_analysis_response),
            MockLLMResponse(content=rlm_trigger_response),  # RLM trigger check
            MockLLMResponse(content=sample_evaluations_response),
            MockLLMResponse(content=sample_recommendations_response),
        ]

        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"prd_content": "PRD requiring research"},
        )

        assert result.success is True
        assert result.metadata.get("used_rlm") is True
        mock_rlm_integration.explore.assert_called_once()

    @pytest.mark.asyncio
    async def test_rlm_not_triggered_when_disabled(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        mock_rlm_integration: MagicMock,
        agent_context: AgentContext,
        sample_tech_analysis_response: str,
        sample_evaluations_response: str,
        sample_recommendations_response: str,
    ) -> None:
        """Test RLM is not triggered when disabled."""
        config = DesignConfig(
            enable_rlm=False,
            max_retries=1,
            retry_delay_seconds=0.01,
        )

        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_tech_analysis_response),
            MockLLMResponse(content=sample_evaluations_response),
            MockLLMResponse(content=sample_recommendations_response),
        ]

        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"prd_content": "PRD content"},
        )

        assert result.success is True
        assert result.metadata.get("used_rlm") is False
        mock_rlm_integration.explore.assert_not_called()


class TestSurveyorAgentJsonParsing:
    """Tests for JSON parsing in Surveyor Agent."""

    def test_parse_direct_json(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test parsing direct JSON response."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        content = '{"key": "value"}'
        result = agent._parse_json_from_response(content)

        assert result == {"key": "value"}

    def test_parse_json_in_code_block(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test parsing JSON from code block."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        content = """Here's the response:
```json
{"key": "value"}
```
"""
        result = agent._parse_json_from_response(content)

        assert result == {"key": "value"}

    def test_parse_json_embedded_in_text(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test parsing JSON embedded in text."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        content = 'Here is the result: {"key": "value"} and more text'
        result = agent._parse_json_from_response(content)

        assert result == {"key": "value"}

    def test_parse_invalid_json(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test parsing invalid JSON returns None."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        content = "not json at all"
        result = agent._parse_json_from_response(content)

        assert result is None


class TestSurveyorAgentHelpers:
    """Tests for helper methods."""

    def test_summarize_context_pack(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test context pack summarization."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test summarizing empty context pack."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        summary = agent._summarize_context_pack({})
        assert summary == ""

    def test_extract_existing_patterns(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test extracting existing patterns."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test context validation with valid context."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        assert agent.validate_context(agent_context) is True

    def test_validate_context_invalid(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test context validation with invalid context."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test building TechSurvey from response data."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test building TechSurvey with invalid risk level."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
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

    def test_create_fallback_survey(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test creating fallback survey from evaluations."""
        agent = SurveyorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        evaluations = {
            "evaluations": [
                {
                    "category": "language",
                    "options": [
                        {"name": "Python"},
                        {"name": "Go"},
                    ],
                    "recommendation": "Python",
                    "confidence": "high",
                    "constraints_met": ["async support"],
                }
            ]
        }

        survey = agent._create_fallback_survey(evaluations, "PRD-FALLBACK")

        assert len(survey.technologies) == 1
        assert survey.technologies[0].selected == "Python"
        assert "Go" in survey.technologies[0].alternatives
        assert survey.prd_reference == "PRD-FALLBACK"
