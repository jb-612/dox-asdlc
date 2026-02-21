"""Tests for ReleaseAgent.

Tests the release management agent that generates release manifests,
creates changelogs from commits, and documents rollback plans.

Uses mock_backend (AgentBackend) instead of mock_llm_client.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from src.workers.agents.backends.base import BackendResult
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.deployment.config import DeploymentConfig
from src.workers.agents.deployment.models import (
    ArtifactReference,
    ArtifactType,
    ReleaseManifest,
)
from src.workers.agents.validation.models import (
    CheckCategory,
    SecurityCategory,
    SecurityFinding,
    SecurityReport,
    Severity,
    ValidationCheck,
    ValidationReport,
)
from src.workers.agents.development.models import TestResult, TestRunResult


# Import the module under test
from src.workers.agents.deployment.release_agent import (
    ReleaseAgent,
    ReleaseAgentError,
)


def _make_backend_result(content_dict: dict) -> BackendResult:
    """Create a BackendResult from a dict, simulating JSON output."""
    json_str = json.dumps(content_dict)
    return BackendResult(
        success=True,
        output=json_str,
        structured_output=content_dict,
    )


def _make_failed_backend_result(error: str) -> BackendResult:
    """Create a failed BackendResult."""
    return BackendResult(
        success=False,
        output="",
        error=error,
    )


@pytest.fixture
def mock_backend():
    """Create a mock agent backend."""
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
def mock_artifact_writer():
    """Create a mock artifact writer."""
    writer = AsyncMock()
    writer.write_artifact = AsyncMock(return_value="/artifacts/release.json")
    return writer


@pytest.fixture
def deployment_config():
    """Create a deployment configuration."""
    return DeploymentConfig()


@pytest.fixture
def agent_context():
    """Create an agent context for testing."""
    return AgentContext(
        session_id="session-123",
        task_id="task-456",
        tenant_id="tenant-789",
        workspace_path="/workspace",
        context_pack={
            "files": [
                {"path": "src/feature.py", "content": "# feature code"},
            ],
        },
    )


@pytest.fixture
def passing_validation_report():
    """Create a passing validation report."""
    return ValidationReport(
        feature_id="P04-F04",
        checks=[
            ValidationCheck(
                name="E2E Tests",
                category=CheckCategory.FUNCTIONAL,
                passed=True,
                details="All E2E tests passed",
                evidence="test_output.log",
            ),
        ],
        e2e_results=TestRunResult(
            suite_id="e2e-suite",
            results=[
                TestResult(
                    test_id="test_feature",
                    passed=True,
                    output="Test passed",
                    error=None,
                    duration_ms=100,
                ),
            ],
            passed=1,
            failed=0,
            coverage=85.0,
        ),
        passed=True,
        recommendations=[],
    )


@pytest.fixture
def passing_security_report():
    """Create a passing security report (no blocking findings)."""
    return SecurityReport(
        feature_id="P04-F04",
        findings=[
            SecurityFinding(
                id="SEC-001",
                severity=Severity.LOW,
                category=SecurityCategory.CONFIGURATION,
                location="config.py:10",
                description="Minor configuration issue",
                remediation="Consider using environment variable",
            ),
        ],
        passed=True,
        scan_coverage=95.0,
        compliance_status={"OWASP": True, "PCI-DSS": True},
    )


@pytest.fixture
def commit_messages():
    """Create sample commit messages for changelog generation."""
    return [
        {
            "sha": "abc123",
            "message": "feat(P04-F04): Add validation agent",
            "author": "dev1",
            "date": "2026-01-28",
        },
        {
            "sha": "def456",
            "message": "fix(P04-F04): Fix validation timeout",
            "author": "dev2",
            "date": "2026-01-29",
        },
        {
            "sha": "ghi789",
            "message": "test(P04-F04): Add integration tests",
            "author": "dev1",
            "date": "2026-01-29",
        },
    ]


class TestReleaseAgentInit:
    """Tests for ReleaseAgent initialization."""

    def test_creates_with_required_args(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
    ):
        """Test that agent can be created with required arguments."""
        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        assert agent is not None
        assert agent.agent_type == "release_agent"

    def test_agent_type_is_release_agent(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
    ):
        """Test that agent_type property returns correct value."""
        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        assert agent.agent_type == "release_agent"


class TestReleaseAgentExecute:
    """Tests for ReleaseAgent.execute method."""

    @pytest.mark.asyncio
    async def test_returns_failure_when_no_validation_report(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
    ):
        """Test that execute returns failure when no validation report provided."""
        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={},  # No validation_report
        )

        assert result.success is False
        assert "validation" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_returns_failure_when_no_security_report(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
    ):
        """Test that execute returns failure when no security report provided."""
        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                # No security_report
            },
        )

        assert result.success is False
        assert "security" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_generates_release_manifest_successfully(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
        commit_messages,
    ):
        """Test that agent generates a release manifest successfully."""
        response_data = {
            "version": "1.0.0",
            "features": ["P04-F04"],
            "changelog": "## Version 1.0.0\n\n- feat(P04-F04): Add validation agent\n- fix(P04-F04): Fix validation timeout\n- test(P04-F04): Add integration tests",
            "artifacts": [
                {
                    "name": "dox-asdlc",
                    "artifact_type": "docker_image",
                    "location": "registry.io/dox-asdlc:1.0.0",
                    "checksum": "sha256:abc123",
                },
            ],
            "rollback_plan": "1. Identify the issue\n2. Run: kubectl rollout undo deployment/dox-asdlc\n3. Verify service health",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "commits": commit_messages,
                "version": "1.0.0",
            },
        )

        assert result.success is True
        assert result.agent_type == "release_agent"
        assert "release_manifest" in result.metadata
        assert result.metadata.get("next_agent") == "deployment_agent"

    @pytest.mark.asyncio
    async def test_creates_changelog_from_commits(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
        commit_messages,
    ):
        """Test that agent creates changelog from commit messages."""
        response_data = {
            "version": "1.0.0",
            "features": ["P04-F04"],
            "changelog": "## Version 1.0.0\n\n### Features\n- Add validation agent\n\n### Bug Fixes\n- Fix validation timeout\n\n### Testing\n- Add integration tests",
            "artifacts": [],
            "rollback_plan": "Rollback steps here",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "commits": commit_messages,
                "version": "1.0.0",
            },
        )

        assert result.success is True
        manifest = result.metadata["release_manifest"]
        # Changelog should contain categorized entries
        assert "1.0.0" in manifest["changelog"]

    @pytest.mark.asyncio
    async def test_documents_rollback_plan(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that agent documents a rollback plan."""
        response_data = {
            "version": "1.0.0",
            "features": ["P04-F04"],
            "changelog": "Changes here",
            "artifacts": [],
            "rollback_plan": "## Rollback Procedure\n\n1. Identify affected services\n2. Run: kubectl rollout undo deployment/dox-asdlc\n3. Verify database migrations (if any) are backward compatible\n4. Monitor service health for 15 minutes\n5. Notify stakeholders of rollback",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "1.0.0",
            },
        )

        assert result.success is True
        manifest = result.metadata["release_manifest"]
        assert "rollback" in manifest["rollback_plan"].lower()
        assert len(manifest["rollback_plan"]) > 0

    @pytest.mark.asyncio
    async def test_includes_artifact_references(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that agent includes artifact references in manifest."""
        response_data = {
            "version": "1.0.0",
            "features": ["P04-F04"],
            "changelog": "Changes",
            "artifacts": [
                {
                    "name": "orchestrator",
                    "artifact_type": "docker_image",
                    "location": "registry.io/orchestrator:1.0.0",
                    "checksum": "sha256:abc123",
                },
                {
                    "name": "dox-asdlc-chart",
                    "artifact_type": "helm_chart",
                    "location": "charts/dox-asdlc-1.0.0.tgz",
                    "checksum": "sha256:def456",
                },
            ],
            "rollback_plan": "Rollback steps",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "1.0.0",
            },
        )

        assert result.success is True
        manifest = result.metadata["release_manifest"]
        assert len(manifest["artifacts"]) == 2
        assert manifest["artifacts"][0]["artifact_type"] == "docker_image"
        assert manifest["artifacts"][1]["artifact_type"] == "helm_chart"

    @pytest.mark.asyncio
    async def test_sets_next_agent_to_deployment(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that next_agent is set to deployment_agent on success."""
        response_data = {
            "version": "1.0.0",
            "features": [],
            "changelog": "",
            "artifacts": [],
            "rollback_plan": "",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "1.0.0",
            },
        )

        assert result.success is True
        assert result.metadata.get("next_agent") == "deployment_agent"


