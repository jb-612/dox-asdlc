"""Integration tests for Validation -> Security flow.

Tests that Validation agent output can flow correctly into Security agent,
and that the combined workflow produces the expected results.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from src.workers.agents.protocols import AgentContext
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import SecurityReport, ValidationReport
from src.workers.agents.validation.security_agent import SecurityAgent
from src.workers.agents.validation.validation_agent import ValidationAgent


class TestValidationSecurityFlow:
    """Integration tests for Validation -> Security flow."""

    @pytest.mark.asyncio
    async def test_validation_passes_to_security(
        self,
        validation_agent: ValidationAgent,
        security_agent: SecurityAgent,
        agent_context: AgentContext,
        sample_implementation: dict,
        sample_acceptance_criteria: list[str],
    ) -> None:
        """Test that validation output flows correctly to security agent."""
        # Step 1: Run Validation Agent
        validation_result = await validation_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
                "acceptance_criteria": sample_acceptance_criteria,
            },
        )

        assert validation_result.success is True
        assert "validation_report" in validation_result.metadata
        assert validation_result.metadata.get("next_agent") == "security_agent"

        # Step 2: Run Security Agent with same implementation
        security_result = await security_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
                "feature_id": sample_implementation.get("feature_id"),
            },
        )

        assert security_result.success is True
        assert "security_report" in security_result.metadata
        assert security_result.metadata.get("hitl_gate") == "HITL-5"

    @pytest.mark.asyncio
    async def test_validation_failure_blocks_security(
        self,
        validation_agent: ValidationAgent,
        security_agent: SecurityAgent,
        agent_context: AgentContext,
        sample_implementation: dict,
    ) -> None:
        """Test that validation failure should block security in a real workflow."""
        # Run validation with missing acceptance criteria (should fail)
        validation_result = await validation_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
                "acceptance_criteria": [],  # Empty criteria - should fail
            },
        )

        assert validation_result.success is False
        assert "acceptance_criteria" in validation_result.error_message.lower()

        # In a real workflow, security would not run
        # This test verifies the validation failure condition

    @pytest.mark.asyncio
    async def test_security_detects_vulnerabilities_in_insecure_code(
        self,
        security_agent_strict: SecurityAgent,
        agent_context: AgentContext,
        insecure_implementation: dict,
    ) -> None:
        """Test that security agent detects vulnerabilities."""
        security_result = await security_agent_strict.execute(
            context=agent_context,
            event_metadata={
                "implementation": insecure_implementation,
                "feature_id": insecure_implementation.get("feature_id"),
            },
        )

        # The security agent should find the hardcoded secrets
        # and return a failing result
        assert security_result.success is False
        assert "security_report" in security_result.metadata

        report_dict = security_result.metadata["security_report"]
        assert len(report_dict.get("findings", [])) > 0

    @pytest.mark.asyncio
    async def test_artifacts_are_written_for_both_agents(
        self,
        validation_agent: ValidationAgent,
        security_agent: SecurityAgent,
        agent_context: AgentContext,
        sample_implementation: dict,
        sample_acceptance_criteria: list[str],
        workspace_path: Path,
    ) -> None:
        """Test that both agents write artifacts to workspace."""
        # Run validation
        validation_result = await validation_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
                "acceptance_criteria": sample_acceptance_criteria,
            },
        )

        assert validation_result.success is True
        assert len(validation_result.artifact_paths) > 0

        # Verify validation artifacts exist
        for path in validation_result.artifact_paths:
            assert Path(path).exists(), f"Validation artifact not found: {path}"

        # Run security
        security_result = await security_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
            },
        )

        assert security_result.success is True
        assert len(security_result.artifact_paths) > 0

        # Verify security artifacts exist
        for path in security_result.artifact_paths:
            assert Path(path).exists(), f"Security artifact not found: {path}"

    @pytest.mark.asyncio
    async def test_validation_report_structure_is_complete(
        self,
        validation_agent: ValidationAgent,
        agent_context: AgentContext,
        sample_implementation: dict,
        sample_acceptance_criteria: list[str],
    ) -> None:
        """Test that validation report has all required fields."""
        result = await validation_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
                "acceptance_criteria": sample_acceptance_criteria,
            },
        )

        assert result.success is True

        report_dict = result.metadata["validation_report"]

        # Verify required fields
        assert "feature_id" in report_dict
        assert "checks" in report_dict
        assert "e2e_results" in report_dict
        assert "passed" in report_dict
        assert "recommendations" in report_dict

        # Verify e2e_results structure
        e2e = report_dict["e2e_results"]
        assert "passed" in e2e
        assert "failed" in e2e
        assert "coverage" in e2e

    @pytest.mark.asyncio
    async def test_security_report_structure_is_complete(
        self,
        security_agent: SecurityAgent,
        agent_context: AgentContext,
        sample_implementation: dict,
    ) -> None:
        """Test that security report has all required fields."""
        result = await security_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
            },
        )

        assert result.success is True

        report_dict = result.metadata["security_report"]

        # Verify required fields
        assert "feature_id" in report_dict
        assert "findings" in report_dict
        assert "passed" in report_dict
        assert "scan_coverage" in report_dict
        assert "compliance_status" in report_dict


class TestValidationSecurityEdgeCases:
    """Edge case tests for Validation -> Security flow."""

    @pytest.mark.asyncio
    async def test_missing_implementation_fails_validation(
        self,
        validation_agent: ValidationAgent,
        agent_context: AgentContext,
        sample_acceptance_criteria: list[str],
    ) -> None:
        """Test that missing implementation fails validation."""
        result = await validation_agent.execute(
            context=agent_context,
            event_metadata={
                # Missing implementation
                "acceptance_criteria": sample_acceptance_criteria,
            },
        )

        assert result.success is False
        assert "implementation" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_missing_implementation_fails_security(
        self,
        security_agent: SecurityAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that missing implementation fails security scan."""
        result = await security_agent.execute(
            context=agent_context,
            event_metadata={
                # Missing implementation
            },
        )

        assert result.success is False
        assert "implementation" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_empty_files_implementation_handled(
        self,
        security_agent: SecurityAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that implementation with empty files is handled."""
        result = await security_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {
                    "feature_id": "test",
                    "files": [],  # Empty files
                },
            },
        )

        # Should still succeed with empty code (no vulnerabilities found)
        assert result.success is True

    @pytest.mark.asyncio
    async def test_compliance_frameworks_parameter(
        self,
        security_agent: SecurityAgent,
        agent_context: AgentContext,
        sample_implementation: dict,
    ) -> None:
        """Test that compliance frameworks parameter is used."""
        result = await security_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
                "compliance_frameworks": ["OWASP_TOP_10", "PCI_DSS"],
            },
        )

        assert result.success is True
        report_dict = result.metadata["security_report"]

        # compliance_status should include frameworks
        assert "compliance_status" in report_dict


class TestValidationSecurityReportSerialization:
    """Tests for report serialization in the flow."""

    @pytest.mark.asyncio
    async def test_validation_report_can_be_deserialized(
        self,
        validation_agent: ValidationAgent,
        agent_context: AgentContext,
        sample_implementation: dict,
        sample_acceptance_criteria: list[str],
    ) -> None:
        """Test that validation report can be round-tripped."""
        result = await validation_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
                "acceptance_criteria": sample_acceptance_criteria,
                "feature_id": sample_implementation.get("feature_id"),
            },
        )

        assert result.success is True

        # Deserialize and verify
        report = ValidationReport.from_dict(result.metadata["validation_report"])
        # The agent uses feature_id from event_metadata, or falls back to task_id
        expected_id = sample_implementation.get("feature_id", agent_context.task_id)
        assert report.feature_id == expected_id
        assert report.passed is True

    @pytest.mark.asyncio
    async def test_security_report_can_be_deserialized(
        self,
        security_agent: SecurityAgent,
        agent_context: AgentContext,
        sample_implementation: dict,
    ) -> None:
        """Test that security report can be round-tripped."""
        result = await security_agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
            },
        )

        assert result.success is True

        # Deserialize and verify
        report = SecurityReport.from_dict(result.metadata["security_report"])
        assert report.feature_id is not None
        assert report.passed is True
        assert report.scan_coverage > 0


class TestValidationSecurityIntegrationWithMocks:
    """Tests using mock agents for coordinator-level integration."""

    @pytest.mark.asyncio
    async def test_mock_validation_agent_returns_expected_format(
        self,
        mock_validation_agent_for_coordinator: MagicMock,
        agent_context: AgentContext,
        sample_implementation: dict,
        sample_acceptance_criteria: list[str],
    ) -> None:
        """Test that mock validation agent returns expected format."""
        result = await mock_validation_agent_for_coordinator.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
                "acceptance_criteria": sample_acceptance_criteria,
            },
        )

        assert result.success is True
        assert "validation_report" in result.metadata
        assert result.metadata.get("next_agent") == "security_agent"

    @pytest.mark.asyncio
    async def test_mock_security_agent_returns_expected_format(
        self,
        mock_security_agent_for_coordinator: MagicMock,
        agent_context: AgentContext,
        sample_implementation: dict,
    ) -> None:
        """Test that mock security agent returns expected format."""
        result = await mock_security_agent_for_coordinator.execute(
            context=agent_context,
            event_metadata={
                "implementation": sample_implementation,
            },
        )

        assert result.success is True
        assert "security_report" in result.metadata
        assert result.metadata.get("hitl_gate") == "HITL-5"
