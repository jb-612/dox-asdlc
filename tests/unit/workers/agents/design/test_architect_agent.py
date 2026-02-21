"""Unit tests for Architect Agent."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    Architecture,
    ArchitectureStyle,
    Component,
    DataFlow,
    DiagramReference,
    DiagramType,
)
from src.workers.agents.design.architect_agent import (
    ArchitectAgent,
    ArchitectAgentError,
    _build_architect_prompt,
    _parse_design_from_result,
    ARCHITECT_OUTPUT_SCHEMA,
    ARCHITECT_SYSTEM_PROMPT,
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
    writer.write_artifact = AsyncMock(return_value="/artifacts/test_architecture.json")
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
def sample_combined_design() -> dict[str, Any]:
    """Sample combined design response with components and diagrams."""
    return {
        "architecture_style": "modular_monolith",
        "style_rationale": "Allows rapid development with clear boundaries",
        "components": [
            {
                "name": "APIGateway",
                "responsibility": "Handle HTTP requests",
                "technology": "FastAPI",
                "interfaces": [
                    {
                        "name": "IRequestHandler",
                        "description": "HTTP request handling",
                        "methods": ["handle_request(request) -> Response"],
                        "data_types": ["Request", "Response"],
                    }
                ],
                "dependencies": ["UserService"],
                "notes": "Entry point for all API calls",
            },
            {
                "name": "UserService",
                "responsibility": "Manage user operations",
                "technology": "Python",
                "interfaces": [
                    {
                        "name": "IUserService",
                        "description": "User management interface",
                        "methods": ["get_user(id) -> User"],
                        "data_types": ["User"],
                    }
                ],
                "dependencies": [],
                "notes": "",
            },
        ],
        "data_flows": [
            {
                "source": "APIGateway",
                "target": "UserService",
                "data_type": "UserRequest",
                "description": "User API calls",
                "protocol": "direct",
            }
        ],
        "deployment_model": "Container-based with horizontal scaling",
        "diagrams": [
            {
                "diagram_type": "component",
                "title": "System Architecture",
                "description": "High-level component view",
                "mermaid_code": "graph TB\n    API[API Gateway]\n    User[User Service]\n    API --> User",
            },
            {
                "diagram_type": "sequence",
                "title": "User Request Flow",
                "description": "Sequence of user request handling",
                "mermaid_code": "sequenceDiagram\n    Client->>API: Request\n    API->>User: GetUser\n    User-->>API: User\n    API-->>Client: Response",
            },
        ],
    }


@pytest.fixture
def sample_design_with_nfr(sample_combined_design: dict[str, Any]) -> dict[str, Any]:
    """Sample design response that includes NFR evaluation."""
    return {
        **sample_combined_design,
        "nfr_evaluation": [
            {
                "requirement": "Handle 1000 concurrent users",
                "category": "scalability",
                "status": "satisfied",
                "how_addressed": "Horizontal scaling with load balancer",
                "gaps": [],
                "recommendations": ["Add Redis caching"],
            },
            {
                "requirement": "99.9% uptime",
                "category": "reliability",
                "status": "partially_satisfied",
                "how_addressed": "Container health checks",
                "gaps": ["No circuit breaker pattern"],
                "recommendations": ["Implement circuit breaker"],
            },
        ],
        "security_considerations": [
            "Implement JWT authentication",
            "Use HTTPS for all endpoints",
        ],
    }


class TestArchitectAgentInit:
    """Tests for Architect Agent initialization."""

    def test_agent_type(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test agent type property."""
        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )
        assert agent.agent_type == "architect_agent"


