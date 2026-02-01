"""Unit tests for Slack Bridge Block Kit message builders.

Tests the Block Kit message builder functions.
"""

from __future__ import annotations

import pytest

from src.infrastructure.slack_bridge.blocks import (
    build_approved_blocks,
    build_gate_request_blocks,
    build_rejected_blocks,
    build_rejection_modal,
)


class TestBuildGateRequestBlocks:
    """Tests for build_gate_request_blocks function."""

    def test_build_gate_request_blocks_structure(self):
        """Gate request blocks have correct structure."""
        blocks = build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review code changes for user auth",
            evidence_url="https://example.com/evidence/req-123",
            requester="agent-coder",
        )

        assert isinstance(blocks, list)
        assert len(blocks) >= 4  # Header, section, evidence link, actions, context

    def test_build_gate_request_blocks_header(self):
        """Gate request blocks contain header."""
        blocks = build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review code",
            evidence_url="https://example.com/evidence/req-123",
            requester="agent-coder",
        )

        header = blocks[0]
        assert header["type"] == "header"
        assert "HITL" in header["text"]["text"]
        assert "CODE" in header["text"]["text"].upper()

    def test_build_gate_request_blocks_task_info(self):
        """Gate request blocks contain task information."""
        blocks = build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review code changes",
            evidence_url="https://example.com/evidence/req-123",
            requester="agent-coder",
        )

        # Find section with task info
        section = next(b for b in blocks if b["type"] == "section" and "Task:" in str(b))
        text = section["text"]["text"]

        assert "task-456" in text
        assert "Review code changes" in text
        assert "agent-coder" in text

    def test_build_gate_request_blocks_evidence_link(self):
        """Gate request blocks contain evidence link."""
        blocks = build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review code",
            evidence_url="https://example.com/evidence/req-123",
            requester="agent-coder",
        )

        # Find section with evidence URL
        evidence_section = next(
            b for b in blocks if b["type"] == "section" and "evidence" in str(b).lower()
        )
        text = evidence_section["text"]["text"]

        assert "https://example.com/evidence/req-123" in text

    def test_build_gate_request_blocks_actions(self):
        """Gate request blocks contain approve/reject buttons."""
        blocks = build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review code",
            evidence_url="https://example.com/evidence/req-123",
            requester="agent-coder",
        )

        # Find actions block
        actions = next(b for b in blocks if b["type"] == "actions")

        assert "block_id" in actions
        assert "req-123" in actions["block_id"]
        assert len(actions["elements"]) == 2

        # Check approve button
        approve_btn = next(e for e in actions["elements"] if e["action_id"] == "approve_gate")
        assert approve_btn["text"]["text"] == "Approve"
        assert approve_btn["style"] == "primary"
        assert approve_btn["value"] == "req-123"

        # Check reject button
        reject_btn = next(e for e in actions["elements"] if e["action_id"] == "reject_gate")
        assert reject_btn["text"]["text"] == "Reject"
        assert reject_btn["style"] == "danger"
        assert reject_btn["value"] == "req-123"

    def test_build_gate_request_blocks_context(self):
        """Gate request blocks contain context with request ID."""
        blocks = build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review code",
            evidence_url="https://example.com/evidence/req-123",
            requester="agent-coder",
        )

        # Find context block
        context = next(b for b in blocks if b["type"] == "context")

        assert "req-123" in str(context)

    def test_build_gate_request_blocks_formats_gate_type(self):
        """Gate type is formatted for display."""
        blocks = build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_6_release",
            task_id="task-456",
            summary="Release approval",
            evidence_url="https://example.com/evidence/req-123",
            requester="agent-deployer",
        )

        header = blocks[0]
        # Gate type should be human readable
        assert "RELEASE" in header["text"]["text"].upper()


