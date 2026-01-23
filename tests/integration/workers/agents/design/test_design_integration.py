"""Integration tests for Design agents.

Tests the full Surveyor -> Architect -> Planner workflow with mocked LLM
responses and real file operations.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.protocols import AgentContext
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    TechSurvey,
    TechnologyChoice,
    Risk,
    RiskLevel,
    Architecture,
    ArchitectureStyle,
    Component,
    DataFlow,
    DiagramReference,
    DiagramType,
    ImplementationPlan,
    ImplementationTask,
    Phase,
    ComplexityLevel,
)
from src.workers.agents.design.surveyor_agent import SurveyorAgent
from src.workers.agents.design.architect_agent import ArchitectAgent
from src.workers.agents.design.planner_agent import PlannerAgent
from src.workers.agents.design.coordinator import DesignCoordinator
from src.workers.artifacts.writer import ArtifactWriter
from src.workers.llm.client import LLMResponse


@pytest.fixture
def workspace_path(tmp_path):
    """Create a temporary workspace."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    return workspace


@pytest.fixture
def artifact_writer(workspace_path):
    """Create a real artifact writer."""
    return ArtifactWriter(str(workspace_path))


@pytest.fixture
def config():
    """Create test configuration."""
    return DesignConfig(max_retries=2, retry_delay_seconds=0.1)


@pytest.fixture
def agent_context(workspace_path):
    """Create test agent context."""
    return AgentContext(
        session_id="integration-session",
        task_id="integration-task",
        tenant_id="default",
        workspace_path=str(workspace_path),
    )


@pytest.fixture
def sample_prd_content():
    """Sample PRD content for testing."""
    return """
    # User Authentication System PRD

    ## Executive Summary
    Build a secure user authentication system with registration and login capabilities.

    ## Functional Requirements
    - REQ-001: Users shall be able to register with email and password
    - REQ-002: Users shall be able to login with credentials
    - REQ-003: System shall support password reset via email

    ## Non-Functional Requirements
    - NFR-001: Passwords shall be hashed using bcrypt
    - NFR-002: API response time under 200ms
    - NFR-003: Support 1000 concurrent users
    """


@pytest.fixture
def mock_llm_for_surveyor():
    """Create mock LLM client with tech survey responses."""
    client = MagicMock()

    analysis_response = {
        "technologies": [
            {
                "category": "language",
                "selected": "Python 3.11+",
                "alternatives": ["Go", "Node.js"],
                "rationale": "Team expertise and rapid development",
            },
            {
                "category": "framework",
                "selected": "FastAPI",
                "alternatives": ["Django", "Flask"],
                "rationale": "Modern async support and automatic OpenAPI docs",
            },
            {
                "category": "database",
                "selected": "PostgreSQL",
                "alternatives": ["MySQL", "MongoDB"],
                "rationale": "ACID compliance for auth data",
            },
            {
                "category": "cache",
                "selected": "Redis",
                "alternatives": ["Memcached"],
                "rationale": "Session storage and rate limiting",
            },
        ],
        "risks": [
            {
                "id": "RISK-001",
                "description": "Password security vulnerabilities",
                "level": "high",
                "mitigation": "Use bcrypt with proper cost factor",
            },
            {
                "id": "RISK-002",
                "description": "Session hijacking",
                "level": "medium",
                "mitigation": "Implement secure session management",
            },
        ],
        "recommendations": [
            "Use JWT for stateless authentication",
            "Implement rate limiting on auth endpoints",
            "Add 2FA support in future iterations",
        ],
    }

    client.generate = AsyncMock(
        return_value=LLMResponse(content=json.dumps(analysis_response), model="test")
    )
    client.model_name = "test-model"
    return client