class TestReleaseAgentArtifactWriting:
    """Tests for artifact writing."""

    @pytest.mark.asyncio
    async def test_writes_json_artifact(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that agent writes JSON artifact."""
        response_data = {
            "version": "1.0.0",
            "features": [],
            "changelog": "",
            "artifacts": [],
            "rollback_plan": "",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "1.0.0",
            },
        )

        assert result.success is True
        assert mock_artifact_writer.write_artifact.called
        assert len(result.artifact_paths) > 0

    @pytest.mark.asyncio
    async def test_writes_markdown_artifact(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that agent writes Markdown artifact."""
        # Track calls to write_artifact to verify both JSON and MD are written
        call_count = [0]
        original_return = mock_artifact_writer.write_artifact.return_value

        async def track_calls(*args, **kwargs):
            call_count[0] += 1
            filename = kwargs.get("filename", "")
            if ".md" in filename:
                return "/artifacts/release.md"
            return "/artifacts/release.json"

        mock_artifact_writer.write_artifact.side_effect = track_calls

        response_data = {
            "version": "1.0.0",
            "features": ["P04-F04"],
            "changelog": "Changes",
            "artifacts": [],
            "rollback_plan": "Steps",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "1.0.0",
            },
        )

        assert result.success is True
        # Should write at least JSON and Markdown
        assert call_count[0] >= 2


