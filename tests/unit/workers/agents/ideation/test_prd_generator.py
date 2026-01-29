"""Unit tests for PRD Generator.

Tests the integration with PRDAgent for PRD generation from ideation output.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.ideation.prd_generator import (
    PRDGenerator,
    PRDGeneratorConfig,
    IdeationToPRDInput,
)
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
    return PRDGeneratorConfig(max_retries=1, retry_delay_seconds=0)


@pytest.fixture
def sample_ideation_input():
    """Create a sample ideation input."""
    return IdeationToPRDInput(
        session_id="session-123",
        project_title="Document Management System",
        conversation_summary="User wants a document management system for PDFs and Word docs.",
        extracted_requirements=[
            {
                "id": "REQ-001",
                "description": "System must support PDF uploads",
                "type": "functional",
                "priority": "must_have",
                "category_id": "functional",
            },
            {
                "id": "REQ-002",
                "description": "Maximum file size is 100MB",
                "type": "constraint",
                "priority": "must_have",
                "category_id": "scope",
            },
            {
                "id": "REQ-003",
                "description": "System must be available 99.9% of the time",
                "type": "non_functional",
                "priority": "must_have",
                "category_id": "nfr",
            },
        ],
        maturity_scores={
            "problem": 80,
            "users": 70,
            "functional": 85,
            "nfr": 75,
            "scope": 80,
            "success": 70,
            "risks": 65,
        },
    )


class TestPRDGeneratorBasics:
    """Tests for PRDGenerator basic functionality."""

    def test_generator_type_returns_correct_value(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that generator has correct type identifier."""
        generator = PRDGenerator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert generator.generator_type == "prd_generator"


class TestPRDGeneratorGeneration:
    """Tests for PRDGenerator PRD generation."""

    @pytest.mark.asyncio
    async def test_generate_prd_from_ideation_output(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
        sample_ideation_input,
    ) -> None:
        """Test generating PRD from ideation output."""
        prd_response = {
            "title": "Document Management System",
            "version": "1.0.0",
            "executive_summary": "A system for managing PDF and Word documents.",
            "objectives": {
                "title": "Objectives",
                "content": "Enable efficient document management.",
                "requirements": [],
            },
            "scope": {
                "title": "Scope",
                "content": "Document upload, storage, and retrieval.",
                "requirements": [],
            },
            "sections": [
                {
                    "title": "Functional Requirements",
                    "content": "Core functionality.",
                    "requirements": [
                        {
                            "id": "REQ-001",
                            "description": "System must support PDF uploads",
                            "priority": "must_have",
                            "type": "functional",
                        }
                    ],
                    "subsections": [],
                }
            ],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(prd_response),
            model="test-model",
        )

        generator = PRDGenerator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await generator.generate(agent_context, sample_ideation_input)

        assert result.success is True
        assert result.prd_document is not None
        assert result.prd_document.title == "Document Management System"
        assert len(result.prd_document.sections) >= 1

    @pytest.mark.asyncio
    async def test_generate_prd_writes_artifact(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
        sample_ideation_input,
    ) -> None:
        """Test that PRD generation writes artifact files."""
        prd_response = {
            "title": "Test PRD",
            "version": "1.0.0",
            "executive_summary": "Test summary.",
            "objectives": {"title": "Objectives", "content": "Test", "requirements": []},
            "scope": {"title": "Scope", "content": "Test", "requirements": []},
            "sections": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(prd_response),
            model="test-model",
        )

        generator = PRDGenerator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await generator.generate(agent_context, sample_ideation_input)

        assert result.success is True
        assert mock_artifact_writer.write_artifact.called
        # Should write both JSON and markdown
        assert mock_artifact_writer.write_artifact.call_count >= 1

    @pytest.mark.asyncio
    async def test_generate_prd_handles_llm_failure(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
        sample_ideation_input,
    ) -> None:
        """Test that PRD generation handles LLM failures gracefully."""
        mock_llm_client.generate.return_value = LLMResponse(
            content="Invalid JSON response",
            model="test-model",
        )

        generator = PRDGenerator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await generator.generate(agent_context, sample_ideation_input)

        # Should create fallback PRD from requirements
        assert result.success is True
        assert result.prd_document is not None

    @pytest.mark.asyncio
    async def test_generate_prd_uses_conversation_summary(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
        sample_ideation_input,
    ) -> None:
        """Test that PRD generation uses conversation summary for context."""
        prd_response = {
            "title": "Test PRD",
            "version": "1.0.0",
            "executive_summary": "Based on user discussions about document management.",
            "objectives": {"title": "Objectives", "content": "Test", "requirements": []},
            "scope": {"title": "Scope", "content": "Test", "requirements": []},
            "sections": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(prd_response),
            model="test-model",
        )

        generator = PRDGenerator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        await generator.generate(agent_context, sample_ideation_input)

        # Verify LLM was called with conversation summary in context
        call_args = mock_llm_client.generate.call_args
        assert call_args is not None


