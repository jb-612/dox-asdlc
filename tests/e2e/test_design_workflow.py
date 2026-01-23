"""End-to-end tests for the Design Workflow.

Tests the complete design workflow from PRD through tech survey,
architecture design, and implementation planning with HITL-2 and HITL-3 gates.

These tests require Docker containers to be running:
    docker compose -f docker/docker-compose.yml up -d

Test coverage:
- T14: E2E Validation for P04-F02 Design Agents
"""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import redis.asyncio as redis

from src.core.events import ASDLCEvent, EventType
from src.orchestrator.evidence_bundle import GateType
from src.orchestrator.hitl_dispatcher import (
    DecisionLogger,
    GateStatus,
    HITLDispatcher,
)
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.coordinator import DesignCoordinator
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
)
from src.workers.agents.protocols import AgentContext
from src.workers.artifacts.writer import ArtifactWriter
from src.workers.llm.client import LLMResponse

# Test configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))


def get_redis_url() -> str:
    """Get Redis URL for tests."""
    return f"redis://{REDIS_HOST}:{REDIS_PORT}/1"


@pytest.fixture
def unique_session_id() -> str:
    """Generate unique session ID for test isolation."""
    return f"e2e-design-session-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def unique_task_id() -> str:
    """Generate unique task ID for test isolation."""
    return f"e2e-design-task-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def workspace_path(tmp_path) -> Path:
    """Create isolated workspace for E2E tests."""
    workspace = tmp_path / "e2e_workspace"
    workspace.mkdir()
    return workspace


@pytest.fixture
def artifact_writer(workspace_path) -> ArtifactWriter:
    """Create artifact writer for test workspace."""
    return ArtifactWriter(str(workspace_path))


@pytest.fixture
def design_config() -> DesignConfig:
    """Create test configuration with fast retries."""
    return DesignConfig(
        max_retries=2,
        retry_delay_seconds=0.1,
    )


@pytest.fixture
def agent_context(workspace_path, unique_session_id, unique_task_id) -> AgentContext:
    """Create agent context for E2E tests."""
    return AgentContext(
        session_id=unique_session_id,
        task_id=unique_task_id,
        tenant_id="default",
        workspace_path=str(workspace_path),
        metadata={"git_sha": "e2e-test-sha"},
    )


@pytest.fixture
def sample_prd_content() -> str:
    """Sample PRD content for design workflow."""
    return """
    # User Authentication System - PRD

    ## Executive Summary
    Build a secure user authentication system with registration, login,
    and password management capabilities.

    ## Functional Requirements
    - REQ-001: Users shall be able to register with email and password
    - REQ-002: Users shall be able to login with credentials
    - REQ-003: System shall support password reset via email
    - REQ-004: Users shall be able to update their profile

    ## Non-Functional Requirements
    - NFR-001: Passwords shall be hashed using bcrypt with cost factor 12
    - NFR-002: API response time under 200ms for 95th percentile
    - NFR-003: Support 1000 concurrent users
    - NFR-004: 99.9% uptime SLA
    """


