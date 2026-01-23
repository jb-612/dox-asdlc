"""Unit tests for Planner Agent."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    ComplexityLevel,
    ImplementationPlan,
    ImplementationTask,
    Phase,
)
from src.workers.agents.design.planner_agent import PlannerAgent, PlannerAgentError


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
    writer.write_artifact = AsyncMock(return_value="/artifacts/test_plan.json")
    return writer


@pytest.fixture
def default_config() -> DesignConfig:
    """Create default config for testing."""
    return DesignConfig(
        max_retries=2,
        retry_delay_seconds=0.01,
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
def sample_task_breakdown_response() -> str:
    """Sample task breakdown response."""
    return json.dumps({
        "tasks": [
            {
                "id": "T001",
                "title": "Setup project infrastructure",
                "description": "Initialize project and configure build tools",
                "component": "Infrastructure",
                "dependencies": [],
                "acceptance_criteria": [
                    "Project builds successfully",
                    "CI pipeline configured",
                ],
                "estimated_complexity": "M",
            },
            {
                "id": "T002",
                "title": "Implement User model",
                "description": "Create User entity with validation",
                "component": "UserService",
                "dependencies": ["T001"],
                "acceptance_criteria": [
                    "User model with required fields",
                    "Database migrations created",
                ],
                "estimated_complexity": "M",
            },
            {
                "id": "T003",
                "title": "Implement User API",
                "description": "Create REST endpoints for User CRUD",
                "component": "UserService",
                "dependencies": ["T002"],
                "acceptance_criteria": [
                    "CRUD endpoints implemented",
                    "API documentation generated",
                ],
                "estimated_complexity": "L",
            },
        ],
        "total_task_count": 3,
        "components_covered": ["Infrastructure", "UserService"],
    })


@pytest.fixture
def sample_dependency_analysis_response() -> str:
    """Sample dependency analysis response."""
    return json.dumps({
        "refined_dependencies": [
            {"task_id": "T001", "dependencies": [], "reason": "No changes"},
            {"task_id": "T002", "dependencies": ["T001"], "reason": "No changes"},
            {"task_id": "T003", "dependencies": ["T002"], "reason": "No changes"},
        ],
        "circular_dependencies": [],
        "parallelizable_groups": [],
        "dependency_graph": {
            "T001": ["T002"],
            "T002": ["T003"],
            "T003": [],
        },
    })


@pytest.fixture
def sample_complexity_estimation_response() -> str:
    """Sample complexity estimation response."""
    return json.dumps({
        "estimations": [
            {
                "task_id": "T001",
                "complexity": "M",
                "hours_estimate": 6,
                "risk_level": "low",
                "factors": ["Standard setup"],
                "recommendations": [],
            },
            {
                "task_id": "T002",
                "complexity": "M",
                "hours_estimate": 8,
                "risk_level": "medium",
                "factors": ["Database integration"],
                "recommendations": ["Use ORM"],
            },
            {
                "task_id": "T003",
                "complexity": "L",
                "hours_estimate": 12,
                "risk_level": "medium",
                "factors": ["API design", "Testing"],
                "recommendations": [],
            },
        ],
        "total_hours": 26,
        "high_risk_tasks": [],
        "complexity_distribution": {"S": 0, "M": 2, "L": 1, "XL": 0},
    })


@pytest.fixture
def sample_critical_path_response() -> str:
    """Sample critical path response."""
    return json.dumps({
        "critical_path": ["T001", "T002", "T003"],
        "critical_path_duration_hours": 26,
        "phases": [
            {
                "name": "Phase 1: Setup",
                "description": "Infrastructure setup",
                "task_ids": ["T001"],
                "order": 1,
                "estimated_hours": 6,
            },
            {
                "name": "Phase 2: Core",
                "description": "Core implementation",
                "task_ids": ["T002", "T003"],
                "order": 2,
                "estimated_hours": 20,
            },
        ],
        "slack_analysis": [],
        "milestones": [
            {
                "name": "Infrastructure Complete",
                "after_task": "T001",
                "description": "Project setup complete",
            }
        ],
        "total_estimated_hours": 26,
        "parallel_efficiency": 1.0,
    })


class TestPlannerAgentInit:
    """Tests for Planner Agent initialization."""

    def test_agent_type(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test agent type property."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )
        assert agent.agent_type == "planner_agent"


class TestPlannerAgentExecute:
    """Tests for Planner Agent execute method."""

    @pytest.mark.asyncio
    async def test_execute_success(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_task_breakdown_response: str,
        sample_dependency_analysis_response: str,
        sample_critical_path_response: str,
    ) -> None:
        """Test successful execution."""
        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_task_breakdown_response),
            MockLLMResponse(content=sample_dependency_analysis_response),
            MockLLMResponse(content=sample_critical_path_response),
        ]

        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "architecture": '{"components": []}',
                "prd_content": "Build a user management API.",
                "architecture_reference": "ARCH-001",
            },
        )

        assert result.success is True
        assert result.agent_type == "planner_agent"
        assert result.task_id == agent_context.task_id
        assert len(result.artifact_paths) > 0
        assert result.metadata["task_count"] == 3
        assert result.metadata["phase_count"] == 2

    @pytest.mark.asyncio
    async def test_execute_with_complexity_estimation(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_task_breakdown_response: str,
        sample_dependency_analysis_response: str,
        sample_complexity_estimation_response: str,
        sample_critical_path_response: str,
    ) -> None:
        """Test execution with complexity estimation."""
        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_task_breakdown_response),
            MockLLMResponse(content=sample_dependency_analysis_response),
            MockLLMResponse(content=sample_complexity_estimation_response),
            MockLLMResponse(content=sample_critical_path_response),
        ]

        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "architecture": '{}',
                "prd_content": "PRD",
                "tech_survey": '{"technologies": []}',  # Triggers complexity estimation
            },
        )

        assert result.success is True
        # Should have called generate 4 times (breakdown, deps, complexity, critical)
        assert mock_llm_client.generate.call_count == 4

    @pytest.mark.asyncio
    async def test_execute_missing_architecture(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution fails without architecture."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "prd_content": "Some PRD",
            },
        )

        assert result.success is False
        assert "architecture" in result.error_message
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_missing_prd_content(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution fails without PRD content."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "architecture": '{}',
            },
        )

        assert result.success is False
        assert "prd_content" in result.error_message
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_task_breakdown_failure(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution handles task breakdown failure."""
        mock_llm_client.generate.return_value = MockLLMResponse(
            content="not valid json"
        )

        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "architecture": '{}',
                "prd_content": "PRD",
            },
        )

        assert result.success is False
        assert "break down" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_continues_with_dependency_failure(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_task_breakdown_response: str,
        sample_critical_path_response: str,
    ) -> None:
        """Test execution continues if dependency analysis fails."""
        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_task_breakdown_response),
            MockLLMResponse(content="invalid"),  # Dependency analysis fails
            MockLLMResponse(content=sample_critical_path_response),
        ]

        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "architecture": '{}',
                "prd_content": "PRD",
            },
        )

        # Should still succeed
        assert result.success is True