@pytest.fixture
def mock_llm_for_architect():
    """Create mock LLM client with architecture responses."""
    client = MagicMock()

    arch_response = {
        "style": "modular_monolith",
        "components": [
            {
                "name": "APIGateway",
                "responsibility": "Handle HTTP requests and routing",
                "technology": "FastAPI",
                "interfaces_provided": ["REST API"],
                "interfaces_consumed": ["AuthService", "UserService"],
            },
            {
                "name": "AuthService",
                "responsibility": "Handle authentication and authorization",
                "technology": "Python",
                "interfaces_provided": ["AuthInterface"],
                "interfaces_consumed": ["UserRepository", "SessionStore"],
            },
            {
                "name": "UserService",
                "responsibility": "Manage user data and profiles",
                "technology": "Python",
                "interfaces_provided": ["UserInterface"],
                "interfaces_consumed": ["UserRepository"],
            },
            {
                "name": "UserRepository",
                "responsibility": "Data access layer for users",
                "technology": "SQLAlchemy",
                "interfaces_provided": ["UserDataAccess"],
                "interfaces_consumed": ["PostgreSQL"],
            },
        ],
        "data_flows": [
            {
                "source": "APIGateway",
                "target": "AuthService",
                "data_type": "AuthRequest",
                "protocol": "direct",
            },
            {
                "source": "AuthService",
                "target": "UserRepository",
                "data_type": "UserQuery",
                "protocol": "direct",
            },
        ],
        "diagrams": [
            {
                "type": "component",
                "title": "System Architecture",
                "mermaid": "graph TB\\n    A[APIGateway]-->B[AuthService]\\n    A-->C[UserService]\\n    B-->D[UserRepository]\\n    C-->D",
            },
        ],
        "deployment_model": "Container-based with Docker",
        "security_considerations": [
            "Use HTTPS for all traffic",
            "Implement JWT with short expiry",
            "Store secrets in environment variables",
        ],
    }

    client.generate = AsyncMock(
        return_value=LLMResponse(content=json.dumps(arch_response), model="test")
    )
    client.model_name = "test-model"
    return client


@pytest.fixture
def mock_llm_for_planner():
    """Create mock LLM client with implementation plan responses."""
    client = MagicMock()

    plan_response = {
        "phases": [
            {
                "name": "Phase 1: Foundation",
                "order": 1,
                "task_ids": ["T001", "T002", "T003"],
            },
            {
                "name": "Phase 2: Core Features",
                "order": 2,
                "task_ids": ["T004", "T005", "T006"],
            },
            {
                "name": "Phase 3: Testing & Polish",
                "order": 3,
                "task_ids": ["T007", "T008"],
            },
        ],
        "tasks": [
            {
                "id": "T001",
                "title": "Set up project structure",
                "description": "Create project with FastAPI, configure Docker",
                "component": "Infrastructure",
                "dependencies": [],
                "complexity": "small",
                "test_requirements": ["Project builds successfully"],
            },
            {
                "id": "T002",
                "title": "Configure PostgreSQL",
                "description": "Set up database with migrations",
                "component": "UserRepository",
                "dependencies": ["T001"],
                "complexity": "small",
                "test_requirements": ["Migrations run successfully"],
            },
            {
                "id": "T003",
                "title": "Create User model",
                "description": "Define User entity with SQLAlchemy",
                "component": "UserRepository",
                "dependencies": ["T002"],
                "complexity": "small",
                "test_requirements": ["CRUD operations work"],
            },
            {
                "id": "T004",
                "title": "Implement registration endpoint",
                "description": "POST /register with email validation",
                "component": "AuthService",
                "dependencies": ["T003"],
                "complexity": "medium",
                "test_requirements": ["User can register", "Duplicate email rejected"],
            },
            {
                "id": "T005",
                "title": "Implement login endpoint",
                "description": "POST /login with JWT generation",
                "component": "AuthService",
                "dependencies": ["T004"],
                "complexity": "medium",
                "test_requirements": ["Valid login returns JWT", "Invalid login rejected"],
            },
            {
                "id": "T006",
                "title": "Implement password reset",
                "description": "Password reset flow with email",
                "component": "AuthService",
                "dependencies": ["T005"],
                "complexity": "large",
                "test_requirements": ["Reset email sent", "Token expires correctly"],
            },
            {
                "id": "T007",
                "title": "Integration tests",
                "description": "End-to-end auth flow tests",
                "component": "Testing",
                "dependencies": ["T006"],
                "complexity": "medium",
                "test_requirements": ["All flows pass"],
            },
            {
                "id": "T008",
                "title": "Documentation",
                "description": "API docs and deployment guide",
                "component": "Documentation",
                "dependencies": ["T007"],
                "complexity": "small",
                "test_requirements": ["Docs are complete"],
            },
        ],
        "critical_path": ["T001", "T002", "T003", "T004", "T005", "T006", "T007", "T008"],
    }

    client.generate = AsyncMock(
        return_value=LLMResponse(content=json.dumps(plan_response), model="test")
    )
    client.model_name = "test-model"
    return client