@pytest.fixture
def mock_llm_responses() -> dict[str, Any]:
    """Create comprehensive LLM mock responses for full design workflow."""
    # Tech survey response
    survey_response = {
        "technologies": [
            {
                "category": "language",
                "selected": "Python 3.11+",
                "alternatives": ["Go", "Node.js"],
                "rationale": "Team expertise and rich ecosystem",
            },
            {
                "category": "framework",
                "selected": "FastAPI",
                "alternatives": ["Django", "Flask"],
                "rationale": "Modern async support, automatic OpenAPI docs, high performance",
            },
            {
                "category": "database",
                "selected": "PostgreSQL 15",
                "alternatives": ["MySQL", "MongoDB"],
                "rationale": "ACID compliance, mature, excellent for auth data",
            },
            {
                "category": "cache",
                "selected": "Redis",
                "alternatives": ["Memcached"],
                "rationale": "Session storage, rate limiting, flexible data structures",
            },
            {
                "category": "authentication",
                "selected": "JWT",
                "alternatives": ["Session tokens"],
                "rationale": "Stateless, scalable, widely adopted",
            },
        ],
        "risks": [
            {
                "id": "RISK-001",
                "description": "Password security vulnerabilities",
                "level": "high",
                "mitigation": "Use bcrypt with proper cost factor, implement rate limiting",
            },
            {
                "id": "RISK-002",
                "description": "Session hijacking through XSS or CSRF",
                "level": "high",
                "mitigation": "Implement CSP, CSRF tokens, secure cookie flags",
            },
            {
                "id": "RISK-003",
                "description": "Database performance under load",
                "level": "medium",
                "mitigation": "Connection pooling, read replicas, query optimization",
            },
        ],
        "recommendations": [
            "Implement rate limiting on authentication endpoints",
            "Use refresh token rotation for enhanced security",
            "Add structured logging for security audit trail",
            "Consider adding 2FA in future iteration",
        ],
    }

    # Architecture response
    arch_response = {
        "style": "modular_monolith",
        "components": [
            {
                "name": "APIGateway",
                "responsibility": "Handle HTTP requests, routing, rate limiting",
                "technology": "FastAPI",
                "interfaces_provided": ["REST API", "WebSocket"],
                "interfaces_consumed": ["AuthService", "UserService"],
            },
            {
                "name": "AuthService",
                "responsibility": "Authentication, authorization, token management",
                "technology": "Python",
                "interfaces_provided": ["AuthInterface"],
                "interfaces_consumed": ["UserRepository", "TokenStore", "EmailService"],
            },
            {
                "name": "UserService",
                "responsibility": "User profile management, preferences",
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
            {
                "name": "TokenStore",
                "responsibility": "JWT and refresh token management",
                "technology": "Redis",
                "interfaces_provided": ["TokenInterface"],
                "interfaces_consumed": [],
            },
            {
                "name": "EmailService",
                "responsibility": "Transactional email delivery",
                "technology": "SendGrid SDK",
                "interfaces_provided": ["EmailInterface"],
                "interfaces_consumed": [],
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
            {
                "source": "AuthService",
                "target": "TokenStore",
                "data_type": "TokenOperation",
                "protocol": "direct",
            },
            {
                "source": "AuthService",
                "target": "EmailService",
                "data_type": "EmailRequest",
                "protocol": "async_queue",
            },
        ],
        "diagrams": [
            {
                "type": "component",
                "title": "System Architecture",
                "mermaid": (
                    "graph TB\n"
                    "    Client[Client] --> API[API Gateway]\n"
                    "    API --> Auth[Auth Service]\n"
                    "    API --> User[User Service]\n"
                    "    Auth --> UserRepo[User Repository]\n"
                    "    Auth --> Token[Token Store]\n"
                    "    Auth --> Email[Email Service]\n"
                    "    User --> UserRepo\n"
                    "    UserRepo --> DB[(PostgreSQL)]\n"
                    "    Token --> Redis[(Redis)]"
                ),
            },
            {
                "type": "sequence",
                "title": "Login Flow",
                "mermaid": (
                    "sequenceDiagram\n"
                    "    Client->>API: POST /login\n"
                    "    API->>Auth: authenticate()\n"
                    "    Auth->>UserRepo: findByEmail()\n"
                    "    UserRepo-->>Auth: User\n"
                    "    Auth->>Auth: verifyPassword()\n"
                    "    Auth->>Token: createTokens()\n"
                    "    Token-->>Auth: JWT + Refresh\n"
                    "    Auth-->>API: AuthResponse\n"
                    "    API-->>Client: 200 OK + tokens"
                ),
            },
        ],
        "deployment_model": "Container-based with Docker Compose (dev) and Kubernetes (prod)",
        "security_considerations": [
            "All traffic over HTTPS with TLS 1.3",
            "JWT with RS256 signing algorithm",
            "Secrets stored in environment variables / Vault",
            "Rate limiting: 10 requests/min for auth endpoints",
            "CORS whitelist for frontend origins",
            "Audit logging for all auth events",
        ],
    }

    # Implementation plan response
    plan_response = {
        "phases": [
            {
                "name": "Phase 1: Infrastructure Setup",
                "order": 1,
                "task_ids": ["T001", "T002", "T003"],
            },
            {
                "name": "Phase 2: Core Authentication",
                "order": 2,
                "task_ids": ["T004", "T005", "T006", "T007"],
            },
            {
                "name": "Phase 3: User Management",
                "order": 3,
                "task_ids": ["T008", "T009"],
            },
            {
                "name": "Phase 4: Testing & Documentation",
                "order": 4,
                "task_ids": ["T010", "T011", "T012"],
            },
        ],
        "tasks": [
            {
                "id": "T001",
                "title": "Set up project structure",
                "description": "Create FastAPI project structure with Docker configuration",
                "component": "Infrastructure",
                "dependencies": [],
                "complexity": "small",
                "test_requirements": ["Project builds successfully", "Docker containers start"],
            },
            {
                "id": "T002",
                "title": "Configure PostgreSQL with Alembic",
                "description": "Set up database with migrations framework",
                "component": "UserRepository",
                "dependencies": ["T001"],
                "complexity": "small",
                "test_requirements": ["Migrations run successfully", "Connection works"],
            },
            {
                "id": "T003",
                "title": "Configure Redis for tokens",
                "description": "Set up Redis with connection pooling",
                "component": "TokenStore",
                "dependencies": ["T001"],
                "complexity": "small",
                "test_requirements": ["Redis connection established", "Basic ops work"],
            },
            {
                "id": "T004",
                "title": "Implement User model and repository",
                "description": "Create User entity with SQLAlchemy and CRUD operations",
                "component": "UserRepository",
                "dependencies": ["T002"],
                "complexity": "medium",
                "test_requirements": ["CRUD operations work", "Unique email constraint"],
            },
            {
                "id": "T005",
                "title": "Implement JWT token service",
                "description": "Create JWT generation, validation, and refresh logic",
                "component": "TokenStore",
                "dependencies": ["T003"],
                "complexity": "medium",
                "test_requirements": ["Token generation", "Token validation", "Refresh works"],
            },
            {
                "id": "T006",
                "title": "Implement registration endpoint",
                "description": "POST /register with email validation and password hashing",
                "component": "AuthService",
                "dependencies": ["T004"],
                "complexity": "medium",
                "test_requirements": ["User can register", "Duplicate rejected", "Password hashed"],
            },
            {
                "id": "T007",
                "title": "Implement login endpoint",
                "description": "POST /login with credential verification and token issuance",
                "component": "AuthService",
                "dependencies": ["T005", "T006"],
                "complexity": "medium",
                "test_requirements": ["Valid login works", "Invalid rejected", "Rate limiting"],
            },
            {
                "id": "T008",
                "title": "Implement password reset flow",
                "description": "Request reset, verify token, update password",
                "component": "AuthService",
                "dependencies": ["T007"],
                "complexity": "large",
                "test_requirements": ["Reset email sent", "Token expires", "Password updated"],
            },
            {
                "id": "T009",
                "title": "Implement profile management",
                "description": "GET/PUT /profile for user data updates",
                "component": "UserService",
                "dependencies": ["T007"],
                "complexity": "medium",
                "test_requirements": ["Get profile works", "Update profile works", "Auth required"],
            },
            {
                "id": "T010",
                "title": "Integration tests",
                "description": "End-to-end auth flow tests",
                "component": "Testing",
                "dependencies": ["T008", "T009"],
                "complexity": "medium",
                "test_requirements": ["All flows pass", "Edge cases covered"],
            },
            {
                "id": "T011",
                "title": "Security audit",
                "description": "Review code for vulnerabilities",
                "component": "Security",
                "dependencies": ["T010"],
                "complexity": "medium",
                "test_requirements": ["No critical vulnerabilities", "OWASP compliance"],
            },
            {
                "id": "T012",
                "title": "API documentation",
                "description": "OpenAPI spec and deployment guide",
                "component": "Documentation",
                "dependencies": ["T010"],
                "complexity": "small",
                "test_requirements": ["Docs are complete", "Examples work"],
            },
        ],
        "critical_path": ["T001", "T002", "T004", "T006", "T007", "T008", "T010", "T011"],
    }

    return {
        "survey": survey_response,
        "architecture": arch_response,
        "plan": plan_response,
    }


@pytest.fixture
def mock_llm_client(mock_llm_responses) -> MagicMock:
    """Create mock LLM client with all workflow responses."""
    client = MagicMock()

    client.generate = AsyncMock(
        side_effect=[
            LLMResponse(content=json.dumps(mock_llm_responses["survey"]), model="test"),
            LLMResponse(content=json.dumps(mock_llm_responses["architecture"]), model="test"),
            LLMResponse(content=json.dumps(mock_llm_responses["plan"]), model="test"),
        ]
    )
    client.model_name = "test-model"

    return client


@pytest.fixture
async def redis_client():
    """Create Redis client for E2E tests.

    Skip tests if Redis is not available.
    """
    try:
        client = redis.Redis.from_url(get_redis_url(), decode_responses=True)
        await client.ping()
        yield client
        await client.aclose()
    except (redis.ConnectionError, OSError):
        pytest.skip("Redis not available for E2E tests")


@pytest.fixture
def mock_event_publisher() -> AsyncMock:
    """Create mock event publisher that captures events."""
    events: list[ASDLCEvent] = []

    async def capture_event(event: ASDLCEvent) -> str:
        events.append(event)
        return event.event_id

    publisher = AsyncMock(side_effect=capture_event)
    publisher.events = events
    return publisher


@pytest.fixture
async def hitl_dispatcher(redis_client, mock_event_publisher) -> HITLDispatcher:
    """Create HITL dispatcher with real Redis backend."""
    decision_logger = DecisionLogger(redis_client)
    return HITLDispatcher(
        redis_client=redis_client,
        event_publisher=mock_event_publisher,
        decision_logger=decision_logger,
    )


class TestDesignWorkflowE2E:
    """End-to-end tests for the complete design workflow."""

    @pytest.mark.asyncio
    async def test_full_design_workflow_produces_all_artifacts(
        self,
        mock_llm_client,
        artifact_writer,
        design_config,
        agent_context,
        sample_prd_content,
    ) -> None:
        """Test that the complete design workflow produces all expected artifacts.

        This test validates:
        1. Tech survey is generated from PRD
        2. Architecture is designed from tech survey
        3. Implementation plan is created from architecture
        4. All JSON and Markdown artifacts are written
        5. All artifacts are valid and parseable
        """
        # Arrange
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            config=design_config,
            hitl_dispatcher=None,  # Skip HITL for artifact focus
        )

        # Act
        result = await coordinator.run(
            context=agent_context,
            prd_content=sample_prd_content,
            skip_hitl=True,
        )

        # Assert - Workflow success
        assert result.success is True
        assert result.error_message is None

        # Assert - Tech survey generated
        assert result.tech_survey is not None
        assert len(result.tech_survey.technologies) == 5
        assert len(result.tech_survey.risk_assessment) == 3
        assert len(result.tech_survey.recommendations) == 4

        # Assert - Architecture generated
        assert result.architecture is not None
        assert result.architecture.style == ArchitectureStyle.MODULAR_MONOLITH
        assert len(result.architecture.components) == 6
        assert len(result.architecture.data_flows) == 4
        assert len(result.architecture.diagrams) == 2

        # Assert - Implementation plan generated
        assert result.implementation_plan is not None
        assert len(result.implementation_plan.phases) == 4
        assert len(result.implementation_plan.tasks) == 12
        assert len(result.implementation_plan.critical_path) == 8

        # Assert - Artifacts written to filesystem
        artifact_dir = Path(artifact_writer.get_artifact_directory(agent_context.session_id))
        assert artifact_dir.exists()

        files = list(artifact_dir.iterdir())
        # Should have survey, architecture, plan (json + md each)
        assert len(files) >= 6

        json_files = [f for f in files if f.suffix == ".json"]
        md_files = [f for f in files if f.suffix == ".md"]

        assert len(json_files) >= 3
        assert len(md_files) >= 3

        # Assert - JSON artifacts are valid
        for json_file in json_files:
            content = json_file.read_text()
            data = json.loads(content)
            assert isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_design_workflow_with_hitl2_submission(
        self,
        artifact_writer,
        design_config,
        agent_context,
        sample_prd_content,
        hitl_dispatcher,
        mock_event_publisher,
    ) -> None:
        """Test that design workflow submits to HITL-2 gate correctly.

        This test validates:
        1. Surveyor and Architect complete successfully
        2. HITL-2 gate request is submitted
        3. Gate request contains architecture evidence
        4. GATE_REQUESTED event is published
        """
        # Arrange - Create mock that only returns survey + arch responses
        mock_client = MagicMock()

        survey_response = {
            "technologies": [{"category": "lang", "selected": "Python", "alternatives": [], "rationale": ""}],
            "risks": [],
            "recommendations": [],
        }
        arch_response = {
            "style": "modular_monolith",
            "components": [{"name": "API", "responsibility": "Handle requests", "technology": "FastAPI"}],
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
            config=design_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act
        result = await coordinator.run(
            context=agent_context,
            prd_content=sample_prd_content,
        )

        # Assert - Workflow returns pending HITL-2
        assert result.success is True
        assert result.hitl2_request_id is not None
        assert result.metadata.get("status") == "pending_hitl2"

        # Assert - Gate request was created
        gate_request = await hitl_dispatcher.get_request_by_id(result.hitl2_request_id)
        assert gate_request is not None
        assert gate_request.gate_type == GateType.HITL_2_DESIGN
        assert gate_request.status == GateStatus.PENDING

        # Assert - Event was published
        assert len(mock_event_publisher.events) >= 1
        gate_event = next(
            (e for e in mock_event_publisher.events if e.event_type == EventType.GATE_REQUESTED),
            None,
        )
        assert gate_event is not None

    @pytest.mark.asyncio
    async def test_design_workflow_with_hitl3_submission(
        self,
        artifact_writer,
        design_config,
        agent_context,
        sample_prd_content,
        mock_llm_responses,
    ) -> None:
        """Test that design workflow submits to HITL-3 after HITL-2 approval.

        This test validates:
        1. Resume from HITL-2 approval works
        2. Planner completes successfully
        3. HITL-3 gate request would be submitted (mocked)
        """
        # Arrange
        mock_client = MagicMock()
        mock_client.generate = AsyncMock(
            return_value=LLMResponse(
                content=json.dumps(mock_llm_responses["plan"]),
                model="test",
            )
        )
        mock_client.model_name = "test-model"

        # Create approved tech survey and architecture
        tech_survey = TechSurvey.create(
            prd_reference="PRD-001",
            technologies=[
                TechnologyChoice(category="lang", selected="Python", alternatives=[], rationale=""),
            ],
            risk_assessment=[],
            recommendations=[],
        )

        architecture = Architecture.create(
            style=ArchitectureStyle.MODULAR_MONOLITH,
            components=[
                Component(name="API", responsibility="Handle", technology="FastAPI"),
            ],
            data_flows=[],
            deployment_model="Docker",
            diagrams=[],
            tech_survey_reference="TECH-001",
            security_considerations=[],
        )

        coordinator = DesignCoordinator(
            llm_client=mock_client,
            artifact_writer=artifact_writer,
            config=design_config,
        )

        # Act - Resume from HITL-2 approval
        result = await coordinator.run_from_hitl2_approval(
            context=agent_context,
            tech_survey=tech_survey,
            architecture=architecture,
            prd_content=sample_prd_content,
            skip_hitl=True,
        )

        # Assert - Workflow completed
        assert result.success is True
        assert result.implementation_plan is not None
        assert len(result.implementation_plan.tasks) == 12

    @pytest.mark.asyncio
    async def test_design_workflow_idempotency(
        self,
        artifact_writer,
        design_config,
        sample_prd_content,
        workspace_path,
        mock_llm_responses,
    ) -> None:
        """Test that design workflow produces consistent results on repeated runs."""
        # Create fresh mock for each run
        def create_mock_client():
            client = MagicMock()
            client.generate = AsyncMock(
                side_effect=[
                    LLMResponse(content=json.dumps(mock_llm_responses["survey"]), model="test"),
                    LLMResponse(content=json.dumps(mock_llm_responses["architecture"]), model="test"),
                    LLMResponse(content=json.dumps(mock_llm_responses["plan"]), model="test"),
                ]
            )
            client.model_name = "test-model"
            return client

        # Run 1
        context1 = AgentContext(
            session_id=f"design-run1-{uuid.uuid4().hex[:8]}",
            task_id=f"task-run1-{uuid.uuid4().hex[:8]}",
            tenant_id="default",
            workspace_path=str(workspace_path),
        )

        coordinator1 = DesignCoordinator(
            llm_client=create_mock_client(),
            artifact_writer=artifact_writer,
            config=design_config,
        )

        result1 = await coordinator1.run(
            context=context1,
            prd_content=sample_prd_content,
            skip_hitl=True,
        )

        # Run 2
        context2 = AgentContext(
            session_id=f"design-run2-{uuid.uuid4().hex[:8]}",
            task_id=f"task-run2-{uuid.uuid4().hex[:8]}",
            tenant_id="default",
            workspace_path=str(workspace_path),
        )

        coordinator2 = DesignCoordinator(
            llm_client=create_mock_client(),
            artifact_writer=artifact_writer,
            config=design_config,
        )

        result2 = await coordinator2.run(
            context=context2,
            prd_content=sample_prd_content,
            skip_hitl=True,
        )

        # Assert - Both runs succeeded
        assert result1.success is True
        assert result2.success is True

        # Assert - Structurally equivalent results
        assert len(result1.tech_survey.technologies) == len(result2.tech_survey.technologies)
        assert result1.architecture.style == result2.architecture.style
        assert len(result1.architecture.components) == len(result2.architecture.components)
        assert len(result1.implementation_plan.tasks) == len(result2.implementation_plan.tasks)
        assert len(result1.implementation_plan.phases) == len(result2.implementation_plan.phases)

    @pytest.mark.asyncio
    async def test_design_workflow_handles_surveyor_failure_gracefully(
        self,
        artifact_writer,
        design_config,
        agent_context,
        sample_prd_content,
    ) -> None:
        """Test that workflow handles surveyor agent failure gracefully."""
        # Arrange - LLM returns invalid JSON
        client = MagicMock()
        client.generate = AsyncMock(
            return_value=LLMResponse(content="Invalid JSON response", model="test")
        )
        client.model_name = "test-model"

        coordinator = DesignCoordinator(
            llm_client=client,
            artifact_writer=artifact_writer,
            config=design_config,
        )

        # Act
        result = await coordinator.run(
            context=agent_context,
            prd_content=sample_prd_content,
            skip_hitl=True,
        )

        # Assert - Failure is captured
        assert result.success is False
        assert result.error_message is not None
        assert result.tech_survey is None

    @pytest.mark.asyncio
    async def test_artifact_content_structure_validation(
        self,
        mock_llm_client,
        artifact_writer,
        design_config,
        agent_context,
        sample_prd_content,
    ) -> None:
        """Test that generated artifacts have correct content structure."""
        # Arrange
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            config=design_config,
        )

        # Act
        result = await coordinator.run(
            context=agent_context,
            prd_content=sample_prd_content,
            skip_hitl=True,
        )

        # Assert - Tech survey structure
        survey = result.tech_survey
        for tech in survey.technologies:
            assert tech.category is not None
            assert tech.selected is not None

        for risk in survey.risk_assessment:
            assert risk.id.startswith("RISK-")
            assert risk.level in RiskLevel

        # Assert - Architecture structure
        arch = result.architecture
        assert arch.style in ArchitectureStyle
        for component in arch.components:
            assert component.name is not None
            assert component.responsibility is not None

        for flow in arch.data_flows:
            assert flow.source is not None
            assert flow.target is not None

        # Assert - Implementation plan structure
        plan = result.implementation_plan
        for phase in plan.phases:
            assert phase.name is not None
            assert phase.order >= 1
            assert len(phase.task_ids) > 0

        for task in plan.tasks:
            assert task.id.startswith("T")
            assert task.title is not None
            assert task.component is not None


class TestDesignWorkflowWithRealRedis:
    """E2E tests that require real Redis instance."""

    @pytest.mark.asyncio
    async def test_hitl2_gate_lifecycle(
        self,
        artifact_writer,
        design_config,
        agent_context,
        sample_prd_content,
        redis_client,
        mock_event_publisher,
    ) -> None:
        """Test complete HITL-2 gate lifecycle: request → pending → approved."""
        # Arrange
        mock_client = MagicMock()

        survey_response = {
            "technologies": [{"category": "lang", "selected": "Python", "alternatives": [], "rationale": ""}],
            "risks": [],
            "recommendations": [],
        }
        arch_response = {
            "style": "modular_monolith",
            "components": [{"name": "API", "responsibility": "Handle", "technology": "FastAPI"}],
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

        decision_logger = DecisionLogger(redis_client)
        hitl_dispatcher = HITLDispatcher(
            redis_client=redis_client,
            event_publisher=mock_event_publisher,
            decision_logger=decision_logger,
        )

        coordinator = DesignCoordinator(
            llm_client=mock_client,
            artifact_writer=artifact_writer,
            config=design_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act - Run design
        result = await coordinator.run(
            context=agent_context,
            prd_content=sample_prd_content,
        )

        # Assert - Request created
        assert result.hitl2_request_id is not None

        # Act - Simulate human approval
        decision = await hitl_dispatcher.record_decision(
            request_id=result.hitl2_request_id,
            approved=True,
            reviewer="e2e-test-reviewer",
            reason="Architecture is well-designed",
        )

        # Assert - Decision recorded
        assert decision.approved is True

        # Assert - Request status updated
        updated_request = await hitl_dispatcher.get_request_by_id(result.hitl2_request_id)
        assert updated_request.status == GateStatus.APPROVED

    @pytest.mark.asyncio
    async def test_hitl2_rejection_and_feedback(
        self,
        artifact_writer,
        design_config,
        agent_context,
        sample_prd_content,
        redis_client,
        mock_event_publisher,
    ) -> None:
        """Test HITL-2 rejection scenario with feedback."""
        # Arrange
        mock_client = MagicMock()

        survey_response = {
            "technologies": [{"category": "lang", "selected": "Python", "alternatives": [], "rationale": ""}],
            "risks": [],
            "recommendations": [],
        }
        arch_response = {
            "style": "modular_monolith",
            "components": [{"name": "API", "responsibility": "Handle", "technology": "FastAPI"}],
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

        decision_logger = DecisionLogger(redis_client)
        hitl_dispatcher = HITLDispatcher(
            redis_client=redis_client,
            event_publisher=mock_event_publisher,
            decision_logger=decision_logger,
        )

        coordinator = DesignCoordinator(
            llm_client=mock_client,
            artifact_writer=artifact_writer,
            config=design_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act - Run design
        result = await coordinator.run(
            context=agent_context,
            prd_content=sample_prd_content,
        )

        # Act - Simulate rejection
        decision = await hitl_dispatcher.record_decision(
            request_id=result.hitl2_request_id,
            approved=False,
            reviewer="e2e-test-reviewer",
            reason="Architecture needs more security considerations",
        )

        # Assert - Decision recorded
        assert decision.approved is False

        # Assert - Request status updated
        updated_request = await hitl_dispatcher.get_request_by_id(result.hitl2_request_id)
        assert updated_request.status == GateStatus.REJECTED

        # Assert - Rejection event published
        rejection_events = [
            e for e in mock_event_publisher.events
            if e.event_type == EventType.GATE_REJECTED
        ]
        assert len(rejection_events) >= 1


# Cleanup fixture
@pytest.fixture(autouse=True)
async def cleanup_redis_keys(redis_client, unique_session_id, unique_task_id):
    """Clean up Redis keys after each test."""
    yield

    if redis_client:
        patterns = [
            "asdlc:gate_request:*",
            "asdlc:evidence_bundle:*",
            f"asdlc:decision_log:{unique_task_id}",
            "asdlc:pending_gates",
        ]

        for pattern in patterns:
            try:
                keys = await redis_client.keys(pattern)
                if keys:
                    await redis_client.delete(*keys)
            except Exception:
                pass  # Ignore cleanup errors
