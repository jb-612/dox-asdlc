"""Unit tests for Planner Agent."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    ComplexityLevel,
)
from src.workers.agents.design.planner_agent import (
    PlannerAgent,
    _build_planner_prompt,
    _parse_plan_from_result,
    _convert_legacy_format,
    _build_implementation_plan,
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
def sample_features_response() -> str:
    """Sample response in new features format."""
    return json.dumps({
        "features": [
            {
                "id": "F01",
                "name": "User Management",
                "description": "User registration and authentication",
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
                ],
            },
            {
                "id": "F02",
                "name": "User API",
                "description": "REST API for user operations",
                "tasks": [
                    {
                        "id": "T003",
                        "title": "Implement User API",
                        "description": "Create REST endpoints for User CRUD",
                        "component": "UserService",
                        "dependencies": ["T002"],
                        "acceptance_criteria": [
                            "CRUD endpoints implemented",
                        ],
                        "estimated_complexity": "L",
                    },
                ],
            },
        ],
        "phases": [
            {
                "name": "Phase 1: Setup",
                "description": "Infrastructure setup",
                "task_ids": ["T001"],
                "order": 1,
            },
            {
                "name": "Phase 2: Core",
                "description": "Core implementation",
                "task_ids": ["T002", "T003"],
                "order": 2,
            },
        ],
        "critical_path": ["T001", "T002", "T003"],
    })


@pytest.fixture
def sample_legacy_response() -> str:
    """Sample response in legacy flat-tasks format."""
    return json.dumps({
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
        ],
        "total_task_count": 1,
        "components_covered": ["Infrastructure"],
    })


class TestPlannerAgentInit:
    """Tests for Planner Agent initialization."""

    def test_agent_type(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        backend = MockBackend()
        agent = PlannerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )
        assert agent.agent_type == "planner_agent"


class TestPlannerAgentExecute:
    """Tests for Planner Agent execute method."""

    @pytest.mark.asyncio
    async def test_execute_success(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_features_response: str,
    ) -> None:
        """Test successful execution with features format."""
        backend = MockBackend(
            result=BackendResult(
                success=True,
                output=sample_features_response,
                cost_usd=0.05,
                turns=3,
            )
        )

        agent = PlannerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "prd_content": "Build a user management API.",
                "architecture_reference": "ARCH-001",
            },
        )

        assert result.success is True
        assert result.agent_type == "planner_agent"
        assert result.task_id == agent_context.task_id
        assert len(result.artifact_paths) > 0
        assert result.metadata["feature_count"] == 2
        assert result.metadata["task_count"] == 3
        assert result.metadata["phase_count"] == 2
        assert result.metadata["backend"] == "mock-backend"
        assert result.metadata["cost_usd"] == 0.05

    @pytest.mark.asyncio
    async def test_execute_with_structured_output(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution with structured output (from --json-schema)."""
        structured = {
            "features": [
                {
                    "id": "F01",
                    "name": "Auth",
                    "tasks": [
                        {"id": "T001", "title": "Login", "description": "Login flow"},
                    ],
                }
            ],
        }
        backend = MockBackend(
            result=BackendResult(
                success=True,
                output="",
                structured_output=structured,
            )
        )

        agent = PlannerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"prd_content": "Auth system PRD"},
        )

        assert result.success is True
        assert result.metadata["feature_count"] == 1
        assert result.metadata["task_count"] == 1

    @pytest.mark.asyncio
    async def test_execute_missing_prd_content(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution fails without PRD content."""
        backend = MockBackend()
        agent = PlannerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={},
        )

        assert result.success is False
        assert "prd_content" in result.error_message
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_backend_failure(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution handles backend failure."""
        backend = MockBackend(
            result=BackendResult(
                success=False,
                error="CLI timed out after 300s",
            )
        )

        agent = PlannerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"prd_content": "PRD"},
        )

        assert result.success is False
        assert "timed out" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_backend_exception(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution handles backend exception."""
        backend = MockBackend(error=ConnectionError("Redis down"))

        agent = PlannerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"prd_content": "PRD"},
        )

        assert result.success is False
        assert "Backend error" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_unparseable_output(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution handles unparseable backend output."""
        backend = MockBackend(
            result=BackendResult(
                success=True,
                output="This is not JSON at all",
            )
        )

        agent = PlannerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"prd_content": "PRD"},
        )

        assert result.success is False
        assert "parse" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_execute_legacy_format(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_legacy_response: str,
    ) -> None:
        """Test execution with legacy flat-tasks format."""
        backend = MockBackend(
            result=BackendResult(success=True, output=sample_legacy_response)
        )

        agent = PlannerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"prd_content": "PRD"},
        )

        assert result.success is True
        assert result.metadata["feature_count"] == 1
        assert result.metadata["task_count"] == 1

    @pytest.mark.asyncio
    async def test_execute_passes_config_to_backend(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_features_response: str,
    ) -> None:
        """Test that config is passed through to backend."""
        backend = MockBackend(
            result=BackendResult(success=True, output=sample_features_response)
        )

        agent = PlannerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        await agent.execute(
            context=agent_context,
            event_metadata={"prd_content": "PRD"},
        )

        assert len(backend.execute_calls) == 1
        call = backend.execute_calls[0]
        assert call["workspace_path"] == "/test/workspace"
        assert call["config"].output_schema is not None
        assert call["config"].system_prompt is not None