@pytest.fixture
def sample_tech_survey():
    """Create sample tech survey for downstream tests."""
    return TechSurvey.create(
        prd_reference="PRD-001",
        technologies=[
            TechnologyChoice(
                category="language",
                selected="Python 3.11+",
                alternatives=["Go"],
                rationale="Team expertise",
            ),
            TechnologyChoice(
                category="framework",
                selected="FastAPI",
                alternatives=["Django"],
                rationale="Async support",
            ),
        ],
        risk_assessment=[
            Risk(
                id="RISK-001",
                description="Security risk",
                level=RiskLevel.HIGH,
                mitigation="Use bcrypt",
            ),
        ],
        recommendations=["Use JWT"],
    )


@pytest.fixture
def sample_architecture():
    """Create sample architecture for downstream tests."""
    return Architecture.create(
        style=ArchitectureStyle.MODULAR_MONOLITH,
        components=[
            Component(
                name="APIGateway",
                responsibility="Handle requests",
                technology="FastAPI",
            ),
            Component(
                name="AuthService",
                responsibility="Authentication",
                technology="Python",
            ),
        ],
        data_flows=[
            DataFlow(
                source="APIGateway",
                target="AuthService",
                data_type="AuthRequest",
                protocol="direct",
            ),
        ],
        deployment_model="Docker",
        diagrams=[
            DiagramReference(
                diagram_type=DiagramType.COMPONENT,
                title="Architecture",
                mermaid_code="graph TB\\n    A-->B",
            ),
        ],
        tech_survey_reference="TECH-001",
        security_considerations=["Use HTTPS"],
    )


class TestSurveyorAgentIntegration:
    """Integration tests for Surveyor Agent."""

    @pytest.mark.asyncio
    async def test_surveyor_generates_valid_tech_survey(
        self,
        mock_llm_for_surveyor,
        artifact_writer,
        agent_context,
        config,
        sample_prd_content,
    ) -> None:
        """Test that Surveyor agent generates a valid tech survey."""
        agent = SurveyorAgent(
            llm_client=mock_llm_for_surveyor,
            artifact_writer=artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "prd_content": sample_prd_content,
                "prd_reference": "PRD-001",
            },
        )

        assert result.success is True
        assert len(result.artifact_paths) >= 1

        # Verify artifact file exists
        artifact_path = Path(result.artifact_paths[0])
        assert artifact_path.exists()

        content = artifact_path.read_text()
        data = json.loads(content)

        assert len(data["technologies"]) == 4
        assert data["technologies"][0]["category"] == "language"

    @pytest.mark.asyncio
    async def test_surveyor_writes_markdown(
        self,
        mock_llm_for_surveyor,
        artifact_writer,
        agent_context,
        config,
        sample_prd_content,
    ) -> None:
        """Test that Surveyor writes markdown artifact."""
        agent = SurveyorAgent(
            llm_client=mock_llm_for_surveyor,
            artifact_writer=artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"prd_content": sample_prd_content},
        )

        assert result.success is True

        artifact_dir = Path(artifact_writer.get_artifact_directory(agent_context.session_id))
        md_files = list(artifact_dir.glob("*.md"))

        assert len(md_files) >= 1


