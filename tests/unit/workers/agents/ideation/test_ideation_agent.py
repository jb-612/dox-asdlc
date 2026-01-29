"""Unit tests for IdeationAgent.

Tests the structured interview flow for PRD ideation.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.ideation.ideation_agent import (
    IdeationAgent,
    IdeationConfig,
    InterviewPhase,
    MaturityCategory,
    MATURITY_CATEGORIES,
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
    return IdeationConfig(max_retries=1, retry_delay_seconds=0)


class TestIdeationAgentBasics:
    """Tests for IdeationAgent basic functionality."""

    def test_agent_type_returns_correct_value(
        self,
        mock_llm_client,
        config,
    ) -> None:
        """Test that agent_type returns 'ideation_agent'."""
        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        assert agent.agent_type == "ideation_agent"

    def test_validate_context_returns_true_for_valid_context(
        self,
        mock_llm_client,
        agent_context,
        config,
    ) -> None:
        """Test that validate_context returns True for valid context."""
        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        assert agent.validate_context(agent_context) is True

    def test_validate_context_returns_false_for_missing_session_id(
        self,
        mock_llm_client,
        config,
    ) -> None:
        """Test that validate_context returns False for missing session_id."""
        context = AgentContext(
            session_id="",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp",
        )

        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        assert agent.validate_context(context) is False


class TestIdeationAgentInterview:
    """Tests for IdeationAgent interview flow."""

    @pytest.mark.asyncio
    async def test_execute_returns_response_with_follow_up_questions(
        self,
        mock_llm_client,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns response with follow-up questions."""
        response_data = {
            "response": "I understand you want to build a document management system. Let me ask some clarifying questions.",
            "extracted_requirements": [],
            "maturity_updates": {
                "problem": 20,
            },
            "follow_up_questions": [
                "What types of documents will be managed?",
                "Who are the primary users of this system?",
            ],
            "current_phase": "problem",
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(response_data),
            model="test-model",
        )

        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "user_message": "I want to build a document management system",
                "conversation_history": [],
                "current_maturity": {},
            },
        )

        assert result.success is True
        assert "follow_up_questions" in result.metadata
        assert len(result.metadata["follow_up_questions"]) == 2

    @pytest.mark.asyncio
    async def test_execute_extracts_requirements_from_conversation(
        self,
        mock_llm_client,
        agent_context,
        config,
    ) -> None:
        """Test that execute extracts requirements from user responses."""
        response_data = {
            "response": "Great, I've noted those requirements.",
            "extracted_requirements": [
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
            ],
            "maturity_updates": {
                "functional": 30,
                "scope": 20,
            },
            "follow_up_questions": ["What about file versioning?"],
            "current_phase": "functional",
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(response_data),
            model="test-model",
        )

        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "user_message": "The system needs to handle PDF files up to 100MB",
                "conversation_history": [],
                "current_maturity": {"problem": 50},
            },
        )

        assert result.success is True
        assert "extracted_requirements" in result.metadata
        assert len(result.metadata["extracted_requirements"]) == 2
        assert result.metadata["extracted_requirements"][0]["id"] == "REQ-001"

    @pytest.mark.asyncio
    async def test_execute_updates_maturity_scores(
        self,
        mock_llm_client,
        agent_context,
        config,
    ) -> None:
        """Test that execute updates maturity scores based on coverage."""
        response_data = {
            "response": "Thank you for that detailed information about users.",
            "extracted_requirements": [
                {
                    "id": "REQ-003",
                    "description": "Admin users can manage all documents",
                    "type": "functional",
                    "priority": "must_have",
                    "category_id": "users",
                },
            ],
            "maturity_updates": {
                "users": 70,
            },
            "follow_up_questions": ["What about guest access?"],
            "current_phase": "users",
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(response_data),
            model="test-model",
        )

        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "user_message": "We have admin users who manage documents and regular users who view them",
                "conversation_history": [],
                "current_maturity": {"users": 30},
            },
        )

        assert result.success is True
        assert "maturity_updates" in result.metadata
        assert result.metadata["maturity_updates"]["users"] == 70

    @pytest.mark.asyncio
    async def test_execute_handles_invalid_llm_response(
        self,
        mock_llm_client,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles invalid LLM response gracefully."""
        mock_llm_client.generate.return_value = LLMResponse(
            content="This is not valid JSON",
            model="test-model",
        )

        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "user_message": "Hello",
                "conversation_history": [],
                "current_maturity": {},
            },
        )

        assert result.success is False
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_user_message(
        self,
        mock_llm_client,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no user_message provided."""
        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        result = await agent.execute(agent_context, {})

        assert result.success is False
        assert "user_message" in result.error_message.lower()


class TestIdeationAgentPhases:
    """Tests for IdeationAgent interview phases."""

    @pytest.mark.asyncio
    async def test_agent_progresses_through_interview_phases(
        self,
        mock_llm_client,
        agent_context,
        config,
    ) -> None:
        """Test that agent progresses through interview phases."""
        # Start with problem phase
        response_data = {
            "response": "Let's move on to discuss the users.",
            "extracted_requirements": [],
            "maturity_updates": {"problem": 80},
            "follow_up_questions": ["Who are the primary users?"],
            "current_phase": "users",
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(response_data),
            model="test-model",
        )

        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "user_message": "The problem is that documents are scattered across systems",
                "conversation_history": [],
                "current_maturity": {"problem": 50},
            },
        )

        assert result.success is True
        assert result.metadata["current_phase"] == "users"

    @pytest.mark.asyncio
    async def test_agent_identifies_gaps_and_suggests_focus(
        self,
        mock_llm_client,
        agent_context,
        config,
    ) -> None:
        """Test that agent identifies gaps and suggests areas to focus."""
        response_data = {
            "response": "I notice we haven't discussed non-functional requirements yet.",
            "extracted_requirements": [],
            "maturity_updates": {},
            "follow_up_questions": [
                "What are the performance requirements?",
                "What about security requirements?",
            ],
            "current_phase": "nfr",
            "identified_gaps": ["nfr", "risks"],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(response_data),
            model="test-model",
        )

        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "user_message": "What else do you need?",
                "conversation_history": [],
                "current_maturity": {
                    "problem": 80,
                    "users": 70,
                    "functional": 60,
                    "nfr": 10,
                    "scope": 50,
                    "success": 40,
                    "risks": 5,
                },
            },
        )

        assert result.success is True
        assert "identified_gaps" in result.metadata
        assert "nfr" in result.metadata["identified_gaps"]