class TestParsePlanFromResult:
    """Tests for plan parsing from backend result."""

    def test_parse_structured_output(self) -> None:
        """Test parsing from structured_output field."""
        data = {"features": [{"id": "F01", "name": "X", "tasks": []}]}
        result = BackendResult(
            success=True,
            output="",
            structured_output=data,
        )
        parsed = _parse_plan_from_result(result)
        assert parsed == data

    def test_parse_json_output(self) -> None:
        """Test parsing JSON from output string."""
        data = {"features": [{"id": "F01", "name": "X", "tasks": []}]}
        result = BackendResult(success=True, output=json.dumps(data))
        parsed = _parse_plan_from_result(result)
        assert parsed == data

    def test_parse_json_in_code_block(self) -> None:
        """Test parsing JSON from markdown code block."""
        data = {"features": [{"id": "F01", "name": "X", "tasks": []}]}
        output = f"Here's the plan:\n```json\n{json.dumps(data)}\n```\n"
        result = BackendResult(success=True, output=output)
        parsed = _parse_plan_from_result(result)
        assert parsed == data

    def test_parse_legacy_format(self) -> None:
        """Test parsing legacy flat-tasks format."""
        data = {"tasks": [{"id": "T001"}]}
        result = BackendResult(success=True, output=json.dumps(data))
        parsed = _parse_plan_from_result(result)
        assert parsed is not None
        assert "features" in parsed
        assert parsed["features"][0]["tasks"] == [{"id": "T001"}]

    def test_parse_empty_output(self) -> None:
        """Test parsing empty output returns None."""
        result = BackendResult(success=True, output="")
        assert _parse_plan_from_result(result) is None

    def test_parse_invalid_json(self) -> None:
        """Test parsing invalid content returns None."""
        result = BackendResult(success=True, output="not json at all")
        assert _parse_plan_from_result(result) is None


class TestConvertLegacyFormat:
    """Tests for legacy format conversion."""

    def test_wraps_tasks_in_feature(self) -> None:
        data = {"tasks": [{"id": "T001"}], "phases": []}
        converted = _convert_legacy_format(data)
        assert len(converted["features"]) == 1
        assert converted["features"][0]["id"] == "F01"
        assert converted["features"][0]["tasks"] == [{"id": "T001"}]

    def test_preserves_phases_and_critical_path(self) -> None:
        data = {
            "tasks": [],
            "phases": [{"name": "P1"}],
            "critical_path": ["T001"],
        }
        converted = _convert_legacy_format(data)
        assert converted["phases"] == [{"name": "P1"}]
        assert converted["critical_path"] == ["T001"]