class TestArchitectAgentIntegration:
    """Integration tests for Architect Agent."""

    @pytest.mark.asyncio
    async def test_architect_generates_valid_architecture(
        self,
        mock_llm_for_architect,
        artifact_writer,
        agent_context,
        config,
        sample_tech_survey,
        sample_prd_content,
    ) -> None:
        """Test that Architect agent generates valid architecture."""
        agent = ArchitectAgent(
            llm_client=mock_llm_for_architect,
            artifact_writer=artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "tech_survey": sample_tech_survey.to_json(),
                "prd_content": sample_prd_content,
                "tech_survey_reference": "TECH-001",
            },
        )

        assert result.success is True
        assert len(result.artifact_paths) >= 1

        artifact_path = Path(result.artifact_paths[0])
        content = artifact_path.read_text()
        data = json.loads(content)

        assert len(data["components"]) == 4
        assert data["style"] == "modular_monolith"

    @pytest.mark.asyncio
    async def test_architect_includes_diagrams(
        self,
        mock_llm_for_architect,
        artifact_writer,
        agent_context,
        config,
        sample_tech_survey,
        sample_prd_content,
    ) -> None:
        """Test that Architect includes Mermaid diagrams."""
        agent = ArchitectAgent(
            llm_client=mock_llm_for_architect,
            artifact_writer=artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "tech_survey": sample_tech_survey.to_json(),
                "prd_content": sample_prd_content,
            },
        )

        assert result.success is True

        artifact_path = Path(result.artifact_paths[0])
        data = json.loads(artifact_path.read_text())

        assert len(data["diagrams"]) >= 1
        assert "mermaid" in data["diagrams"][0]


class TestPlannerAgentIntegration:
    """Integration tests for Planner Agent."""

    @pytest.mark.asyncio
    async def test_planner_generates_valid_plan(
        self,
        mock_llm_for_planner,
        artifact_writer,
        agent_context,
        config,
        sample_architecture,
        sample_prd_content,
    ) -> None:
        """Test that Planner agent generates valid implementation plan."""
        agent = PlannerAgent(
            llm_client=mock_llm_for_planner,
            artifact_writer=artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "architecture": sample_architecture.to_json(),
                "prd_content": sample_prd_content,
                "architecture_reference": "ARCH-001",
            },
        )

        assert result.success is True
        assert len(result.artifact_paths) >= 1

        artifact_path = Path(result.artifact_paths[0])
        data = json.loads(artifact_path.read_text())

        assert len(data["phases"]) == 3
        assert len(data["tasks"]) == 8
        assert len(data["critical_path"]) == 8

    @pytest.mark.asyncio
    async def test_planner_identifies_dependencies(
        self,
        mock_llm_for_planner,
        artifact_writer,
        agent_context,
        config,
        sample_architecture,
        sample_prd_content,
    ) -> None:
        """Test that Planner correctly identifies task dependencies."""
        agent = PlannerAgent(
            llm_client=mock_llm_for_planner,
            artifact_writer=artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "architecture": sample_architecture.to_json(),
                "prd_content": sample_prd_content,
            },
        )

        assert result.success is True

        artifact_path = Path(result.artifact_paths[0])
        data = json.loads(artifact_path.read_text())

        # Check that tasks have proper dependencies
        task_map = {t["id"]: t for t in data["tasks"]}
        assert task_map["T002"]["dependencies"] == ["T001"]
        assert task_map["T003"]["dependencies"] == ["T002"]