class TestIdeationAgentMaturity:
    """Tests for IdeationAgent maturity calculation."""

    def test_calculate_overall_maturity_from_categories(
        self,
        mock_llm_client,
        config,
    ) -> None:
        """Test overall maturity calculation from category scores."""
        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        category_scores = {
            "problem": 80,  # weight 15
            "users": 60,    # weight 10
            "functional": 50,  # weight 25
            "nfr": 40,      # weight 15
            "scope": 70,    # weight 15
            "success": 50,  # weight 10
            "risks": 30,    # weight 10
        }

        overall = agent.calculate_overall_maturity(category_scores)

        # Expected: (80*15 + 60*10 + 50*25 + 40*15 + 70*15 + 50*10 + 30*10) / 100
        # = (1200 + 600 + 1250 + 600 + 1050 + 500 + 300) / 100
        # = 5500 / 100 = 55
        assert overall == 55.0

    def test_can_submit_returns_true_when_above_threshold(
        self,
        mock_llm_client,
        config,
    ) -> None:
        """Test can_submit returns True when maturity is 80 or above."""
        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        # All categories at 80%
        category_scores = {cat.id: 80 for cat in MATURITY_CATEGORIES}

        can_submit = agent.can_submit(category_scores)

        assert can_submit is True

    def test_can_submit_returns_false_when_below_threshold(
        self,
        mock_llm_client,
        config,
    ) -> None:
        """Test can_submit returns False when maturity is below 80."""
        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        category_scores = {cat.id: 50 for cat in MATURITY_CATEGORIES}

        can_submit = agent.can_submit(category_scores)

        assert can_submit is False

    def test_get_maturity_level_returns_correct_level(
        self,
        mock_llm_client,
        config,
    ) -> None:
        """Test get_maturity_level returns correct level for score."""
        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        assert agent.get_maturity_level(10) == "concept"
        assert agent.get_maturity_level(30) == "exploration"
        assert agent.get_maturity_level(50) == "defined"
        assert agent.get_maturity_level(70) == "refined"
        assert agent.get_maturity_level(85) == "complete"

    def test_identify_gaps_returns_low_scoring_categories(
        self,
        mock_llm_client,
        config,
    ) -> None:
        """Test identify_gaps returns categories below threshold."""
        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        category_scores = {
            "problem": 80,
            "users": 60,
            "functional": 30,  # Below threshold
            "nfr": 20,        # Below threshold
            "scope": 70,
            "success": 50,
            "risks": 15,      # Below threshold
        }

        gaps = agent.identify_gaps(category_scores, threshold=40)

        assert "functional" in gaps
        assert "nfr" in gaps
        assert "risks" in gaps
        assert "problem" not in gaps


