"""Unit tests for Architect Agent."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

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
from src.workers.agents.design.architect_agent import ArchitectAgent, ArchitectAgentError


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
def sample_component_design_response() -> str:
    """Sample component design response."""
    return json.dumps({
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
    })


@pytest.fixture
def sample_diagrams_response() -> str:
    """Sample diagrams response."""
    return json.dumps({
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
        ]
    })


@pytest.fixture
def sample_nfr_validation_response() -> str:
    """Sample NFR validation response."""
    return json.dumps({
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
        "overall_assessment": {
            "score": 4,
            "summary": "Good architecture with minor gaps",
            "critical_gaps": [],
        },
    })


class TestArchitectAgentInit:
    """Tests for Architect Agent initialization."""

    def test_agent_type(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test agent type property."""
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )
        assert agent.agent_type == "architect_agent"


class TestArchitectAgentExecute:
    """Tests for Architect Agent execute method."""

    @pytest.mark.asyncio
    async def test_execute_success(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_component_design_response: str,
        sample_diagrams_response: str,
    ) -> None:
        """Test successful execution."""
        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_component_design_response),
            MockLLMResponse(content=sample_diagrams_response),
        ]

        agent = ArchitectAgent(
            llm_client=mock_llm_client,
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

    @pytest.mark.asyncio
    async def test_execute_with_nfr_validation(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_component_design_response: str,
        sample_diagrams_response: str,
        sample_nfr_validation_response: str,
    ) -> None:
        """Test execution with NFR validation."""
        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_component_design_response),
            MockLLMResponse(content=sample_diagrams_response),
            MockLLMResponse(content=sample_nfr_validation_response),
        ]

        agent = ArchitectAgent(
            llm_client=mock_llm_client,
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
        # Should have called generate 3 times (design, diagrams, NFR)
        assert mock_llm_client.generate.call_count == 3

    @pytest.mark.asyncio
    async def test_execute_missing_tech_survey(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution fails without tech survey."""
        agent = ArchitectAgent(
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
        assert "tech_survey" in result.error_message
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
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
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
    async def test_execute_design_failure(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test execution handles design failure."""
        mock_llm_client.generate.return_value = MockLLMResponse(
            content="not valid json"
        )

        agent = ArchitectAgent(
            llm_client=mock_llm_client,
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
    async def test_execute_diagram_failure_continues(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_component_design_response: str,
    ) -> None:
        """Test execution continues if diagram generation fails."""
        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_component_design_response),
            MockLLMResponse(content="invalid diagram response"),  # Diagram fails
        ]

        agent = ArchitectAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        sample_component_design_response: str,
        sample_diagrams_response: str,
    ) -> None:
        """Test execution with context pack."""
        mock_llm_client.generate.side_effect = [
            MockLLMResponse(content=sample_component_design_response),
            MockLLMResponse(content=sample_diagrams_response),
        ]

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
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test building Architecture from design data."""
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test fallback for invalid architecture style."""
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test fallback for invalid diagram type."""
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test NFR considerations extraction."""
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test context pack summarization."""
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test summarizing empty context pack."""
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        summary = agent._summarize_context_pack({})
        assert summary == ""

    def test_validate_context_valid(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test context validation with valid context."""
        agent = ArchitectAgent(
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
        agent = ArchitectAgent(
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


class TestArchitectAgentJsonParsing:
    """Tests for JSON parsing in Architect Agent."""

    def test_parse_direct_json(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test parsing direct JSON response."""
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        content = '{"components": []}'
        result = agent._parse_json_from_response(content)

        assert result == {"components": []}

    def test_parse_json_in_code_block(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test parsing JSON from code block."""
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        content = """Here's the architecture:
```json
{"components": [{"name": "API"}]}
```
"""
        result = agent._parse_json_from_response(content)

        assert result == {"components": [{"name": "API"}]}

    def test_parse_invalid_json(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test parsing invalid JSON returns None."""
        agent = ArchitectAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        content = "this is not json"
        result = agent._parse_json_from_response(content)

        assert result is None