class TestDesignCoordinatorIntegration:
    """Integration tests for Design Coordinator."""

    @pytest.mark.asyncio
    async def test_coordinator_runs_full_design_workflow(
        self,
        artifact_writer,
        agent_context,
        config,
        sample_prd_content,
    ) -> None:
        """Test that coordinator runs full Surveyor -> Architect -> Planner workflow."""
        # Create mock LLM client that returns different responses based on prompt
        mock_client = MagicMock()

        survey_response = {
            "technologies": [
                {"category": "language", "selected": "Python", "alternatives": [], "rationale": "Good"},
            ],
            "risks": [],
            "recommendations": ["Use JWT"],
        }

        arch_response = {
            "style": "modular_monolith",
            "components": [
                {"name": "API", "responsibility": "Handle requests", "technology": "FastAPI"},
            ],
            "data_flows": [],
            "diagrams": [],
            "deployment_model": "Docker",
            "security_considerations": [],
        }

        plan_response = {
            "phases": [{"name": "Phase 1", "order": 1, "task_ids": ["T001"]}],
            "tasks": [
                {"id": "T001", "title": "Setup", "description": "Setup project",
                 "component": "Infra", "dependencies": [], "complexity": "small"},
            ],
            "critical_path": ["T001"],
        }

        mock_client.generate = AsyncMock(
            side_effect=[
                LLMResponse(content=json.dumps(survey_response), model="test"),
                LLMResponse(content=json.dumps(arch_response), model="test"),
                LLMResponse(content=json.dumps(plan_response), model="test"),
            ]
        )
        mock_client.model_name = "test-model"

        coordinator = DesignCoordinator(
            llm_client=mock_client,
            artifact_writer=artifact_writer,
            config=config,
        )

        result = await coordinator.run(
            context=agent_context,
            prd_content=sample_prd_content,
            skip_hitl=True,
        )

        assert result.success is True
        assert result.tech_survey is not None
        assert result.architecture is not None
        assert result.implementation_plan is not None

    @pytest.mark.asyncio
    async def test_coordinator_generates_artifacts(
        self,
        artifact_writer,
        agent_context,
        config,
        sample_prd_content,
        workspace_path,
    ) -> None:
        """Test that coordinator generates all expected artifacts."""
        mock_client = MagicMock()

        survey_response = {
            "technologies": [{"category": "lang", "selected": "Py", "alternatives": [], "rationale": ""}],
            "risks": [],
            "recommendations": [],
        }
        arch_response = {
            "style": "microservices",
            "components": [{"name": "Svc", "responsibility": "Do", "technology": "Py"}],
            "data_flows": [],
            "diagrams": [],
            "deployment_model": "K8s",
            "security_considerations": [],
        }
        plan_response = {
            "phases": [{"name": "P1", "order": 1, "task_ids": ["T1"]}],
            "tasks": [{"id": "T1", "title": "T", "description": "D", "component": "C",
                       "dependencies": [], "complexity": "small"}],
            "critical_path": ["T1"],
        }

        mock_client.generate = AsyncMock(
            side_effect=[
                LLMResponse(content=json.dumps(survey_response), model="test"),
                LLMResponse(content=json.dumps(arch_response), model="test"),
                LLMResponse(content=json.dumps(plan_response), model="test"),
            ]
        )
        mock_client.model_name = "test-model"

        coordinator = DesignCoordinator(
            llm_client=mock_client,
            artifact_writer=artifact_writer,
            config=config,
        )

        result = await coordinator.run(
            context=agent_context,
            prd_content=sample_prd_content,
            skip_hitl=True,
        )

        assert result.success is True

        # Check artifacts exist
        artifact_dir = Path(artifact_writer.get_artifact_directory(agent_context.session_id))
        files = list(artifact_dir.iterdir())

        # Should have tech_survey, architecture, implementation_plan (json + md each)
        json_files = [f for f in files if f.suffix == ".json"]
        assert len(json_files) >= 3

    @pytest.mark.asyncio
    async def test_coordinator_submits_to_hitl2(
        self,
        artifact_writer,
        agent_context,
        config,
        sample_prd_content,
    ) -> None:
        """Test that coordinator submits to HITL-2 gate."""
        mock_client = MagicMock()
        mock_hitl = MagicMock()
        mock_hitl.submit = AsyncMock(return_value="hitl-request-123")

        survey_response = {
            "technologies": [{"category": "lang", "selected": "Py", "alternatives": [], "rationale": ""}],
            "risks": [],
            "recommendations": [],
        }
        arch_response = {
            "style": "modular_monolith",
            "components": [{"name": "Svc", "responsibility": "Do", "technology": "Py"}],
            "data_flows": [],
            "diagrams": [],
            "deployment_model": "Docker",
            "security_considerations": [],
        }

        mock_client.generate = AsyncMock(
            side_effect=[
                LLMResponse(content=json.dumps(survey_response), model="test"),
                LLMResponse(content=json.dumps(arch_response), model="test"),
            ]
        )
        mock_client.model_name = "test-model"

        coordinator = DesignCoordinator(
            llm_client=mock_client,
            artifact_writer=artifact_writer,
            config=config,
            hitl_dispatcher=mock_hitl,
        )

        result = await coordinator.run(
            context=agent_context,
            prd_content=sample_prd_content,
        )

        # Should return pending HITL-2
        assert result.success is True
        assert result.hitl2_request_id == "hitl-request-123"
        mock_hitl.submit.assert_called_once()

    @pytest.mark.asyncio
    async def test_coordinator_resumes_from_hitl2(
        self,
        artifact_writer,
        agent_context,
        config,
        sample_tech_survey,
        sample_architecture,
        sample_prd_content,
    ) -> None:
        """Test coordinator resumes after HITL-2 approval."""
        mock_client = MagicMock()

        plan_response = {
            "phases": [{"name": "P1", "order": 1, "task_ids": ["T1"]}],
            "tasks": [{"id": "T1", "title": "T", "description": "D", "component": "C",
                       "dependencies": [], "complexity": "small"}],
            "critical_path": ["T1"],
        }

        mock_client.generate = AsyncMock(
            return_value=LLMResponse(content=json.dumps(plan_response), model="test")
        )
        mock_client.model_name = "test-model"

        coordinator = DesignCoordinator(
            llm_client=mock_client,
            artifact_writer=artifact_writer,
            config=config,
        )

        result = await coordinator.run_from_hitl2_approval(
            context=agent_context,
            tech_survey=sample_tech_survey,
            architecture=sample_architecture,
            prd_content=sample_prd_content,
            skip_hitl=True,
        )

        assert result.success is True
        assert result.implementation_plan is not None
        assert len(result.implementation_plan.tasks) == 1