class TestReleaseAgentVersioning:
    """Tests for version handling."""

    @pytest.mark.asyncio
    async def test_uses_provided_version(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that agent uses the version provided in metadata."""
        response_data = {
            "version": "2.5.0",
            "features": [],
            "changelog": "",
            "artifacts": [],
            "rollback_plan": "",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "2.5.0",
            },
        )

        assert result.success is True
        manifest = result.metadata["release_manifest"]
        assert manifest["version"] == "2.5.0"

    @pytest.mark.asyncio
    async def test_generates_version_when_not_provided(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that agent generates a version when not provided."""
        response_data = {
            "version": "0.1.0",
            "features": [],
            "changelog": "",
            "artifacts": [],
            "rollback_plan": "",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                # No version provided
            },
        )

        assert result.success is True
        manifest = result.metadata["release_manifest"]
        # Should have some version
        assert manifest["version"] is not None
        assert len(manifest["version"]) > 0


class TestReleaseAgentErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_handles_backend_error_gracefully(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that agent handles backend errors gracefully."""
        mock_backend.execute.side_effect = Exception("Backend service unavailable")

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "1.0.0",
            },
        )

        assert result.success is False
        assert "Backend service unavailable" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_handles_invalid_backend_response(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that agent handles invalid backend response."""
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output="This is not valid JSON",
            structured_output=None,
        )

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "1.0.0",
            },
        )

        assert result.success is False
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_handles_artifact_writer_error(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that agent handles artifact writer errors."""
        response_data = {
            "version": "1.0.0",
            "features": [],
            "changelog": "",
            "artifacts": [],
            "rollback_plan": "",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)
        mock_artifact_writer.write_artifact.side_effect = Exception("Write failed")

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "1.0.0",
            },
        )

        assert result.success is False
        assert "Write failed" in result.error_message
        assert result.should_retry is True


class TestReleaseAgentValidateContext:
    """Tests for context validation."""

    def test_validates_complete_context(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
    ):
        """Test that complete context passes validation."""
        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        assert agent.validate_context(agent_context) is True

    def test_rejects_incomplete_context(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
    ):
        """Test that incomplete context fails validation."""
        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        incomplete_context = AgentContext(
            session_id="",
            task_id="",
            tenant_id="",
            workspace_path="",
        )

        assert agent.validate_context(incomplete_context) is False


class TestReleaseAgentRollbackPlan:
    """Tests for rollback plan generation."""

    @pytest.mark.asyncio
    async def test_rollback_plan_includes_service_identification(
        self,
        mock_backend,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that rollback plan includes service identification steps."""
        response_data = {
            "version": "1.0.0",
            "features": [],
            "changelog": "",
            "artifacts": [],
            "rollback_plan": "1. Identify affected services: orchestrator, workers\n2. Roll back using kubectl rollout undo\n3. Verify health",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "1.0.0",
            },
        )

        assert result.success is True
        rollback_plan = result.metadata["release_manifest"]["rollback_plan"]
        # Should mention service identification
        assert "identify" in rollback_plan.lower() or "service" in rollback_plan.lower()

    @pytest.mark.asyncio
    async def test_rollback_plan_config_respected(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that rollback_enabled config is respected."""
        config = DeploymentConfig(rollback_enabled=True)

        response_data = {
            "version": "1.0.0",
            "features": [],
            "changelog": "",
            "artifacts": [],
            "rollback_plan": "Rollback is enabled and documented",
        }
        mock_backend.execute.return_value = _make_backend_result(response_data)

        agent = ReleaseAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": passing_validation_report.to_dict(),
                "security_report": passing_security_report.to_dict(),
                "version": "1.0.0",
            },
        )

        assert result.success is True
        # When rollback is enabled, plan should be populated
        rollback_plan = result.metadata["release_manifest"]["rollback_plan"]
        assert len(rollback_plan) > 0