class TestBuildApprovedBlocks:
    """Tests for build_approved_blocks function."""

    @pytest.fixture
    def original_blocks(self) -> list[dict]:
        """Original blocks to modify."""
        return build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review code",
            evidence_url="https://example.com/evidence/req-123",
            requester="agent-coder",
        )

    def test_build_approved_blocks_removes_actions(self, original_blocks: list[dict]):
        """Approved blocks remove action buttons."""
        approved = build_approved_blocks(
            original_blocks,
            approver_name="John Doe",
            timestamp="2026-01-22T10:00:00Z",
        )

        # No actions block should remain
        action_blocks = [b for b in approved if b["type"] == "actions"]
        assert len(action_blocks) == 0

    def test_build_approved_blocks_adds_approval_info(self, original_blocks: list[dict]):
        """Approved blocks add approval information."""
        approved = build_approved_blocks(
            original_blocks,
            approver_name="John Doe",
            timestamp="2026-01-22T10:00:00Z",
        )

        # Should have approval context
        all_text = str(approved)
        assert "John Doe" in all_text
        assert "Approved" in all_text or "approved" in all_text

    def test_build_approved_blocks_preserves_original(self, original_blocks: list[dict]):
        """Approved blocks preserve original content."""
        approved = build_approved_blocks(
            original_blocks,
            approver_name="John Doe",
            timestamp="2026-01-22T10:00:00Z",
        )

        all_text = str(approved)
        assert "task-456" in all_text
        assert "Review code" in all_text


class TestBuildRejectedBlocks:
    """Tests for build_rejected_blocks function."""

    @pytest.fixture
    def original_blocks(self) -> list[dict]:
        """Original blocks to modify."""
        return build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review code",
            evidence_url="https://example.com/evidence/req-123",
            requester="agent-coder",
        )

    def test_build_rejected_blocks_removes_actions(self, original_blocks: list[dict]):
        """Rejected blocks remove action buttons."""
        rejected = build_rejected_blocks(
            original_blocks,
            rejecter_name="Jane Smith",
            reason="Code style violations",
            timestamp="2026-01-22T10:00:00Z",
        )

        action_blocks = [b for b in rejected if b["type"] == "actions"]
        assert len(action_blocks) == 0

    def test_build_rejected_blocks_adds_rejection_info(self, original_blocks: list[dict]):
        """Rejected blocks add rejection information."""
        rejected = build_rejected_blocks(
            original_blocks,
            rejecter_name="Jane Smith",
            reason="Code style violations",
            timestamp="2026-01-22T10:00:00Z",
        )

        all_text = str(rejected)
        assert "Jane Smith" in all_text
        assert "Code style violations" in all_text
        assert "Rejected" in all_text or "rejected" in all_text

    def test_build_rejected_blocks_preserves_original(self, original_blocks: list[dict]):
        """Rejected blocks preserve original content."""
        rejected = build_rejected_blocks(
            original_blocks,
            rejecter_name="Jane Smith",
            reason="Code style violations",
            timestamp="2026-01-22T10:00:00Z",
        )

        all_text = str(rejected)
        assert "task-456" in all_text


class TestBuildRejectionModal:
    """Tests for build_rejection_modal function."""

    def test_build_rejection_modal_structure(self):
        """Rejection modal has correct structure."""
        modal = build_rejection_modal("req-123")

        assert modal["type"] == "modal"
        assert "callback_id" in modal
        assert "req-123" in modal["callback_id"]
        assert "title" in modal
        assert "submit" in modal
        assert "close" in modal
        assert "blocks" in modal

    def test_build_rejection_modal_has_input(self):
        """Rejection modal has reason input field."""
        modal = build_rejection_modal("req-123")

        # Find input block
        input_block = next(b for b in modal["blocks"] if b["type"] == "input")

        assert input_block["block_id"] == "reason_block"
        assert input_block["element"]["type"] == "plain_text_input"
        assert input_block["element"]["action_id"] == "reason_input"
        assert input_block["element"]["multiline"] is True

    def test_build_rejection_modal_has_private_metadata(self):
        """Rejection modal stores request_id in private_metadata."""
        modal = build_rejection_modal("req-456")

        assert modal["private_metadata"] == "req-456"

    def test_build_rejection_modal_submit_button(self):
        """Rejection modal has Reject submit button."""
        modal = build_rejection_modal("req-123")

        assert modal["submit"]["text"] == "Reject"

    def test_build_rejection_modal_cancel_button(self):
        """Rejection modal has Cancel button."""
        modal = build_rejection_modal("req-123")

        assert modal["close"]["text"] == "Cancel"