class TestPlannerAgentBuilding:
    """Tests for implementation plan building methods."""

    def test_build_implementation_plan(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test building ImplementationPlan from data."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        tasks_data = {
            "tasks": [
                {
                    "id": "T001",
                    "title": "Setup",
                    "description": "Initial setup",
                    "component": "Infrastructure",
                    "dependencies": [],
                    "acceptance_criteria": ["Works"],
                    "estimated_complexity": "S",
                },
                {
                    "id": "T002",
                    "title": "Implement",
                    "description": "Core implementation",
                    "component": "Core",
                    "dependencies": ["T001"],
                    "acceptance_criteria": ["Tests pass"],
                    "estimated_complexity": "M",
                },
            ]
        }

        critical_path_data = {
            "critical_path": ["T001", "T002"],
            "phases": [
                {
                    "name": "Phase 1",
                    "description": "Setup phase",
                    "task_ids": ["T001"],
                    "order": 1,
                },
                {
                    "name": "Phase 2",
                    "description": "Implementation phase",
                    "task_ids": ["T002"],
                    "order": 2,
                },
            ],
        }

        plan = agent._build_implementation_plan(
            tasks_data=tasks_data,
            critical_path_data=critical_path_data,
            architecture_reference="ARCH-001",
        )

        assert len(plan.tasks) == 2
        assert plan.tasks[0].id == "T001"
        assert plan.tasks[0].estimated_complexity == ComplexityLevel.SMALL
        assert plan.tasks[1].estimated_complexity == ComplexityLevel.MEDIUM
        assert len(plan.phases) == 2
        assert plan.critical_path == ["T001", "T002"]
        assert plan.architecture_reference == "ARCH-001"

    def test_build_implementation_plan_invalid_complexity(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test fallback for invalid complexity level."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        tasks_data = {
            "tasks": [
                {
                    "id": "T001",
                    "title": "Task",
                    "description": "Desc",
                    "component": "Comp",
                    "dependencies": [],
                    "acceptance_criteria": [],
                    "estimated_complexity": "INVALID",
                }
            ]
        }

        plan = agent._build_implementation_plan(
            tasks_data=tasks_data,
            critical_path_data=None,
            architecture_reference="ARCH-001",
        )

        # Should fallback to MEDIUM
        assert plan.tasks[0].estimated_complexity == ComplexityLevel.MEDIUM

    def test_build_implementation_plan_no_critical_path(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test building plan without critical path data."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        tasks_data = {
            "tasks": [
                {
                    "id": "T001",
                    "title": "Task",
                    "description": "Desc",
                    "component": "Comp",
                    "dependencies": [],
                    "acceptance_criteria": [],
                    "estimated_complexity": "M",
                }
            ]
        }

        plan = agent._build_implementation_plan(
            tasks_data=tasks_data,
            critical_path_data=None,
            architecture_reference="ARCH-001",
        )

        # Should create default phase
        assert len(plan.phases) == 1
        assert plan.phases[0].name == "Implementation"
        assert "T001" in plan.phases[0].task_ids