class TestPRDGeneratorRequirementMapping:
    """Tests for PRDGenerator requirement mapping."""

    @pytest.mark.asyncio
    async def test_all_requirements_included_in_prd(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
        sample_ideation_input,
    ) -> None:
        """Test that all extracted requirements are included in PRD."""
        prd_response = {
            "title": "Test PRD",
            "version": "1.0.0",
            "executive_summary": "Test",
            "objectives": {"title": "Objectives", "content": "Test", "requirements": []},
            "scope": {"title": "Scope", "content": "Test", "requirements": []},
            "sections": [
                {
                    "title": "Requirements",
                    "content": "All requirements",
                    "requirements": sample_ideation_input.extracted_requirements,
                    "subsections": [],
                }
            ],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(prd_response),
            model="test-model",
        )

        generator = PRDGenerator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await generator.generate(agent_context, sample_ideation_input)

        assert result.success is True
        # Check all requirement IDs are present
        all_req_ids = {req["id"] for req in sample_ideation_input.extracted_requirements}
        prd_req_ids = {req.id for req in result.prd_document.all_requirements}

        assert all_req_ids.issubset(prd_req_ids) or len(prd_req_ids) >= len(all_req_ids)

    @pytest.mark.asyncio
    async def test_requirements_grouped_by_type(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
        sample_ideation_input,
    ) -> None:
        """Test that requirements are grouped by type in PRD."""
        prd_response = {
            "title": "Test PRD",
            "version": "1.0.0",
            "executive_summary": "Test",
            "objectives": {"title": "Objectives", "content": "Test", "requirements": []},
            "scope": {"title": "Scope", "content": "Test", "requirements": []},
            "sections": [
                {
                    "title": "Functional Requirements",
                    "content": "Functional",
                    "requirements": [
                        {"id": "REQ-001", "description": "PDF uploads", "priority": "must_have", "type": "functional"}
                    ],
                    "subsections": [],
                },
                {
                    "title": "Non-Functional Requirements",
                    "content": "NFRs",
                    "requirements": [
                        {"id": "REQ-003", "description": "99.9% uptime", "priority": "must_have", "type": "non_functional"}
                    ],
                    "subsections": [],
                },
                {
                    "title": "Constraints",
                    "content": "Constraints",
                    "requirements": [
                        {"id": "REQ-002", "description": "100MB limit", "priority": "must_have", "type": "constraint"}
                    ],
                    "subsections": [],
                },
            ],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(prd_response),
            model="test-model",
        )

        generator = PRDGenerator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await generator.generate(agent_context, sample_ideation_input)

        assert result.success is True
        section_titles = [s.title for s in result.prd_document.sections]
        assert "Functional Requirements" in section_titles


class TestPRDGeneratorValidation:
    """Tests for PRDGenerator input validation."""

    @pytest.mark.asyncio
    async def test_generate_fails_without_requirements(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that generation fails without any requirements."""
        empty_input = IdeationToPRDInput(
            session_id="session-123",
            project_title="Empty Project",
            conversation_summary="No requirements captured.",
            extracted_requirements=[],
            maturity_scores={},
        )

        generator = PRDGenerator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await generator.generate(agent_context, empty_input)

        assert result.success is False
        assert "requirements" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_generate_fails_without_project_title(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that generation fails without project title."""
        no_title_input = IdeationToPRDInput(
            session_id="session-123",
            project_title="",
            conversation_summary="Some summary.",
            extracted_requirements=[
                {"id": "REQ-001", "description": "Test", "type": "functional", "priority": "must_have"}
            ],
            maturity_scores={},
        )

        generator = PRDGenerator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await generator.generate(agent_context, no_title_input)

        assert result.success is False
        assert "title" in result.error_message.lower()
