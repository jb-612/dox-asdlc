"""Unit tests for AcceptanceAgent."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.protocols import AgentContext
from src.workers.agents.discovery.config import DiscoveryConfig
from src.workers.agents.discovery.acceptance_agent import AcceptanceAgent
from src.workers.agents.discovery.models import (
    PRDDocument,
    PRDSection,
    Requirement,
)
from src.workers.agents.backends.base import BackendResult


@pytest.fixture
def mock_backend():
    """Create a mock agent backend."""
    backend = AsyncMock()
    backend.backend_name = "mock"
    backend.execute = AsyncMock(return_value=BackendResult(
        success=True,
        output='{}',
        structured_output={},
    ))
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
    return DiscoveryConfig(max_retries=1, retry_delay_seconds=0)


@pytest.fixture
def sample_prd():
    """Create a sample PRD document."""
    return PRDDocument.create(
        title="Test PRD",
        executive_summary="Test summary",
        objectives=PRDSection(title="Objectives", content="Test objectives"),
        scope=PRDSection(title="Scope", content="Test scope"),
        sections=[
            PRDSection(
                title="Functional Requirements",
                content="Test functional requirements",
                requirements=[
                    Requirement(
                        id="REQ-001",
                        description="User can login with email and password",
                    ),
                    Requirement(
                        id="REQ-002",
                        description="User can logout",
                    ),
                ],
            )
        ],
    )


class TestAcceptanceAgent:
    """Tests for AcceptanceAgent."""

    def test_agent_type_returns_correct_value(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that agent_type returns 'acceptance_agent'."""
        agent = AcceptanceAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "acceptance_agent"

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_prd(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no PRD provided."""
        agent = AcceptanceAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(agent_context, {})

        assert result.success is False
        assert "No PRD document available" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_prd_has_no_requirements(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when PRD has no requirements."""
        empty_prd = PRDDocument.create(
            title="Empty PRD",
            executive_summary="",
            objectives=PRDSection(title="Obj", content=""),
            scope=PRDSection(title="Scope", content=""),
            sections=[],
        )

        agent = AcceptanceAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"prd_document": empty_prd},
        )

        assert result.success is False
        assert "no requirements" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_generates_acceptance_criteria(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
        sample_prd,
    ) -> None:
        """Test that execute generates acceptance criteria from PRD."""
        criteria_response = {
            "criteria": [
                {
                    "id": "AC-001",
                    "requirement_ids": ["REQ-001"],
                    "given": "a registered user",
                    "when": "the user logs in with valid credentials",
                    "then": "the user is authenticated",
                    "notes": "",
                },
                {
                    "id": "AC-002",
                    "requirement_ids": ["REQ-002"],
                    "given": "an authenticated user",
                    "when": "the user clicks logout",
                    "then": "the user is logged out",
                    "notes": "",
                },
            ]
        }

        mock_backend.execute.return_value = BackendResult(
            success=True,
            output=json.dumps(criteria_response),
            structured_output=criteria_response,
        )

        agent = AcceptanceAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"prd_document": sample_prd},
        )

        assert result.success is True
        assert result.agent_type == "acceptance_agent"
        assert len(result.artifact_paths) == 1
        assert result.metadata["criteria_count"] == 2
        assert result.metadata["requirement_count"] == 2

    @pytest.mark.asyncio
    async def test_execute_accepts_prd_as_dict(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
        sample_prd,
    ) -> None:
        """Test that execute accepts PRD as dictionary."""
        criteria_response = {
            "criteria": [
                {
                    "id": "AC-001",
                    "requirement_ids": ["REQ-001"],
                    "given": "state",
                    "when": "action",
                    "then": "result",
                },
            ]
        }

        mock_backend.execute.return_value = BackendResult(
            success=True,
            output=json.dumps(criteria_response),
            structured_output=criteria_response,
        )

        agent = AcceptanceAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"prd_document": sample_prd.to_dict()},
        )

        assert result.success is True

    @pytest.mark.asyncio
    async def test_execute_reports_coverage_stats(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
        sample_prd,
    ) -> None:
        """Test that execute reports coverage statistics."""
        # Only cover REQ-001, leave REQ-002 uncovered
        criteria_response = {
            "criteria": [
                {
                    "id": "AC-001",
                    "requirement_ids": ["REQ-001"],
                    "given": "state",
                    "when": "action",
                    "then": "result",
                },
            ]
        }

        mock_backend.execute.return_value = BackendResult(
            success=True,
            output=json.dumps(criteria_response),
            structured_output=criteria_response,
        )

        agent = AcceptanceAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"prd_document": sample_prd},
        )

        assert result.success is True
        assert result.metadata["coverage_percentage"] == 50.0
        assert "REQ-002" in result.metadata["uncovered_requirements"]

    @pytest.mark.asyncio
    async def test_execute_creates_fallback_criteria_on_generation_failure(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
        sample_prd,
    ) -> None:
        """Test that execute creates fallback criteria when generation fails."""
        # Return invalid response
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output="Invalid JSON response",
            structured_output=None,
        )

        agent = AcceptanceAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"prd_document": sample_prd},
        )

        # Should succeed with fallback criteria
        assert result.success is True
        assert result.metadata["criteria_count"] == 2  # One per requirement


class TestAcceptanceAgentValidation:
    """Tests for AcceptanceAgent validation methods."""

    def test_validate_context_returns_true_for_valid_context(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that validate_context returns True for valid context."""
        agent = AcceptanceAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(agent_context) is True


class TestAcceptanceAgentJSONParsing:
    """Tests for AcceptanceAgent JSON parsing via response_parser."""

    def test_parse_json_handles_code_blocks(self) -> None:
        """Test that JSON is parsed from code blocks."""
        from src.workers.agents.backends.response_parser import parse_json_from_response

        content = '```json\n{"criteria": []}\n```'
        result = parse_json_from_response(content)

        assert result == {"criteria": []}

    def test_parse_json_returns_none_for_invalid_json(self) -> None:
        """Test that None is returned for invalid JSON."""
        from src.workers.agents.backends.response_parser import parse_json_from_response

        result = parse_json_from_response("not valid json")

        assert result is None
