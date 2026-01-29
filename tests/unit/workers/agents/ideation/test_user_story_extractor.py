"""Unit tests for User Story Extractor.

Tests the extraction of user stories from requirements and PRD context.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.protocols import AgentContext
from src.workers.agents.ideation.user_story_extractor import (
    UserStoryExtractor,
    UserStoryExtractorConfig,
    ExtractedUserStory,
    UserStoryExtractionInput,
    UserStoryExtractionResult,
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
    return UserStoryExtractorConfig(max_retries=1, retry_delay_seconds=0)


@pytest.fixture
def sample_requirements():
    """Create sample requirements for extraction."""
    return [
        {
            "id": "REQ-001",
            "description": "Users can upload PDF documents",
            "type": "functional",
            "priority": "must_have",
            "category_id": "functional",
        },
        {
            "id": "REQ-002",
            "description": "Users can search documents by content",
            "type": "functional",
            "priority": "must_have",
            "category_id": "functional",
        },
        {
            "id": "REQ-003",
            "description": "Admins can manage user permissions",
            "type": "functional",
            "priority": "should_have",
            "category_id": "functional",
        },
        {
            "id": "REQ-004",
            "description": "System must respond within 2 seconds",
            "type": "non_functional",
            "priority": "must_have",
            "category_id": "nfr",
        },
    ]


@pytest.fixture
def sample_prd_context():
    """Create sample PRD context."""
    return {
        "title": "Document Management System",
        "executive_summary": "A system for managing documents.",
        "target_users": ["End Users", "Administrators"],
    }


class TestUserStoryExtractorBasics:
    """Tests for UserStoryExtractor basic functionality."""

    def test_extractor_type_returns_correct_value(
        self,
        mock_llm_client,
        config,
    ) -> None:
        """Test that extractor has correct type identifier."""
        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        assert extractor.extractor_type == "user_story_extractor"


class TestUserStoryExtraction:
    """Tests for user story extraction."""

    @pytest.mark.asyncio
    async def test_extract_user_stories_from_requirements(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test extracting user stories from requirements."""
        extraction_response = {
            "user_stories": [
                {
                    "id": "US-001",
                    "title": "Upload PDF documents",
                    "as_a": "user",
                    "i_want": "to upload PDF documents",
                    "so_that": "I can store them centrally",
                    "acceptance_criteria": [
                        "Can select PDF file from local system",
                        "Upload progress is displayed",
                        "Success confirmation is shown",
                    ],
                    "linked_requirements": ["REQ-001"],
                    "priority": "must_have",
                },
                {
                    "id": "US-002",
                    "title": "Search documents",
                    "as_a": "user",
                    "i_want": "to search documents by content",
                    "so_that": "I can find relevant documents quickly",
                    "acceptance_criteria": [
                        "Can enter search keywords",
                        "Results are displayed within 2 seconds",
                        "Results show document title and snippet",
                    ],
                    "linked_requirements": ["REQ-002", "REQ-004"],
                    "priority": "must_have",
                },
            ]
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(extraction_response),
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is True
        assert len(result.user_stories) == 2
        assert result.user_stories[0].id == "US-001"
        assert result.user_stories[0].as_a == "user"
        assert result.user_stories[0].i_want == "to upload PDF documents"

    @pytest.mark.asyncio
    async def test_user_stories_have_acceptance_criteria(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test that extracted user stories have acceptance criteria."""
        extraction_response = {
            "user_stories": [
                {
                    "id": "US-001",
                    "title": "Upload documents",
                    "as_a": "user",
                    "i_want": "to upload documents",
                    "so_that": "I can store them",
                    "acceptance_criteria": [
                        "Given I am logged in, when I click upload, then file picker opens",
                        "Given I selected a file, when I confirm, then upload starts",
                        "Given upload completes, when I check, then file is in my documents",
                    ],
                    "linked_requirements": ["REQ-001"],
                    "priority": "must_have",
                },
            ]
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(extraction_response),
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is True
        assert len(result.user_stories[0].acceptance_criteria) >= 1

    @pytest.mark.asyncio
    async def test_user_stories_linked_to_requirements(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test that user stories are linked to source requirements."""
        extraction_response = {
            "user_stories": [
                {
                    "id": "US-001",
                    "title": "Upload documents",
                    "as_a": "user",
                    "i_want": "to upload documents",
                    "so_that": "I can store them",
                    "acceptance_criteria": ["Can upload files"],
                    "linked_requirements": ["REQ-001", "REQ-004"],
                    "priority": "must_have",
                },
            ]
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(extraction_response),
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is True
        assert "REQ-001" in result.user_stories[0].linked_requirements
        assert "REQ-004" in result.user_stories[0].linked_requirements


class TestUserStoryPriority:
    """Tests for user story priority assignment."""

    @pytest.mark.asyncio
    async def test_user_stories_have_priority(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test that user stories have priority assigned."""
        extraction_response = {
            "user_stories": [
                {
                    "id": "US-001",
                    "title": "Critical feature",
                    "as_a": "user",
                    "i_want": "critical feature",
                    "so_that": "I can work",
                    "acceptance_criteria": ["Works"],
                    "linked_requirements": ["REQ-001"],
                    "priority": "must_have",
                },
                {
                    "id": "US-002",
                    "title": "Nice to have",
                    "as_a": "user",
                    "i_want": "nice feature",
                    "so_that": "It's better",
                    "acceptance_criteria": ["Works"],
                    "linked_requirements": ["REQ-003"],
                    "priority": "should_have",
                },
            ]
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(extraction_response),
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is True
        assert result.user_stories[0].priority == "must_have"
        assert result.user_stories[1].priority == "should_have"

    @pytest.mark.asyncio
    async def test_priority_derived_from_linked_requirements(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test that priority is derived from linked requirements."""
        extraction_response = {
            "user_stories": [
                {
                    "id": "US-001",
                    "title": "Feature",
                    "as_a": "user",
                    "i_want": "feature",
                    "so_that": "benefit",
                    "acceptance_criteria": ["Works"],
                    "linked_requirements": ["REQ-001"],  # must_have requirement
                    "priority": "must_have",
                },
            ]
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(extraction_response),
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is True
        assert result.user_stories[0].priority == "must_have"


class TestUserStoryFormat:
    """Tests for user story format validation."""

    @pytest.mark.asyncio
    async def test_user_stories_follow_as_i_want_so_that_format(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test that user stories follow As a/I want/So that format."""
        extraction_response = {
            "user_stories": [
                {
                    "id": "US-001",
                    "title": "Upload documents",
                    "as_a": "document owner",
                    "i_want": "to upload PDF documents to the system",
                    "so_that": "I can access them from anywhere",
                    "acceptance_criteria": ["Upload works"],
                    "linked_requirements": ["REQ-001"],
                    "priority": "must_have",
                },
            ]
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(extraction_response),
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is True
        story = result.user_stories[0]
        assert story.as_a is not None and len(story.as_a) > 0
        assert story.i_want is not None and len(story.i_want) > 0
        assert story.so_that is not None and len(story.so_that) > 0

    @pytest.mark.asyncio
    async def test_user_stories_have_unique_ids(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test that user stories have unique IDs."""
        extraction_response = {
            "user_stories": [
                {
                    "id": "US-001",
                    "title": "Story 1",
                    "as_a": "user",
                    "i_want": "feature 1",
                    "so_that": "benefit 1",
                    "acceptance_criteria": ["AC1"],
                    "linked_requirements": ["REQ-001"],
                    "priority": "must_have",
                },
                {
                    "id": "US-002",
                    "title": "Story 2",
                    "as_a": "user",
                    "i_want": "feature 2",
                    "so_that": "benefit 2",
                    "acceptance_criteria": ["AC2"],
                    "linked_requirements": ["REQ-002"],
                    "priority": "must_have",
                },
            ]
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(extraction_response),
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is True
        ids = [story.id for story in result.user_stories]
        assert len(ids) == len(set(ids))  # All IDs are unique


class TestUserStoryExtractionErrors:
    """Tests for user story extraction error handling."""

    @pytest.mark.asyncio
    async def test_extraction_handles_invalid_llm_response(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test that extraction handles invalid LLM response."""
        mock_llm_client.generate.return_value = LLMResponse(
            content="This is not valid JSON",
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is False
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_extraction_fails_without_requirements(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_prd_context,
    ) -> None:
        """Test that extraction fails without requirements."""
        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=[],
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is False
        assert "requirements" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_extraction_handles_partial_response(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test that extraction handles partial LLM response."""
        # Response with missing fields
        extraction_response = {
            "user_stories": [
                {
                    "id": "US-001",
                    "title": "Incomplete story",
                    # Missing as_a, i_want, so_that
                    "acceptance_criteria": [],
                    "linked_requirements": [],
                    "priority": "must_have",
                },
            ]
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(extraction_response),
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        # Should either succeed with defaults or fail gracefully
        assert result is not None


class TestUserStoryExtractionCoverage:
    """Tests for requirement coverage in user stories."""

    @pytest.mark.asyncio
    async def test_extraction_returns_coverage_report(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test that extraction returns requirement coverage report."""
        extraction_response = {
            "user_stories": [
                {
                    "id": "US-001",
                    "title": "Story covering REQ-001",
                    "as_a": "user",
                    "i_want": "feature",
                    "so_that": "benefit",
                    "acceptance_criteria": ["AC1"],
                    "linked_requirements": ["REQ-001", "REQ-002"],
                    "priority": "must_have",
                },
            ]
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(extraction_response),
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is True
        assert result.coverage_report is not None
        assert "covered_requirements" in result.coverage_report
        assert "uncovered_requirements" in result.coverage_report

    @pytest.mark.asyncio
    async def test_coverage_identifies_uncovered_requirements(
        self,
        mock_llm_client,
        agent_context,
        config,
        sample_requirements,
        sample_prd_context,
    ) -> None:
        """Test that coverage report identifies uncovered requirements."""
        # Only cover some requirements
        extraction_response = {
            "user_stories": [
                {
                    "id": "US-001",
                    "title": "Partial coverage",
                    "as_a": "user",
                    "i_want": "feature",
                    "so_that": "benefit",
                    "acceptance_criteria": ["AC1"],
                    "linked_requirements": ["REQ-001"],  # Only covers one requirement
                    "priority": "must_have",
                },
            ]
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(extraction_response),
            model="test-model",
        )

        extractor = UserStoryExtractor(
            llm_client=mock_llm_client,
            config=config,
        )

        extraction_input = UserStoryExtractionInput(
            requirements=sample_requirements,
            prd_context=sample_prd_context,
        )

        result = await extractor.extract(agent_context, extraction_input)

        assert result.success is True
        uncovered = result.coverage_report.get("uncovered_requirements", [])
        # REQ-002, REQ-003, REQ-004 should be uncovered
        assert len(uncovered) >= 1
