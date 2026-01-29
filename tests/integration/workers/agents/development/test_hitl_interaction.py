"""Integration tests for HITL interaction.

Tests the Human-In-The-Loop (HITL) gate submission and rejection handling
in the TDD workflow.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
from src.workers.agents.protocols import AgentContext


class TestHITL4EvidenceBundleSubmission:
    """Tests for HITL-4 evidence bundle submission."""

    @pytest.mark.asyncio
    async def test_submits_evidence_bundle_on_success(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that evidence bundle is submitted to HITL-4 on successful TDD completion."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator",
            acceptance_criteria=["add(2, 3) == 5"],
        )

        assert result.success is True
        assert result.hitl4_request_id == "integration-test-hitl4-request"
        mock_hitl_dispatcher.request_gate.assert_called_once()

    @pytest.mark.asyncio
    async def test_evidence_bundle_contains_required_items(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that evidence bundle contains all required items."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        assert result.success is True

        # Verify evidence bundle was submitted with proper structure
        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Check required item types
        item_types = {item.item_type for item in evidence_bundle.items}
        assert "artifact" in item_types  # Implementation
        assert "test_suite" in item_types  # Test suite
        assert "test_result" in item_types  # Test results
        assert "review" in item_types  # Code review

    @pytest.mark.asyncio
    async def test_evidence_bundle_includes_test_coverage(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that evidence bundle includes test coverage information."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Find test result item and verify coverage
        test_result_items = [i for i in evidence_bundle.items if i.item_type == "test_result"]
        assert len(test_result_items) > 0
        assert test_result_items[0].metadata.get("coverage") is not None

    @pytest.mark.asyncio
    async def test_evidence_bundle_summary_is_descriptive(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that evidence bundle summary is descriptive."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator with add and subtract",
            acceptance_criteria=["add works", "subtract works"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Summary should contain task description
        assert "calculator" in evidence_bundle.summary.lower() or "add" in evidence_bundle.summary.lower()

    @pytest.mark.asyncio
    async def test_no_submission_without_dispatcher(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that no HITL submission occurs when dispatcher is not configured."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            # No hitl_dispatcher
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        assert result.success is True
        assert result.hitl4_request_id is None


class TestHITL4RejectionHandling:
    """Tests for handling HITL-4 gate rejections."""

    @pytest.mark.asyncio
    async def test_handles_rejection_with_reason(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher_rejected: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that HITL-4 rejection is handled with feedback."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher_rejected,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        # Result should indicate rejection
        assert result.success is False
        assert result.hitl4_request_id == "integration-test-hitl4-rejected"
        assert result.metadata.get("hitl4_status") == "rejected"
        assert "quality" in result.metadata.get("hitl4_reason", "").lower()

    @pytest.mark.asyncio
    async def test_rejection_preserves_implementation(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher_rejected: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that rejection still preserves the implementation for review."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher_rejected,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        assert result.success is False
        # Even on rejection, implementation should be preserved
        assert result.implementation is not None


class TestHITL4EvidenceItems:
    """Tests for individual evidence items in HITL-4 bundle."""

    @pytest.mark.asyncio
    async def test_implementation_evidence_includes_files(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that implementation evidence includes file information."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Find artifact item
        artifact_items = [i for i in evidence_bundle.items if i.item_type == "artifact"]
        assert len(artifact_items) > 0
        assert "files" in artifact_items[0].metadata

    @pytest.mark.asyncio
    async def test_test_suite_evidence_includes_count(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that test suite evidence includes test count."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Find test suite item
        test_suite_items = [i for i in evidence_bundle.items if i.item_type == "test_suite"]
        assert len(test_suite_items) > 0
        assert test_suite_items[0].metadata.get("test_count") is not None

    @pytest.mark.asyncio
    async def test_review_evidence_includes_status(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that review evidence includes pass/fail status."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Find review item
        review_items = [i for i in evidence_bundle.items if i.item_type == "review"]
        assert len(review_items) > 0
        assert review_items[0].metadata.get("passed") is not None


class TestHITL4GateType:
    """Tests for HITL-4 gate type specification."""

    @pytest.mark.asyncio
    async def test_gate_type_is_hitl4_code(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that gate type is HITL_4_CODE."""
        from src.orchestrator.evidence_bundle import GateType

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        assert call_kwargs["gate_type"] == GateType.HITL_4_CODE

    @pytest.mark.asyncio
    async def test_requested_by_tdd_orchestrator(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that request is attributed to TDD orchestrator."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        assert call_kwargs["requested_by"] == "tdd_orchestrator"


class TestHITL4ContentHashes:
    """Tests for content hash computation in evidence items."""

    @pytest.mark.asyncio
    async def test_evidence_items_have_content_hashes(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that all evidence items have content hashes for verification."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # All items should have content hashes
        for item in evidence_bundle.items:
            assert item.content_hash is not None
            assert len(item.content_hash) > 0
