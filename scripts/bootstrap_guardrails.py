"""Bootstrap script for loading default guidelines into GuardrailsStore.

Reads existing .claude/rules/*.md files and converts them into Guideline
objects that can be stored in Elasticsearch via the GuardrailsStore.

Usage:
    python -m scripts.bootstrap_guardrails [--es-url URL] [--index-prefix PREFIX] [--dry-run]
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from src.core.guardrails.exceptions import GuidelineNotFoundError
from src.core.guardrails.models import (
    ActionType,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
)

logger = logging.getLogger(__name__)


def _now() -> datetime:
    """Return the current UTC datetime."""
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Cognitive Isolation Guidelines (4 -- one per agent role)
# ---------------------------------------------------------------------------


def _cognitive_isolation_backend() -> Guideline:
    """Create cognitive isolation guideline for the backend agent."""
    now = _now()
    return Guideline(
        id="cognitive-isolation-backend",
        name="Cognitive Isolation: Backend",
        description=(
            "Restricts the backend agent to its domain paths: "
            "src/workers/, src/orchestrator/, src/infrastructure/, src/core/, "
            "docker/workers/, docker/orchestrator/, and work items P01-P03, P06."
        ),
        enabled=True,
        category=GuidelineCategory.COGNITIVE_ISOLATION,
        priority=900,
        condition=GuidelineCondition(agents=["backend"]),
        action=GuidelineAction(
            type=ActionType.TOOL_RESTRICTION,
            instruction=(
                "Backend agent may only modify files under: "
                "src/workers/, src/orchestrator/, src/infrastructure/, src/core/, "
                "docker/workers/, docker/orchestrator/, "
                ".workitems/P01-*, .workitems/P02-*, .workitems/P03-*, .workitems/P06-*. "
                "Read access to other paths is allowed for context."
            ),
            tools_allowed=["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
            tools_denied=[],
        ),
        metadata={"source": "parallel-coordination.md"},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


def _cognitive_isolation_frontend() -> Guideline:
    """Create cognitive isolation guideline for the frontend agent."""
    now = _now()
    return Guideline(
        id="cognitive-isolation-frontend",
        name="Cognitive Isolation: Frontend",
        description=(
            "Restricts the frontend agent to its domain paths: "
            "src/hitl_ui/, docker/hitl-ui/, and work items P05."
        ),
        enabled=True,
        category=GuidelineCategory.COGNITIVE_ISOLATION,
        priority=900,
        condition=GuidelineCondition(agents=["frontend"]),
        action=GuidelineAction(
            type=ActionType.TOOL_RESTRICTION,
            instruction=(
                "Frontend agent may only modify files under: "
                "src/hitl_ui/, docker/hitl-ui/, .workitems/P05-*. "
                "Read access to other paths is allowed for context."
            ),
            tools_allowed=["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
            tools_denied=[],
        ),
        metadata={"source": "parallel-coordination.md"},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


def _cognitive_isolation_orchestrator() -> Guideline:
    """Create cognitive isolation guideline for the orchestrator agent."""
    now = _now()
    return Guideline(
        id="cognitive-isolation-orchestrator",
        name="Cognitive Isolation: Orchestrator",
        description=(
            "Restricts the orchestrator agent to meta file paths: "
            "CLAUDE.md, README.md, docs/, contracts/, .claude/rules/, .claude/skills/."
        ),
        enabled=True,
        category=GuidelineCategory.COGNITIVE_ISOLATION,
        priority=900,
        condition=GuidelineCondition(agents=["orchestrator"]),
        action=GuidelineAction(
            type=ActionType.TOOL_RESTRICTION,
            instruction=(
                "Orchestrator agent owns exclusively: "
                "CLAUDE.md, README.md, docs/**, contracts/**, "
                ".claude/rules/**, .claude/skills/**. "
                "It may read all paths but only write to its owned paths."
            ),
            tools_allowed=["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
            tools_denied=[],
        ),
        metadata={"source": "parallel-coordination.md"},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


def _cognitive_isolation_devops() -> Guideline:
    """Create cognitive isolation guideline for the devops agent."""
    now = _now()
    return Guideline(
        id="cognitive-isolation-devops",
        name="Cognitive Isolation: DevOps",
        description=(
            "Restricts the devops agent to infrastructure paths: "
            "docker/, helm/, .github/workflows/, scripts/k8s/, scripts/deploy/."
        ),
        enabled=True,
        category=GuidelineCategory.COGNITIVE_ISOLATION,
        priority=900,
        condition=GuidelineCondition(agents=["devops"]),
        action=GuidelineAction(
            type=ActionType.TOOL_RESTRICTION,
            instruction=(
                "DevOps agent may only modify files under: "
                "docker/, helm/, .github/workflows/, scripts/k8s/, scripts/deploy/, "
                "and infrastructure configuration files. "
                "Read access to other paths is allowed for context."
            ),
            tools_allowed=["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
            tools_denied=[],
        ),
        metadata={"source": "parallel-coordination.md"},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


# ---------------------------------------------------------------------------
# HITL Gate Guidelines (4+ mandatory gates)
# ---------------------------------------------------------------------------


def _hitl_gate_devops_invocation() -> Guideline:
    """Create HITL gate guideline for devops invocations."""
    now = _now()
    return Guideline(
        id="hitl-gate-devops-invocation",
        name="HITL Gate: DevOps Invocation",
        description=(
            "Mandatory HITL gate before any devops operation including "
            "docker deploy, kubernetes, cloud infrastructure, or GitHub Actions."
        ),
        enabled=True,
        category=GuidelineCategory.HITL_GATE,
        priority=950,
        condition=GuidelineCondition(
            events=["devops_invocation"],
            gate_types=["devops_invocation"],
        ),
        action=GuidelineAction(
            type=ActionType.HITL_GATE,
            gate_type="devops_invocation",
            gate_threshold="mandatory",
            instruction=(
                "Before any devops operation, present options: "
                "A) Run devops agent here, "
                "B) Send to separate DevOps CLI, "
                "C) Show instructions for manual execution."
            ),
        ),
        metadata={"source": "hitl-gates.md", "gate_number": 1},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


def _hitl_gate_protected_path_commit() -> Guideline:
    """Create HITL gate guideline for protected path commits."""
    now = _now()
    return Guideline(
        id="hitl-gate-protected-path-commit",
        name="HITL Gate: Protected Path Commit",
        description=(
            "Mandatory HITL gate when committing files in contracts/ or .claude/. "
            "These paths affect project configuration and require explicit confirmation."
        ),
        enabled=True,
        category=GuidelineCategory.HITL_GATE,
        priority=950,
        condition=GuidelineCondition(
            events=["commit"],
            paths=["contracts/*", ".claude/*"],
            gate_types=["protected_path_commit"],
        ),
        action=GuidelineAction(
            type=ActionType.HITL_GATE,
            gate_type="protected_path_commit",
            gate_threshold="mandatory",
            instruction=(
                "Committing to protected path requires explicit Y/N confirmation. "
                "N aborts the commit operation."
            ),
        ),
        metadata={"source": "hitl-gates.md", "gate_number": 2},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


def _hitl_gate_contract_change() -> Guideline:
    """Create HITL gate guideline for contract changes."""
    now = _now()
    return Guideline(
        id="hitl-gate-contract-change",
        name="HITL Gate: Contract Change",
        description=(
            "Mandatory HITL gate when modifying contracts/current/ or contracts/versions/. "
            "All consumers must be notified before proceeding."
        ),
        enabled=True,
        category=GuidelineCategory.HITL_GATE,
        priority=950,
        condition=GuidelineCondition(
            events=["contract_change"],
            paths=["contracts/current/*", "contracts/versions/*"],
            gate_types=["contract_change"],
        ),
        action=GuidelineAction(
            type=ActionType.HITL_GATE,
            gate_type="contract_change",
            gate_threshold="mandatory",
            instruction=(
                "Contract changes affect all consumers. "
                "User must confirm that all consumers have been notified (Y/N)."
            ),
        ),
        metadata={"source": "hitl-gates.md", "gate_number": 3},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


def _hitl_gate_destructive_workstation_op() -> Guideline:
    """Create HITL gate guideline for destructive workstation operations."""
    now = _now()
    return Guideline(
        id="hitl-gate-destructive-workstation-op",
        name="HITL Gate: Destructive Workstation Operation",
        description=(
            "Mandatory HITL gate for destructive operations on workstation: "
            "rm -rf, kubectl delete, helm uninstall, docker system prune. "
            "Gate is skipped in container/K8s environments."
        ),
        enabled=True,
        category=GuidelineCategory.HITL_GATE,
        priority=950,
        condition=GuidelineCondition(
            events=["destructive_op"],
            gate_types=["destructive_workstation_op"],
        ),
        action=GuidelineAction(
            type=ActionType.HITL_GATE,
            gate_type="destructive_workstation_op",
            gate_threshold="mandatory",
            instruction=(
                "Destructive operation on workstation detected. "
                "Requires explicit Y/N confirmation. "
                "Gate is conditional on environment -- skipped in containers and K8s."
            ),
        ),
        metadata={"source": "hitl-gates.md", "gate_number": 4},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


# ---------------------------------------------------------------------------
# TDD Protocol Guideline
# ---------------------------------------------------------------------------


def _tdd_protocol() -> Guideline:
    """Create TDD protocol guideline."""
    now = _now()
    return Guideline(
        id="tdd-protocol",
        name="TDD Protocol: Red-Green-Refactor",
        description=(
            "Enforces the TDD protocol for all implementation tasks. "
            "Tests must be written first (RED), then minimal code to pass (GREEN), "
            "then refactored while tests remain green (REFACTOR)."
        ),
        enabled=True,
        category=GuidelineCategory.TDD_PROTOCOL,
        priority=800,
        condition=GuidelineCondition(
            actions=["implement", "code", "fix", "refactor"],
        ),
        action=GuidelineAction(
            type=ActionType.CONSTRAINT,
            instruction=(
                "Follow Red-Green-Refactor: "
                "1) RED: Write a failing test first. "
                "2) GREEN: Write minimal code to make the test pass. "
                "3) REFACTOR: Clean up while keeping tests green. "
                "Never proceed to the next task with failing tests."
            ),
            require_tests=True,
        ),
        metadata={"source": "workflow.md"},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


# ---------------------------------------------------------------------------
# Context Constraint Guidelines
# ---------------------------------------------------------------------------


def _context_constraint_commit_size() -> Guideline:
    """Create context constraint guideline for commit size."""
    now = _now()
    return Guideline(
        id="context-constraint-commit-size",
        name="Context Constraint: Commit Size",
        description=(
            "Limits the number of files that can be included in a single commit "
            "to encourage small, focused changes following trunk-based development."
        ),
        enabled=True,
        category=GuidelineCategory.CONTEXT_CONSTRAINT,
        priority=700,
        condition=GuidelineCondition(
            actions=["commit"],
        ),
        action=GuidelineAction(
            type=ActionType.CONSTRAINT,
            instruction=(
                "Commits should be small and focused on one feature. "
                "If a commit spans more than 10 files, consider splitting it. "
                "All tests must pass before committing."
            ),
            max_files=10,
            require_tests=True,
        ),
        metadata={"source": "trunk-based-development.md"},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


def _context_constraint_review_required() -> Guideline:
    """Create context constraint guideline for requiring review."""
    now = _now()
    return Guideline(
        id="context-constraint-review-required",
        name="Context Constraint: Review Required",
        description=(
            "Requires independent code review before features are committed. "
            "The reviewer must never be the creator."
        ),
        enabled=True,
        category=GuidelineCategory.CONTEXT_CONSTRAINT,
        priority=700,
        condition=GuidelineCondition(
            actions=["complete_feature", "merge"],
        ),
        action=GuidelineAction(
            type=ActionType.CONSTRAINT,
            instruction=(
                "Independent code review is required before feature completion. "
                "Reviewer must not be the creator. "
                "All review findings must become GitHub issues."
            ),
            require_review=True,
        ),
        metadata={"source": "workflow.md"},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="bootstrap",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_default_guidelines() -> list[Guideline]:
    """Return the full list of default guidelines derived from project rules.

    Returns:
        A list of Guideline objects covering cognitive isolation,
        HITL gates, TDD protocol, and context constraints.
    """
    return [
        # Cognitive isolation (4)
        _cognitive_isolation_backend(),
        _cognitive_isolation_frontend(),
        _cognitive_isolation_orchestrator(),
        _cognitive_isolation_devops(),
        # HITL gates (4 mandatory)
        _hitl_gate_devops_invocation(),
        _hitl_gate_protected_path_commit(),
        _hitl_gate_contract_change(),
        _hitl_gate_destructive_workstation_op(),
        # TDD protocol (1)
        _tdd_protocol(),
        # Context constraints (2)
        _context_constraint_commit_size(),
        _context_constraint_review_required(),
    ]


async def upsert_guidelines(
    store: Any,
    guidelines: list[Guideline],
    dry_run: bool = False,
) -> dict[str, Any]:
    """Create guidelines that do not already exist in the store.

    For each guideline, tries get_guideline first. If the guideline
    already exists, it is skipped (idempotent). If GuidelineNotFoundError
    is raised, the guideline is created.

    Args:
        store: A GuardrailsStore instance (or mock).
        guidelines: The guidelines to upsert.
        dry_run: If True, skip all store operations and report what
            would have been created.

    Returns:
        A summary dict with keys: created, skipped, errors, dry_run.
    """
    created = 0
    skipped = 0
    errors = 0

    if dry_run:
        for g in guidelines:
            logger.info("[DRY RUN] Would create guideline: %s (%s)", g.id, g.name)
        return {
            "created": 0,
            "skipped": 0,
            "errors": 0,
            "dry_run": True,
            "total": len(guidelines),
        }

    for g in guidelines:
        try:
            await store.get_guideline(g.id)
            logger.info("Guideline already exists, skipping: %s", g.id)
            skipped += 1
        except GuidelineNotFoundError:
            try:
                await store.create_guideline(g)
                logger.info("Created guideline: %s", g.id)
                created += 1
            except Exception:
                logger.exception("Failed to create guideline: %s", g.id)
                errors += 1

    return {
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "dry_run": False,
        "total": len(guidelines),
    }


async def main(args: list[str] | None = None) -> None:
    """CLI entry point for bootstrapping default guidelines.

    Args:
        args: Optional argument list (defaults to sys.argv[1:]).
    """
    parser = argparse.ArgumentParser(
        description="Bootstrap default guardrails guidelines into Elasticsearch."
    )
    parser.add_argument(
        "--es-url",
        default="http://localhost:9200",
        help="Elasticsearch URL (default: http://localhost:9200)",
    )
    parser.add_argument(
        "--index-prefix",
        default="",
        help="Index prefix for multi-tenancy (default: empty)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be created without actually creating",
    )
    parsed = parser.parse_args(args)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    guidelines = get_default_guidelines()
    logger.info("Found %d default guidelines to bootstrap.", len(guidelines))

    if parsed.dry_run:
        result = await upsert_guidelines(None, guidelines, dry_run=True)  # type: ignore[arg-type]
    else:
        from elasticsearch import AsyncElasticsearch

        from src.infrastructure.guardrails.guardrails_store import GuardrailsStore

        es_client = AsyncElasticsearch(hosts=[parsed.es_url])
        store = GuardrailsStore(es_client=es_client, index_prefix=parsed.index_prefix)
        try:
            result = await upsert_guidelines(store, guidelines)
        finally:
            await es_client.close()

    print(f"\nBootstrap Summary:")
    print(f"  Total guidelines: {result['total']}")
    print(f"  Created:          {result['created']}")
    print(f"  Skipped:          {result['skipped']}")
    print(f"  Errors:           {result['errors']}")
    print(f"  Dry run:          {result['dry_run']}")


if __name__ == "__main__":
    asyncio.run(main())
