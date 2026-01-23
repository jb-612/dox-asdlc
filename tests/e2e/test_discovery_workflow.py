"""End-to-end tests for the Discovery Workflow.

Tests the complete discovery workflow from raw requirements through
PRD generation, acceptance criteria creation, and HITL-1 gate submission.

These tests require Docker containers to be running:
    docker compose -f docker/docker-compose.yml up -d

Test coverage:
- T12: E2E Validation for P04-F01 Discovery Agents
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
from src.workers.agents.discovery.config import DiscoveryConfig
from src.workers.agents.discovery.coordinator import (
    DiscoveryCoordinator,
    ProjectContext,
    run_discovery_workflow,
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
    return f"e2e-session-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def unique_task_id() -> str:
    """Generate unique task ID for test isolation."""
    return f"e2e-task-{uuid.uuid4().hex[:8]}"


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
def discovery_config() -> DiscoveryConfig:
    """Create test configuration with fast retries."""
    return DiscoveryConfig(
        max_retries=2,
        retry_delay_seconds=0.1,
        enable_rlm=False,  # Disable RLM for E2E simplicity
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
def project_context() -> ProjectContext:
    """Create project context for E2E tests."""
    return ProjectContext(
        name="E2E Test Project - User Management System",
        description="A system for managing user accounts with authentication and authorization",
        git_sha="e2e-test-sha-abc123",
    )


@pytest.fixture
def mock_llm_responses() -> dict[str, Any]:
    """Create comprehensive LLM mock responses for full workflow."""
    # Requirements extraction response
    extraction_response = {
        "requirements": [
            {
                "id": "REQ-001",
                "description": "Users shall be able to create new accounts with email and password",
                "priority": "must_have",
                "type": "functional",
                "rationale": "Core user onboarding functionality",
                "source": "User input",
            },
            {
                "id": "REQ-002",
                "description": "Users shall be able to authenticate using their credentials",
                "priority": "must_have",
                "type": "functional",
                "rationale": "Essential for system access",
                "source": "User input",
            },
            {
                "id": "REQ-003",
                "description": "System shall enforce password complexity rules",
                "priority": "must_have",
                "type": "non_functional",
                "rationale": "Security compliance requirement",
                "source": "Security best practices",
            },
            {
                "id": "REQ-004",
                "description": "Users shall be able to reset their forgotten passwords",
                "priority": "should_have",
                "type": "functional",
                "rationale": "User experience improvement",
                "source": "User input",
            },
            {
                "id": "REQ-005",
                "description": "System shall store passwords using bcrypt with cost factor 12",
                "priority": "must_have",
                "type": "non_functional",
                "rationale": "Industry standard for password storage",
                "source": "OWASP guidelines",
            },
        ],
        "ambiguous_areas": [],
        "suggested_questions": [],
    }

    # PRD generation response
    prd_response = {
        "title": "User Management System - Product Requirements Document",
        "version": "1.0.0",
        "executive_summary": (
            "This document outlines the requirements for a comprehensive user management "
            "system that enables secure user registration, authentication, and account "
            "management. The system prioritizes security while maintaining a smooth user experience."
        ),
        "objectives": {
            "title": "Objectives",
            "content": (
                "1. Provide secure user account creation and authentication\n"
                "2. Implement industry-standard password security measures\n"
                "3. Enable self-service password recovery\n"
                "4. Maintain audit trail of authentication events"
            ),
            "requirements": [],
            "subsections": [],
        },
        "scope": {
            "title": "Scope",
            "content": (
                "In Scope:\n"
                "- User registration with email verification\n"
                "- Password-based authentication\n"
                "- Password reset functionality\n"
                "- Basic account management\n\n"
                "Out of Scope:\n"
                "- OAuth/SSO integration (Phase 2)\n"
                "- Multi-factor authentication (Phase 2)\n"
                "- Role-based access control (Phase 2)"
            ),
            "requirements": [],
            "subsections": [],
        },
        "sections": [
            {
                "title": "Functional Requirements",
                "content": "Core functional requirements for user management.",
                "requirements": [
                    {
                        "id": "REQ-001",
                        "description": "Users shall be able to create new accounts with email and password",
                        "priority": "must_have",
                        "type": "functional",
                        "rationale": "Core user onboarding functionality",
                        "source": "User input",
                    },
                    {
                        "id": "REQ-002",
                        "description": "Users shall be able to authenticate using their credentials",
                        "priority": "must_have",
                        "type": "functional",
                        "rationale": "Essential for system access",
                        "source": "User input",
                    },
                    {
                        "id": "REQ-004",
                        "description": "Users shall be able to reset their forgotten passwords",
                        "priority": "should_have",
                        "type": "functional",
                        "rationale": "User experience improvement",
                        "source": "User input",
                    },
                ],
                "subsections": [],
            },
            {
                "title": "Non-Functional Requirements",
                "content": "Security and performance requirements.",
                "requirements": [
                    {
                        "id": "REQ-003",
                        "description": "System shall enforce password complexity rules",
                        "priority": "must_have",
                        "type": "non_functional",
                        "rationale": "Security compliance requirement",
                        "source": "Security best practices",
                    },
                    {
                        "id": "REQ-005",
                        "description": "System shall store passwords using bcrypt with cost factor 12",
                        "priority": "must_have",
                        "type": "non_functional",
                        "rationale": "Industry standard for password storage",
                        "source": "OWASP guidelines",
                    },
                ],
                "subsections": [],
            },
        ],
    }

    # Acceptance criteria response
    acceptance_response = {
        "criteria": [
            {
                "id": "AC-001",
                "requirement_ids": ["REQ-001"],
                "given": "a new user with a valid email address",
                "when": "the user submits the registration form with valid email and password",
                "then": "a new user account is created and confirmation email is sent",
                "notes": "Password must meet complexity requirements",
            },
            {
                "id": "AC-002",
                "requirement_ids": ["REQ-001"],
                "given": "a user attempting to register with an existing email",
                "when": "the user submits the registration form",
                "then": "an appropriate error message is displayed without revealing email existence",
                "notes": "Prevents user enumeration attacks",
            },
            {
                "id": "AC-003",
                "requirement_ids": ["REQ-002"],
                "given": "a registered user with valid credentials",
                "when": "the user logs in with correct email and password",
                "then": "the user is authenticated and granted access to the system",
                "notes": "",
            },
            {
                "id": "AC-004",
                "requirement_ids": ["REQ-002"],
                "given": "a user with invalid credentials",
                "when": "the user attempts to log in",
                "then": "access is denied with generic 'Invalid credentials' message",
                "notes": "Rate limiting applied after 5 failed attempts",
            },
            {
                "id": "AC-005",
                "requirement_ids": ["REQ-003"],
                "given": "a user creating a password",
                "when": "the password does not meet complexity requirements",
                "then": "clear error message indicates specific requirements not met",
                "notes": "Min 8 chars, uppercase, lowercase, number, special char",
            },
            {
                "id": "AC-006",
                "requirement_ids": ["REQ-004"],
                "given": "a user who has forgotten their password",
                "when": "the user requests a password reset with valid email",
                "then": "a secure reset link is sent to the registered email",
                "notes": "Link expires after 1 hour",
            },
            {
                "id": "AC-007",
                "requirement_ids": ["REQ-004"],
                "given": "a user with a valid password reset token",
                "when": "the user submits a new password meeting requirements",
                "then": "the password is updated and old sessions are invalidated",
                "notes": "",
            },
            {
                "id": "AC-008",
                "requirement_ids": ["REQ-005"],
                "given": "a new user registration",
                "when": "the password is stored in the database",
                "then": "the password is hashed using bcrypt with cost factor >= 12",
                "notes": "Verified via security audit",
            },
        ]
    }

    return {
        "extraction": extraction_response,
        "prd": prd_response,
        "acceptance": acceptance_response,
    }


@pytest.fixture
def mock_llm_client(mock_llm_responses) -> MagicMock:
    """Create mock LLM client with all workflow responses."""
    client = MagicMock()

    client.generate = AsyncMock(
        side_effect=[
            LLMResponse(content=json.dumps(mock_llm_responses["extraction"]), model="test"),
            LLMResponse(content=json.dumps(mock_llm_responses["prd"]), model="test"),
            LLMResponse(content=json.dumps(mock_llm_responses["acceptance"]), model="test"),
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


class TestDiscoveryWorkflowE2E:
    """End-to-end tests for the complete discovery workflow."""

    @pytest.mark.asyncio
    async def test_full_discovery_workflow_produces_all_artifacts(
        self,
        mock_llm_client,
        artifact_writer,
        discovery_config,
        agent_context,
        project_context,
    ) -> None:
        """Test that the complete discovery workflow produces all expected artifacts.

        This test validates:
        1. PRD document is generated from raw requirements
        2. Acceptance criteria are generated from PRD
        3. Both JSON and Markdown artifacts are written
        4. Coverage matrix is computed correctly
        5. All requirements have acceptance criteria coverage
        """
        # Arrange
        user_input = """
        Build a user management system with the following capabilities:
        - User registration with email and password
        - User login/authentication
        - Password reset functionality
        - Secure password storage
        - Password complexity enforcement
        """

        coordinator = DiscoveryCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            config=discovery_config,
            hitl_dispatcher=None,  # Test without HITL for artifact focus
        )

        # Act
        result = await coordinator.run_discovery(
            user_input=user_input,
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=False,
        )

        # Assert - Workflow success
        assert result.success is True
        assert result.error_message is None

        # Assert - PRD generated correctly
        assert result.prd is not None
        assert result.prd.title == "User Management System - Product Requirements Document"
        assert result.prd.version == "1.0.0"
        assert len(result.prd.all_requirements) == 5
        assert len(result.prd.sections) == 2

        # Assert - Acceptance criteria generated
        assert result.acceptance_criteria is not None
        assert len(result.acceptance_criteria.criteria) == 8
        assert result.acceptance_criteria.prd_version == "1.0.0"

        # Assert - Coverage computed
        coverage = result.acceptance_criteria.get_coverage_percentage()
        assert coverage == 100.0  # All requirements should be covered

        uncovered = result.acceptance_criteria.get_uncovered_requirements()
        assert len(uncovered) == 0

        # Assert - Artifacts written to filesystem
        artifact_dir = Path(artifact_writer.get_artifact_directory(agent_context.session_id))
        assert artifact_dir.exists()

        files = list(artifact_dir.iterdir())
        assert len(files) >= 4  # PRD.json, PRD.md, acceptance.json, acceptance.md

        json_files = [f for f in files if f.suffix == ".json"]
        md_files = [f for f in files if f.suffix == ".md"]

        assert len(json_files) >= 2
        assert len(md_files) >= 2

        # Assert - JSON artifacts are valid
        for json_file in json_files:
            content = json_file.read_text()
            data = json.loads(content)  # Should not raise
            assert isinstance(data, dict)

        # Assert - Metadata contains expected fields
        assert result.metadata is not None
        assert "prd_artifact_path" in result.metadata
        assert "acceptance_artifact_path" in result.metadata
        assert result.metadata["requirement_count"] == 5
        assert result.metadata["criteria_count"] == 8
        assert result.metadata["coverage_percentage"] == 100.0

    @pytest.mark.asyncio
    async def test_discovery_workflow_with_hitl_submission(
        self,
        mock_llm_client,
        artifact_writer,
        discovery_config,
        agent_context,
        project_context,
        hitl_dispatcher,
        mock_event_publisher,
    ) -> None:
        """Test that discovery workflow submits to HITL-1 gate correctly.

        This test validates:
        1. Evidence bundle is created with PRD and acceptance criteria
        2. HITL-1 gate request is submitted
        3. Gate request contains correct evidence items
        4. GATE_REQUESTED event is published
        """
        # Arrange
        user_input = "Build a user authentication system with registration and login"

        coordinator = DiscoveryCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            config=discovery_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act
        result = await coordinator.run_discovery(
            user_input=user_input,
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=True,
        )

        # Assert - Workflow success
        assert result.success is True
        assert result.gate_request_id is not None

        # Assert - Gate request was created
        gate_request = await hitl_dispatcher.get_request_by_id(result.gate_request_id)
        assert gate_request is not None
        assert gate_request.gate_type == GateType.HITL_1_BACKLOG
        assert gate_request.status == GateStatus.PENDING
        assert gate_request.task_id == agent_context.task_id
        assert gate_request.session_id == agent_context.session_id
        assert gate_request.requested_by == "discovery_coordinator"

        # Assert - Event was published
        assert len(mock_event_publisher.events) >= 1
        gate_event = next(
            (e for e in mock_event_publisher.events if e.event_type == EventType.GATE_REQUESTED),
            None,
        )
        assert gate_event is not None
        assert gate_event.metadata["request_id"] == result.gate_request_id
        assert gate_event.metadata["gate_type"] == "hitl_1_backlog"

    @pytest.mark.asyncio
    async def test_discovery_workflow_idempotency(
        self,
        artifact_writer,
        discovery_config,
        agent_context,
        project_context,
        workspace_path,
    ) -> None:
        """Test that discovery workflow produces consistent results on repeated runs.

        This validates the idempotent nature of the workflow - same input
        produces structurally equivalent output.
        """
        # Create fresh mock for each run with identical responses
        def create_mock_client():
            responses = {
                "extraction": {
                    "requirements": [
                        {"id": "REQ-001", "description": "User login", "priority": "must_have", "type": "functional"},
                    ],
                },
                "prd": {
                    "title": "Test PRD",
                    "version": "1.0.0",
                    "executive_summary": "Test",
                    "objectives": {"title": "Obj", "content": "", "requirements": [], "subsections": []},
                    "scope": {"title": "Scope", "content": "", "requirements": [], "subsections": []},
                    "sections": [
                        {
                            "title": "Requirements",
                            "content": "",
                            "requirements": [
                                {"id": "REQ-001", "description": "User login", "priority": "must_have", "type": "functional"},
                            ],
                            "subsections": [],
                        }
                    ],
                },
                "acceptance": {
                    "criteria": [
                        {"id": "AC-001", "requirement_ids": ["REQ-001"], "given": "G", "when": "W", "then": "T"},
                    ]
                },
            }
            client = MagicMock()
            client.generate = AsyncMock(
                side_effect=[
                    LLMResponse(content=json.dumps(responses["extraction"]), model="test"),
                    LLMResponse(content=json.dumps(responses["prd"]), model="test"),
                    LLMResponse(content=json.dumps(responses["acceptance"]), model="test"),
                ]
            )
            client.model_name = "test-model"
            return client

        user_input = "Build user login"

        # Run 1
        context1 = AgentContext(
            session_id=f"session-run1-{uuid.uuid4().hex[:8]}",
            task_id=f"task-run1-{uuid.uuid4().hex[:8]}",
            tenant_id="default",
            workspace_path=str(workspace_path),
        )

        coordinator1 = DiscoveryCoordinator(
            llm_client=create_mock_client(),
            artifact_writer=artifact_writer,
            config=discovery_config,
        )

        result1 = await coordinator1.run_discovery(
            user_input=user_input,
            project_context=project_context,
            context=context1,
            submit_to_hitl=False,
        )

        # Run 2
        context2 = AgentContext(
            session_id=f"session-run2-{uuid.uuid4().hex[:8]}",
            task_id=f"task-run2-{uuid.uuid4().hex[:8]}",
            tenant_id="default",
            workspace_path=str(workspace_path),
        )

        coordinator2 = DiscoveryCoordinator(
            llm_client=create_mock_client(),
            artifact_writer=artifact_writer,
            config=discovery_config,
        )

        result2 = await coordinator2.run_discovery(
            user_input=user_input,
            project_context=project_context,
            context=context2,
            submit_to_hitl=False,
        )

        # Assert - Both runs succeeded
        assert result1.success is True
        assert result2.success is True

        # Assert - Structurally equivalent results
        assert result1.prd.title == result2.prd.title
        assert result1.prd.version == result2.prd.version
        assert len(result1.prd.all_requirements) == len(result2.prd.all_requirements)
        assert len(result1.acceptance_criteria.criteria) == len(result2.acceptance_criteria.criteria)

        # Assert - Metadata matches
        assert result1.metadata["requirement_count"] == result2.metadata["requirement_count"]
        assert result1.metadata["criteria_count"] == result2.metadata["criteria_count"]
        assert result1.metadata["coverage_percentage"] == result2.metadata["coverage_percentage"]

    @pytest.mark.asyncio
    async def test_discovery_workflow_handles_prd_failure_gracefully(
        self,
        artifact_writer,
        discovery_config,
        agent_context,
        project_context,
    ) -> None:
        """Test that workflow handles PRD generation failures gracefully."""
        # Arrange - LLM returns invalid JSON
        client = MagicMock()
        client.generate = AsyncMock(
            return_value=LLMResponse(content="Invalid JSON response", model="test")
        )
        client.model_name = "test-model"

        coordinator = DiscoveryCoordinator(
            llm_client=client,
            artifact_writer=artifact_writer,
            config=discovery_config,
        )

        # Act
        result = await coordinator.run_discovery(
            user_input="Build something",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=False,
        )

        # Assert - Failure is captured
        assert result.success is False
        assert result.error_message is not None
        assert result.prd is None
        assert result.acceptance_criteria is None

    @pytest.mark.asyncio
    async def test_convenience_function_discovery_workflow(
        self,
        mock_llm_client,
        artifact_writer,
        discovery_config,
        workspace_path,
        unique_session_id,
        unique_task_id,
    ) -> None:
        """Test the convenience function runs complete workflow."""
        # Act
        result = await run_discovery_workflow(
            user_input="Build a user management system",
            project_name="E2E Convenience Test",
            session_id=unique_session_id,
            task_id=unique_task_id,
            workspace_path=str(workspace_path),
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            config=discovery_config,
            project_description="Testing convenience function",
            git_sha="test-sha",
            submit_to_hitl=False,
        )

        # Assert
        assert result.success is True
        assert result.prd is not None
        assert result.acceptance_criteria is not None

    @pytest.mark.asyncio
    async def test_artifact_content_structure_validation(
        self,
        mock_llm_client,
        artifact_writer,
        discovery_config,
        agent_context,
        project_context,
    ) -> None:
        """Test that generated artifacts have correct content structure."""
        # Arrange
        coordinator = DiscoveryCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            config=discovery_config,
        )

        # Act
        result = await coordinator.run_discovery(
            user_input="Build user auth",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=False,
        )

        # Assert - PRD structure
        prd = result.prd
        assert prd.title is not None and len(prd.title) > 0
        assert prd.executive_summary is not None
        assert prd.objectives is not None
        assert prd.scope is not None

        for section in prd.sections:
            assert section.title is not None
            # Sections with requirements should have them
            for req in section.requirements:
                assert req.id.startswith("REQ-")
                assert req.description is not None

        # Assert - Acceptance criteria structure
        criteria = result.acceptance_criteria
        for criterion in criteria.criteria:
            assert criterion.id.startswith("AC-")
            assert len(criterion.requirement_ids) > 0
            assert criterion.given is not None
            assert criterion.when is not None
            assert criterion.then is not None

        # Assert - Coverage matrix structure
        for entry in criteria.coverage_matrix:
            assert entry.requirement_id.startswith("REQ-")
            assert entry.coverage_level in ("full", "partial", "none")

    @pytest.mark.asyncio
    async def test_markdown_artifact_readability(
        self,
        mock_llm_client,
        artifact_writer,
        discovery_config,
        agent_context,
        project_context,
    ) -> None:
        """Test that markdown artifacts are human-readable."""
        # Arrange
        coordinator = DiscoveryCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            config=discovery_config,
        )

        # Act
        result = await coordinator.run_discovery(
            user_input="Build user auth",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=False,
        )

        # Assert - Get markdown content
        prd_md = result.prd.to_markdown()
        criteria_md = result.acceptance_criteria.to_markdown()

        # Assert - PRD markdown structure
        assert "# User Management System" in prd_md
        assert "## Executive Summary" in prd_md
        assert "## Objectives" in prd_md
        assert "## Scope" in prd_md
        assert "**Version:**" in prd_md
        assert "REQ-" in prd_md

        # Assert - Acceptance criteria markdown structure
        assert "# Acceptance Criteria" in criteria_md
        assert "## Criteria" in criteria_md
        assert "## Coverage Matrix" in criteria_md
        assert "**Given**" in criteria_md
        assert "**When**" in criteria_md
        assert "**Then**" in criteria_md
        assert "AC-" in criteria_md


class TestDiscoveryWorkflowWithRealRedis:
    """E2E tests that require real Redis instance.

    These tests are skipped if Redis is not available.
    """

    @pytest.mark.asyncio
    async def test_hitl_gate_lifecycle(
        self,
        mock_llm_client,
        artifact_writer,
        discovery_config,
        agent_context,
        project_context,
        redis_client,
        mock_event_publisher,
    ) -> None:
        """Test complete HITL gate lifecycle: request → pending → approved.

        This test validates the full gate workflow including:
        1. Gate request creation
        2. Request stored in Redis
        3. Decision recording
        4. Status update
        5. Event publication
        """
        # Arrange
        decision_logger = DecisionLogger(redis_client)
        hitl_dispatcher = HITLDispatcher(
            redis_client=redis_client,
            event_publisher=mock_event_publisher,
            decision_logger=decision_logger,
        )

        coordinator = DiscoveryCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            config=discovery_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act - Run discovery
        result = await coordinator.run_discovery(
            user_input="Build auth system",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=True,
        )

        # Assert - Request created
        assert result.gate_request_id is not None

        # Act - Simulate human approval
        decision = await hitl_dispatcher.record_decision(
            request_id=result.gate_request_id,
            approved=True,
            reviewer="e2e-test-reviewer",
            reason="PRD and acceptance criteria are complete and well-structured",
            conditions=["Ensure all security requirements are addressed"],
        )

        # Assert - Decision recorded
        assert decision.decision_id is not None
        assert decision.approved is True
        assert decision.reviewer == "e2e-test-reviewer"

        # Assert - Request status updated
        updated_request = await hitl_dispatcher.get_request_by_id(result.gate_request_id)
        assert updated_request.status == GateStatus.APPROVED

        # Assert - No longer in pending set
        pending = await hitl_dispatcher.get_pending_requests(GateType.HITL_1_BACKLOG)
        request_ids = [r.request_id for r in pending]
        assert result.gate_request_id not in request_ids

        # Assert - Approval event published
        approval_events = [
            e for e in mock_event_publisher.events
            if e.event_type == EventType.GATE_APPROVED
        ]
        assert len(approval_events) >= 1

    @pytest.mark.asyncio
    async def test_hitl_gate_rejection(
        self,
        mock_llm_client,
        artifact_writer,
        discovery_config,
        agent_context,
        project_context,
        redis_client,
        mock_event_publisher,
    ) -> None:
        """Test HITL gate rejection scenario."""
        # Arrange
        decision_logger = DecisionLogger(redis_client)
        hitl_dispatcher = HITLDispatcher(
            redis_client=redis_client,
            event_publisher=mock_event_publisher,
            decision_logger=decision_logger,
        )

        coordinator = DiscoveryCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            config=discovery_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act - Run discovery
        result = await coordinator.run_discovery(
            user_input="Build auth system",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=True,
        )

        # Act - Simulate human rejection
        decision = await hitl_dispatcher.record_decision(
            request_id=result.gate_request_id,
            approved=False,
            reviewer="e2e-test-reviewer",
            reason="Missing error handling requirements",
        )

        # Assert - Decision recorded
        assert decision.approved is False

        # Assert - Request status updated
        updated_request = await hitl_dispatcher.get_request_by_id(result.gate_request_id)
        assert updated_request.status == GateStatus.REJECTED

        # Assert - Rejection event published
        rejection_events = [
            e for e in mock_event_publisher.events
            if e.event_type == EventType.GATE_REJECTED
        ]
        assert len(rejection_events) >= 1

    @pytest.mark.asyncio
    async def test_audit_trail_created(
        self,
        mock_llm_client,
        artifact_writer,
        discovery_config,
        agent_context,
        project_context,
        redis_client,
        mock_event_publisher,
    ) -> None:
        """Test that audit trail is created for gate decisions."""
        # Arrange
        decision_logger = DecisionLogger(redis_client)
        hitl_dispatcher = HITLDispatcher(
            redis_client=redis_client,
            event_publisher=mock_event_publisher,
            decision_logger=decision_logger,
        )

        coordinator = DiscoveryCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            config=discovery_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act - Run discovery and approve
        result = await coordinator.run_discovery(
            user_input="Build auth system",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=True,
        )

        await hitl_dispatcher.record_decision(
            request_id=result.gate_request_id,
            approved=True,
            reviewer="e2e-test-reviewer",
            reason="Approved for testing",
        )

        # Assert - Audit trail exists
        history = await decision_logger.get_task_history(agent_context.task_id)
        assert len(history) >= 2  # Request + decision

        # Verify request event
        request_events = [e for e in history if e["event"] == "gate_requested"]
        assert len(request_events) >= 1

        # Verify decision event
        decision_events = [e for e in history if e["event"] == "gate_decision"]
        assert len(decision_events) >= 1
        assert decision_events[0]["approved"] == "true"


# Cleanup fixture
@pytest.fixture(autouse=True)
async def cleanup_redis_keys(redis_client, unique_session_id, unique_task_id):
    """Clean up Redis keys after each test."""
    yield

    if redis_client:
        # Clean up test keys
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