class TestBuildImplementationPlan:
    """Tests for implementation plan building."""

    def test_builds_from_features(self) -> None:
        plan_data = {
            "features": [
                {
                    "id": "F01",
                    "name": "Auth",
                    "tasks": [
                        {
                            "id": "T001",
                            "title": "Login",
                            "description": "Login flow",
                            "component": "Auth",
                            "estimated_complexity": "S",
                        },
                    ],
                },
            ],
            "critical_path": ["T001"],
        }

        plan = _build_implementation_plan(plan_data, "ARCH-001")

        assert len(plan.tasks) == 1
        assert plan.tasks[0].id == "T001"
        assert plan.tasks[0].estimated_complexity == ComplexityLevel.SMALL
        assert plan.tasks[0].metadata["feature_id"] == "F01"
        assert plan.architecture_reference == "ARCH-001"

    def test_creates_phases_from_features_when_missing(self) -> None:
        plan_data = {
            "features": [
                {"id": "F01", "name": "Auth", "tasks": [{"id": "T001", "title": "X", "description": "Y"}]},
                {"id": "F02", "name": "API", "tasks": [{"id": "T002", "title": "Z", "description": "W"}]},
            ],
        }

        plan = _build_implementation_plan(plan_data, "ARCH-001")

        assert len(plan.phases) == 2
        assert plan.phases[0].name == "Phase 1: Auth"
        assert plan.phases[1].name == "Phase 2: API"

    def test_uses_explicit_phases(self) -> None:
        plan_data = {
            "features": [
                {"id": "F01", "name": "Auth", "tasks": [{"id": "T001", "title": "X", "description": "Y"}]},
            ],
            "phases": [
                {"name": "Setup", "description": "Setup phase", "task_ids": ["T001"], "order": 1},
            ],
        }

        plan = _build_implementation_plan(plan_data, "ARCH-001")

        assert len(plan.phases) == 1
        assert plan.phases[0].name == "Setup"

    def test_invalid_complexity_defaults_to_medium(self) -> None:
        plan_data = {
            "features": [
                {
                    "id": "F01",
                    "name": "X",
                    "tasks": [
                        {"id": "T001", "title": "X", "description": "Y", "estimated_complexity": "INVALID"},
                    ],
                },
            ],
        }

        plan = _build_implementation_plan(plan_data, "ARCH-001")
        assert plan.tasks[0].estimated_complexity == ComplexityLevel.MEDIUM

    def test_component_falls_back_to_feature_name(self) -> None:
        plan_data = {
            "features": [
                {
                    "id": "F01",
                    "name": "Auth",
                    "tasks": [
                        {"id": "T001", "title": "X", "description": "Y"},
                    ],
                },
            ],
        }

        plan = _build_implementation_plan(plan_data, "ARCH-001")
        assert plan.tasks[0].component == "Auth"


class TestBuildPlannerPrompt:
    """Tests for prompt building."""

    def test_includes_prd(self) -> None:
        prompt = _build_planner_prompt(prd_content="My PRD")
        assert "My PRD" in prompt
        assert "## PRD Document" in prompt

    def test_includes_optional_sections(self) -> None:
        prompt = _build_planner_prompt(
            prd_content="PRD",
            architecture="ARCH",
            tech_survey="SURVEY",
            acceptance_criteria="AC",
        )
        assert "## Architecture" in prompt
        assert "ARCH" in prompt
        assert "## Technology Survey" in prompt
        assert "SURVEY" in prompt
        assert "## Acceptance Criteria" in prompt
        assert "AC" in prompt

    def test_omits_empty_sections(self) -> None:
        prompt = _build_planner_prompt(prd_content="PRD")
        assert "## Architecture" not in prompt
        assert "## Technology Survey" not in prompt
        assert "## Acceptance Criteria" not in prompt


class TestPlannerAgentValidation:
    """Tests for context validation."""

    def test_validate_context_valid(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        backend = MockBackend()
        agent = PlannerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )
        assert agent.validate_context(agent_context) is True

    def test_validate_context_invalid(
        self,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        backend = MockBackend()
        agent = PlannerAgent(
            backend=backend,
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
