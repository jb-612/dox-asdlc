"""Evidence bundle models for HITL gates.

Defines the evidence structures required for gate approval decisions.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from src.core.exceptions import ASDLCError


class EvidenceValidationError(ASDLCError):
    """Raised when evidence bundle validation fails."""
    pass


class GateType(str, Enum):
    """HITL gates in the aSDLC workflow."""

    HITL_1_BACKLOG = "hitl_1_backlog"       # Approve PRD and backlog
    HITL_2_DESIGN = "hitl_2_design"         # Approve architecture
    HITL_3_PLAN = "hitl_3_plan"             # Approve task plan
    HITL_4_CODE = "hitl_4_code"             # Approve code changes
    HITL_5_VALIDATION = "hitl_5_validation" # Approve validation results
    HITL_6_RELEASE = "hitl_6_release"       # Approve release


class GateStatus(str, Enum):
    """Status of a gate request."""

    PENDING = "pending"       # Awaiting human review
    APPROVED = "approved"     # Human approved
    REJECTED = "rejected"     # Human rejected
    EXPIRED = "expired"       # Timed out without decision


@dataclass
class EvidenceItem:
    """Single piece of evidence for gate review.

    Each item represents an artifact, report, or other evidence
    that supports the gate approval decision.
    """

    item_type: str          # "artifact", "test_result", "report", "prd", etc.
    path: str               # Git path or URL
    description: str        # Human-readable description
    content_hash: str       # SHA256 of content for integrity
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "item_type": self.item_type,
            "path": self.path,
            "description": self.description,
            "content_hash": self.content_hash,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> EvidenceItem:
        """Create from dictionary."""
        return cls(
            item_type=data.get("item_type", ""),
            path=data.get("path", ""),
            description=data.get("description", ""),
            content_hash=data.get("content_hash", ""),
            metadata=data.get("metadata", {}),
        )


@dataclass
class EvidenceBundle:
    """Collection of evidence for a gate request.

    Bundles group all evidence items needed for a specific gate
    approval decision.
    """

    bundle_id: str
    task_id: str
    gate_type: GateType
    git_sha: str
    items: list[EvidenceItem]
    created_at: datetime
    summary: str

    @classmethod
    def create(
        cls,
        task_id: str,
        gate_type: GateType,
        git_sha: str,
        items: list[EvidenceItem],
        summary: str,
    ) -> EvidenceBundle:
        """Create evidence bundle with generated ID.

        Args:
            task_id: Associated task ID.
            gate_type: Type of gate this evidence supports.
            git_sha: Git SHA at time of bundle creation.
            items: List of evidence items.
            summary: Human-readable summary.

        Returns:
            New EvidenceBundle instance.
        """
        return cls(
            bundle_id=str(uuid.uuid4()),
            task_id=task_id,
            gate_type=gate_type,
            git_sha=git_sha,
            items=items,
            created_at=datetime.now(timezone.utc),
            summary=summary,
        )

    def to_dict(self) -> dict[str, str]:
        """Serialize for Redis storage.

        Returns dict with string values for Redis hash storage.
        """
        return {
            "bundle_id": self.bundle_id,
            "task_id": self.task_id,
            "gate_type": self.gate_type.value,
            "git_sha": self.git_sha,
            "items": json.dumps([item.to_dict() for item in self.items]),
            "created_at": self.created_at.isoformat(),
            "summary": self.summary,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> EvidenceBundle:
        """Deserialize from Redis hash format."""
        items_json = data.get("items", "[]")
        if isinstance(items_json, str):
            items_data = json.loads(items_json)
        else:
            items_data = items_json

        items = [EvidenceItem.from_dict(item) for item in items_data]

        return cls(
            bundle_id=data.get("bundle_id", ""),
            task_id=data.get("task_id", ""),
            gate_type=GateType(data.get("gate_type", "hitl_4_code")),
            git_sha=data.get("git_sha", ""),
            items=items,
            created_at=datetime.fromisoformat(
                data.get("created_at", datetime.now(timezone.utc).isoformat())
            ),
            summary=data.get("summary", ""),
        )


# Required evidence types per gate
REQUIRED_EVIDENCE: dict[GateType, list[str]] = {
    GateType.HITL_1_BACKLOG: ["prd", "acceptance_criteria"],
    GateType.HITL_2_DESIGN: ["architecture", "design_doc"],
    GateType.HITL_3_PLAN: ["task_breakdown", "dependency_graph"],
    GateType.HITL_4_CODE: ["artifact", "test_result"],
    GateType.HITL_5_VALIDATION: ["integration_tests", "security_scan"],
    GateType.HITL_6_RELEASE: ["release_notes", "deployment_plan"],
}


def validate_evidence_for_gate(bundle: EvidenceBundle) -> bool:
    """Validate that a bundle has required evidence for its gate type.

    Args:
        bundle: The evidence bundle to validate.

    Returns:
        True if validation passes.

    Raises:
        EvidenceValidationError: If required evidence is missing.
    """
    required = REQUIRED_EVIDENCE.get(bundle.gate_type, [])

    if not bundle.items:
        raise EvidenceValidationError(
            f"Evidence bundle has no items for {bundle.gate_type.value}",
            details={
                "gate_type": bundle.gate_type.value,
                "bundle_id": bundle.bundle_id,
                "required": required,
            },
        )

    present_types = {item.item_type for item in bundle.items}

    # Check if at least one of the required types is present
    # In practice, gates may need specific combinations
    has_required = any(req in present_types for req in required)

    if not has_required:
        raise EvidenceValidationError(
            f"Missing required evidence for {bundle.gate_type.value}",
            details={
                "gate_type": bundle.gate_type.value,
                "bundle_id": bundle.bundle_id,
                "required": required,
                "present": list(present_types),
            },
        )

    return True
