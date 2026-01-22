"""Unit tests for evidence bundle models.

Tests EvidenceBundle, EvidenceItem, GateType, and validation logic.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest


class TestGateType:
    """Tests for GateType enum."""

    def test_all_gates_defined(self):
        """All 6 HITL gates are defined."""
        from src.orchestrator.evidence_bundle import GateType

        expected_gates = [
            "hitl_1_backlog",
            "hitl_2_design",
            "hitl_3_plan",
            "hitl_4_code",
            "hitl_5_validation",
            "hitl_6_release",
        ]

        for gate in expected_gates:
            assert hasattr(GateType, gate.upper()), f"Missing {gate}"


class TestEvidenceItem:
    """Tests for EvidenceItem dataclass."""

    def test_create_evidence_item(self):
        """EvidenceItem can be created."""
        from src.orchestrator.evidence_bundle import EvidenceItem

        item = EvidenceItem(
            item_type="artifact",
            path="/patches/task-1.patch",
            description="Patch file for authentication feature",
            content_hash="abc123",
        )

        assert item.item_type == "artifact"
        assert item.path == "/patches/task-1.patch"
        assert item.content_hash == "abc123"

    def test_evidence_item_metadata(self):
        """EvidenceItem can have metadata."""
        from src.orchestrator.evidence_bundle import EvidenceItem

        item = EvidenceItem(
            item_type="test_result",
            path="/reports/test-123.json",
            description="Unit test results",
            content_hash="def456",
            metadata={"passed": 50, "failed": 2},
        )

        assert item.metadata["passed"] == 50


class TestEvidenceBundle:
    """Tests for EvidenceBundle dataclass."""

    def test_create_evidence_bundle(self):
        """EvidenceBundle can be created with factory method."""
        from src.orchestrator.evidence_bundle import EvidenceBundle, EvidenceItem, GateType

        items = [
            EvidenceItem(
                item_type="artifact",
                path="/patches/task-1.patch",
                description="Patch file",
                content_hash="abc123",
            ),
        ]

        bundle = EvidenceBundle.create(
            task_id="task-123",
            gate_type=GateType.HITL_4_CODE,
            git_sha="sha456",
            items=items,
            summary="Code review for authentication",
        )

        assert bundle.task_id == "task-123"
        assert bundle.gate_type == GateType.HITL_4_CODE
        assert len(bundle.items) == 1
        assert bundle.bundle_id is not None

    def test_evidence_bundle_serialization(self):
        """EvidenceBundle can be serialized to dict."""
        from src.orchestrator.evidence_bundle import EvidenceBundle, EvidenceItem, GateType

        items = [
            EvidenceItem(
                item_type="artifact",
                path="/patches/task-1.patch",
                description="Patch file",
                content_hash="abc123",
            ),
        ]

        bundle = EvidenceBundle.create(
            task_id="task-123",
            gate_type=GateType.HITL_4_CODE,
            git_sha="sha456",
            items=items,
            summary="Code review",
        )

        data = bundle.to_dict()

        assert data["task_id"] == "task-123"
        assert data["gate_type"] == "hitl_4_code"
        assert "items" in data

    def test_evidence_bundle_deserialization(self):
        """EvidenceBundle can be created from dict."""
        from src.orchestrator.evidence_bundle import EvidenceBundle, GateType

        data = {
            "bundle_id": "bundle-123",
            "task_id": "task-456",
            "gate_type": "hitl_4_code",
            "git_sha": "abc123",
            "items": '[{"item_type": "artifact", "path": "/test.patch", "description": "Test", "content_hash": "hash"}]',
            "created_at": "2026-01-22T10:00:00+00:00",
            "summary": "Test bundle",
        }

        bundle = EvidenceBundle.from_dict(data)

        assert bundle.bundle_id == "bundle-123"
        assert bundle.task_id == "task-456"
        assert bundle.gate_type == GateType.HITL_4_CODE


class TestEvidenceValidation:
    """Tests for evidence validation."""

    def test_code_gate_requires_patch(self):
        """HITL_4_CODE requires patch file evidence."""
        from src.orchestrator.evidence_bundle import (
            EvidenceBundle, EvidenceItem, GateType, validate_evidence_for_gate
        )

        items = [
            EvidenceItem(
                item_type="artifact",
                path="/patches/task-1.patch",
                description="Patch file",
                content_hash="abc123",
            ),
            EvidenceItem(
                item_type="test_result",
                path="/reports/test.json",
                description="Test results",
                content_hash="def456",
            ),
        ]

        bundle = EvidenceBundle.create(
            task_id="task-123",
            gate_type=GateType.HITL_4_CODE,
            git_sha="sha456",
            items=items,
            summary="Code review",
        )

        # Should pass validation
        assert validate_evidence_for_gate(bundle) is True

    def test_missing_evidence_fails_validation(self):
        """Bundle without required items fails validation."""
        from src.orchestrator.evidence_bundle import (
            EvidenceBundle, GateType, validate_evidence_for_gate,
            EvidenceValidationError
        )

        # Empty items
        bundle = EvidenceBundle.create(
            task_id="task-123",
            gate_type=GateType.HITL_4_CODE,
            git_sha="sha456",
            items=[],
            summary="Code review",
        )

        with pytest.raises(EvidenceValidationError):
            validate_evidence_for_gate(bundle)

    def test_backlog_gate_requires_prd(self):
        """HITL_1_BACKLOG requires PRD evidence."""
        from src.orchestrator.evidence_bundle import (
            EvidenceBundle, EvidenceItem, GateType, validate_evidence_for_gate
        )

        items = [
            EvidenceItem(
                item_type="prd",
                path="/spec/epics/epic-1/product_reqs.md",
                description="Product requirements",
                content_hash="abc123",
            ),
            EvidenceItem(
                item_type="acceptance_criteria",
                path="/spec/epics/epic-1/test_specs.md",
                description="Acceptance criteria",
                content_hash="def456",
            ),
        ]

        bundle = EvidenceBundle.create(
            task_id="task-123",
            gate_type=GateType.HITL_1_BACKLOG,
            git_sha="sha456",
            items=items,
            summary="Backlog approval",
        )

        assert validate_evidence_for_gate(bundle) is True