class TestPlannerAgentHelpers:
    """Tests for helper methods."""

    def test_apply_dependency_refinements(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test applying dependency refinements."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        tasks_data = {
            "tasks": [
                {"id": "T001", "dependencies": []},
                {"id": "T002", "dependencies": ["T001"]},
            ]
        }

        dep_analysis = {
            "refined_dependencies": [
                {"task_id": "T001", "dependencies": []},
                {"task_id": "T002", "dependencies": []},  # Removed T001
            ]
        }

        result = agent._apply_dependency_refinements(tasks_data, dep_analysis)

        assert result["tasks"][1]["dependencies"] == []

    def test_apply_complexity_updates(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test applying complexity updates."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        tasks_data = {
            "tasks": [
                {"id": "T001", "estimated_complexity": "M"},
                {"id": "T002", "estimated_complexity": "M"},
            ]
        }

        complexity_data = {
            "estimations": [
                {"task_id": "T001", "complexity": "S"},
                {"task_id": "T002", "complexity": "L"},
            ]
        }

        result = agent._apply_complexity_updates(tasks_data, complexity_data)

        assert result["tasks"][0]["estimated_complexity"] == "S"
        assert result["tasks"][1]["estimated_complexity"] == "L"

    def test_validate_context_valid(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test context validation with valid context."""
        agent = PlannerAgent(
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
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        invalid_context = AgentContext(
            session_id="",
            task_id="task-123",
            tenant_id="tenant",
            workspace_path="/test",
        )

        assert agent.validate_context(invalid_context) is False


class TestPlannerAgentJsonParsing:
    """Tests for JSON parsing in Planner Agent."""

    def test_parse_direct_json(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test parsing direct JSON response."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        content = '{"tasks": []}'
        result = agent._parse_json_from_response(content)

        assert result == {"tasks": []}

    def test_parse_json_in_code_block(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test parsing JSON from code block."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        content = """Here's the plan:
```json
{"tasks": [{"id": "T001"}]}
```
"""
        result = agent._parse_json_from_response(content)

        assert result == {"tasks": [{"id": "T001"}]}

    def test_parse_invalid_json(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test parsing invalid JSON returns None."""
        agent = PlannerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        content = "this is not json"
        result = agent._parse_json_from_response(content)

        assert result is None