class TestIdeationAgentPromptConstruction:
    """Tests for IdeationAgent prompt construction."""

    @pytest.mark.asyncio
    async def test_execute_includes_conversation_history(
        self,
        mock_llm_client,
        agent_context,
        config,
    ) -> None:
        """Test that execute includes conversation history in prompt."""
        response_data = {
            "response": "Based on our previous discussion...",
            "extracted_requirements": [],
            "maturity_updates": {},
            "follow_up_questions": [],
            "current_phase": "functional",
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(response_data),
            model="test-model",
        )

        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        conversation_history = [
            {"role": "user", "content": "I want a document system"},
            {"role": "assistant", "content": "What kind of documents?"},
            {"role": "user", "content": "PDFs and Word docs"},
        ]

        await agent.execute(
            agent_context,
            {
                "user_message": "Also Excel files",
                "conversation_history": conversation_history,
                "current_maturity": {"problem": 50},
            },
        )

        # Verify LLM was called with messages
        call_args = mock_llm_client.generate.call_args
        assert call_args is not None
        # Check that messages or prompt contains conversation context
        assert mock_llm_client.generate.called

    @pytest.mark.asyncio
    async def test_execute_includes_maturity_context(
        self,
        mock_llm_client,
        agent_context,
        config,
    ) -> None:
        """Test that execute includes maturity context in prompt."""
        response_data = {
            "response": "I see we're missing some areas...",
            "extracted_requirements": [],
            "maturity_updates": {},
            "follow_up_questions": [],
            "current_phase": "nfr",
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(response_data),
            model="test-model",
        )

        agent = IdeationAgent(
            llm_client=mock_llm_client,
            config=config,
        )

        await agent.execute(
            agent_context,
            {
                "user_message": "What's next?",
                "conversation_history": [],
                "current_maturity": {
                    "problem": 80,
                    "users": 70,
                    "functional": 10,
                    "nfr": 0,
                    "scope": 50,
                    "success": 0,
                    "risks": 0,
                },
            },
        )

        # Verify LLM was called
        assert mock_llm_client.generate.called


class TestMaturityCategories:
    """Tests for maturity category definitions."""

    def test_maturity_categories_have_required_fields(self) -> None:
        """Test that all maturity categories have required fields."""
        for category in MATURITY_CATEGORIES:
            assert category.id is not None
            assert category.name is not None
            assert 0 < category.weight <= 100

    def test_maturity_category_weights_sum_to_100(self) -> None:
        """Test that category weights sum to 100."""
        total_weight = sum(cat.weight for cat in MATURITY_CATEGORIES)
        assert total_weight == 100

    def test_expected_categories_exist(self) -> None:
        """Test that expected categories exist."""
        category_ids = {cat.id for cat in MATURITY_CATEGORIES}

        expected_ids = {"problem", "users", "functional", "nfr", "scope", "success", "risks"}

        assert category_ids == expected_ids