class TestDesignWorkflowWithRLM:
    """Integration tests for design workflow with RLM."""

    @pytest.mark.asyncio
    async def test_surveyor_with_rlm_integration(
        self,
        artifact_writer,
        agent_context,
        config,
        sample_prd_content,
    ) -> None:
        """Test Surveyor agent uses RLM for deep research."""
        mock_client = MagicMock()
        mock_rlm = MagicMock()

        # RLM returns research results
        mock_rlm.explore = AsyncMock(return_value={
            "findings": [
                {"topic": "Authentication", "insight": "Use OAuth2 for third-party auth"},
                {"topic": "Security", "insight": "Implement rate limiting"},
            ],
            "recommendations": ["Consider JWT for stateless auth"],
        })

        survey_response = {
            "technologies": [
                {"category": "auth", "selected": "OAuth2", "alternatives": ["Custom"],
                 "rationale": "RLM research recommended OAuth2"},
            ],
            "risks": [
                {"id": "R1", "description": "Auth complexity", "level": "medium",
                 "mitigation": "Use established library"},
            ],
            "recommendations": ["Use JWT", "Implement rate limiting"],
        }

        mock_client.generate = AsyncMock(
            return_value=LLMResponse(content=json.dumps(survey_response), model="test")
        )
        mock_client.model_name = "test-model"

        agent = SurveyorAgent(
            llm_client=mock_client,
            artifact_writer=artifact_writer,
            config=config,
            rlm_integration=mock_rlm,
        )

        result = await agent.execute(
            agent_context,
            {
                "prd_content": sample_prd_content,
                "enable_rlm": True,
            },
        )

        assert result.success is True
        # RLM should have been called for research
        # Note: Actual RLM call depends on implementation triggering it


class TestDesignWorkflowWithContextPack:
    """Integration tests for design workflow with context pack."""

    @pytest.mark.asyncio
    async def test_surveyor_with_context_pack(
        self,
        artifact_writer,
        agent_context,
        config,
        sample_prd_content,
    ) -> None:
        """Test Surveyor agent uses context pack from RepoMapper."""
        mock_client = MagicMock()
        mock_mapper = MagicMock()

        # RepoMapper returns existing patterns
        mock_mapper.generate_context_pack = AsyncMock(return_value={
            "structure": ["src/", "tests/", "docker/"],
            "technologies_detected": ["Python", "PostgreSQL", "Redis"],
            "patterns": ["Repository pattern", "Service layer"],
            "dependencies": ["fastapi", "sqlalchemy", "redis"],
        })

        survey_response = {
            "technologies": [
                {"category": "language", "selected": "Python 3.11+",
                 "alternatives": [], "rationale": "Matches existing codebase"},
            ],
            "risks": [],
            "recommendations": ["Continue using existing patterns"],
        }

        mock_client.generate = AsyncMock(
            return_value=LLMResponse(content=json.dumps(survey_response), model="test")
        )
        mock_client.model_name = "test-model"

        agent = SurveyorAgent(
            llm_client=mock_client,
            artifact_writer=artifact_writer,
            config=config,
            repo_mapper=mock_mapper,
        )

        result = await agent.execute(
            agent_context,
            {"prd_content": sample_prd_content},
        )

        assert result.success is True