class TestArchitectAgentExecute:
    """Tests for Architect Agent execute method."""

    @pytest.mark.asyncio
    async def test_execute_success(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_combined_design: dict[str, Any],
    ) -> None:
        """Test successful execution."""
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output=json.dumps(sample_combined_design),
            structured_output=sample_combined_design,
        )

        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "tech_survey": '{"technologies": []}',
                "prd_content": "Build a user management API.",
                "tech_survey_reference": "TECH-001",
            },
        )

        assert result.success is True
        assert result.agent_type == "architect_agent"
        assert result.task_id == agent_context.task_id
        assert len(result.artifact_paths) > 0
        assert result.metadata["component_count"] == 2
        assert result.metadata["diagram_count"] == 2
        assert result.metadata["architecture_style"] == "modular_monolith"
        assert result.metadata["backend"] == "mock"
        # Single backend call for the combined design
        mock_backend.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_with_nfr_validation(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_design_with_nfr: dict[str, Any],
    ) -> None:
        """Test execution with NFR validation in combined response."""
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output=json.dumps(sample_design_with_nfr),
            structured_output=sample_design_with_nfr,
        )

        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "tech_survey": '{"technologies": []}',
                "prd_content": "Build an API.",
                "nfr_requirements": "Handle 1000 concurrent users. 99.9% uptime.",
            },
        )

        assert result.success is True
        # Single backend call includes NFR validation
        mock_backend.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_missing_tech_survey(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution fails without tech survey."""
        agent = ArchitectAgent(
            backend=mock_backend,
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
        assert "tech_survey" in result.error_message
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_missing_prd_content(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution fails without PRD content."""
        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "tech_survey": '{"technologies": []}',
            },
        )

        assert result.success is False
        assert "prd_content" in result.error_message
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_design_failure_unparseable(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution handles unparseable backend output."""
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output="not valid json at all",
            structured_output=None,
        )

        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "tech_survey": '{}',
                "prd_content": "PRD content",
            },
        )

        assert result.success is False
        assert "component architecture" in result.error_message
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
            error="Backend timed out",
        )

        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "tech_survey": '{}',
                "prd_content": "PRD",
            },
        )

        assert result.success is False
        assert "Backend timed out" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_no_diagrams_still_succeeds(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_combined_design: dict[str, Any],
    ) -> None:
        """Test execution succeeds when response has no diagrams."""
        design_no_diagrams = {**sample_combined_design}
        design_no_diagrams.pop("diagrams", None)

        mock_backend.execute.return_value = BackendResult(
            success=True,
            output=json.dumps(design_no_diagrams),
            structured_output=design_no_diagrams,
        )

        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "tech_survey": '{}',
                "prd_content": "PRD",
            },
        )

        # Should still succeed with 0 diagrams
        assert result.success is True
        assert result.metadata["diagram_count"] == 0

    @pytest.mark.asyncio
    async def test_execute_with_context_pack(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        sample_combined_design: dict[str, Any],
    ) -> None:
        """Test execution with context pack."""
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output=json.dumps(sample_combined_design),
            structured_output=sample_combined_design,
        )

        context = AgentContext(
            session_id="test-session",
            task_id="task-123",
            tenant_id="test-tenant",
            workspace_path="/test",
            context_pack={
                "structure": {"src/": "directory"},
                "components": ["ExistingService"],
                "interfaces": ["IExisting"],
            },
        )

        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await agent.execute(
            context=context,
            event_metadata={
                "tech_survey": '{}',
                "prd_content": "PRD",
            },
        )

        assert result.success is True


class TestArchitectAgentBuilding:
    """Tests for architecture building methods."""

    def test_build_architecture(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test building Architecture from design data."""
        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        design = {
            "architecture_style": "microservices",
            "components": [
                {
                    "name": "UserService",
                    "responsibility": "Manage users",
                    "technology": "Python",
                    "interfaces": [
                        {
                            "name": "IUserService",
                            "description": "User ops",
                            "methods": ["get_user()"],
                            "data_types": ["User"],
                        }
                    ],
                    "dependencies": [],
                    "notes": "Core service",
                }
            ],
            "data_flows": [
                {
                    "source": "APIGateway",
                    "target": "UserService",
                    "data_type": "Request",
                    "description": "User requests",
                    "protocol": "REST",
                }
            ],
            "deployment_model": "Kubernetes",
        }

        diagrams = [
            {
                "diagram_type": "component",
                "title": "Overview",
                "description": "System overview",
                "mermaid_code": "graph TB\n    A-->B",
            }
        ]

        architecture = agent._build_architecture(
            design=design,
            diagrams=diagrams,
            tech_survey_reference="TECH-001",
            nfr_considerations={"scalability": "Horizontal scaling"},
            security_considerations=["Use HTTPS"],
        )

        assert architecture.style == ArchitectureStyle.MICROSERVICES
        assert len(architecture.components) == 1
        assert architecture.components[0].name == "UserService"
        assert len(architecture.components[0].interfaces) == 1
        assert len(architecture.data_flows) == 1
        assert len(architecture.diagrams) == 1
        assert architecture.tech_survey_reference == "TECH-001"
        assert "scalability" in architecture.nfr_considerations
        assert "Use HTTPS" in architecture.security_considerations

    def test_build_architecture_invalid_style_fallback(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test fallback for invalid architecture style."""
        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        design = {
            "architecture_style": "invalid_style",
            "components": [],
            "data_flows": [],
            "deployment_model": "",
        }

        architecture = agent._build_architecture(
            design=design,
            diagrams=[],
            tech_survey_reference="TECH-001",
            nfr_considerations={},
            security_considerations=[],
        )

        assert architecture.style == ArchitectureStyle.LAYERED  # Fallback

    def test_build_architecture_invalid_diagram_type_fallback(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test fallback for invalid diagram type."""
        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        design = {
            "architecture_style": "layered",
            "components": [],
            "data_flows": [],
            "deployment_model": "",
        }

        diagrams = [
            {
                "diagram_type": "invalid_type",
                "title": "Test",
                "description": "Test diagram",
                "mermaid_code": "graph TB\n    A",
            }
        ]

        architecture = agent._build_architecture(
            design=design,
            diagrams=diagrams,
            tech_survey_reference="TECH-001",
            nfr_considerations={},
            security_considerations=[],
        )

        assert len(architecture.diagrams) == 1
        assert architecture.diagrams[0].diagram_type == DiagramType.COMPONENT  # Fallback


class TestArchitectAgentHelpers:
    """Tests for helper methods."""

    def test_extract_nfr_considerations(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test NFR considerations extraction."""
        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        nfr_result = {
            "nfr_evaluation": [
                {
                    "category": "performance",
                    "how_addressed": "Caching layer",
                },
                {
                    "category": "security",
                    "how_addressed": "JWT authentication",
                },
            ]
        }

        considerations = agent._extract_nfr_considerations(nfr_result)

        assert "performance" in considerations
        assert considerations["performance"] == "Caching layer"
        assert "security" in considerations
        assert considerations["security"] == "JWT authentication"

    def test_summarize_context_pack(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test context pack summarization."""
        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        context_pack = {
            "structure": {"src/": "dir", "tests/": "dir"},
            "components": ["UserService", "AuthService"],
            "interfaces": ["IUser", "IAuth"],
        }

        summary = agent._summarize_context_pack(context_pack)

        assert "Existing Structure" in summary
        assert "Existing Components" in summary
        assert "Existing Interfaces" in summary

    def test_summarize_empty_context_pack(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test summarizing empty context pack."""
        agent = ArchitectAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        summary = agent._summarize_context_pack({})
        assert summary == ""

    def test_validate_context_valid(
        self,
        mock_backend: AsyncMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test context validation with valid context."""
        agent = ArchitectAgent(
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
        agent = ArchitectAgent(
            backend=mock_backend,
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


class TestArchitectModuleFunctions:
    """Tests for module-level functions and constants."""

    def test_output_schema_has_required_keys(self) -> None:
        """Test that the output schema has the required structure."""
        assert "type" in ARCHITECT_OUTPUT_SCHEMA
        assert ARCHITECT_OUTPUT_SCHEMA["type"] == "object"
        props = ARCHITECT_OUTPUT_SCHEMA["properties"]
        assert "components" in props
        assert "diagrams" in props
        assert "data_flows" in props
        assert "nfr_evaluation" in props

    def test_system_prompt_is_nonempty(self) -> None:
        """Test that the system prompt is defined."""
        assert ARCHITECT_SYSTEM_PROMPT
        assert "Solution Architect" in ARCHITECT_SYSTEM_PROMPT

    def test_build_architect_prompt_basic(self) -> None:
        """Test building a basic architect prompt."""
        prompt = _build_architect_prompt(
            tech_survey='{"technologies": []}',
            prd_content="Build a user API",
        )

        assert "Technology Survey" in prompt
        assert "PRD Document" in prompt
        assert "Build a user API" in prompt

    def test_build_architect_prompt_with_nfr(self) -> None:
        """Test building prompt with NFR requirements."""
        prompt = _build_architect_prompt(
            tech_survey='{}',
            prd_content="PRD",
            nfr_requirements="Must handle 1000 concurrent users",
        )

        assert "Non-Functional Requirements" in prompt
        assert "1000 concurrent users" in prompt
        assert "nfr_evaluation" in prompt

    def test_build_architect_prompt_with_context(self) -> None:
        """Test building prompt with context pack summary."""
        prompt = _build_architect_prompt(
            tech_survey='{}',
            prd_content="PRD",
            context_pack_summary="### Existing Components\n- UserService",
        )

        assert "Existing Codebase Context" in prompt
        assert "UserService" in prompt

    def test_parse_design_from_result_structured_output(self) -> None:
        """Test parsing from structured output."""
        result = BackendResult(
            success=True,
            output="",
            structured_output={"components": [{"name": "API"}]},
        )

        data = _parse_design_from_result(result)
        assert data is not None
        assert "components" in data

    def test_parse_design_from_result_text_output(self) -> None:
        """Test parsing from text output."""
        result = BackendResult(
            success=True,
            output='{"components": [{"name": "API"}]}',
            structured_output=None,
        )

        data = _parse_design_from_result(result)
        assert data is not None
        assert data["components"][0]["name"] == "API"

    def test_parse_design_from_result_invalid(self) -> None:
        """Test parsing returns None for invalid output."""
        result = BackendResult(
            success=True,
            output="not json at all",
            structured_output=None,
        )

        data = _parse_design_from_result(result)
        assert data is None

    def test_parse_design_from_result_missing_components(self) -> None:
        """Test parsing returns None when components key is missing."""
        result = BackendResult(
            success=True,
            output='{"diagrams": []}',
            structured_output={"diagrams": []},
        )

        data = _parse_design_from_result(result)
        assert data is None
