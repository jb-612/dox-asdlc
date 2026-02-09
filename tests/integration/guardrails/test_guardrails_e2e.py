"""End-to-end integration tests for the guardrails system.

Tests the full flow: create guidelines, evaluate context, log decisions,
and retrieve audit logs against a real Elasticsearch instance.

These tests require a running Elasticsearch instance.
Run with: docker compose up elasticsearch -d
Set SKIP_ELASTICSEARCH_TESTS=false to enable.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest

# Skip all tests if Elasticsearch is not available
pytestmark = pytest.mark.skipif(
    os.getenv("SKIP_ELASTICSEARCH_TESTS", "true").lower() == "true",
    reason="Elasticsearch not available. Set SKIP_ELASTICSEARCH_TESTS=false to run.",
)


@pytest.fixture
def index_prefix() -> str:
    """Generate a unique index prefix for this test run."""
    return f"test_{uuid.uuid4().hex[:8]}"


@pytest.fixture
async def es_client():
    """Create an AsyncElasticsearch client pointing to localhost:9200."""
    from elasticsearch import AsyncElasticsearch

    es_url = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
    client = AsyncElasticsearch(hosts=[es_url])
    yield client
    await client.close()


@pytest.fixture
async def store(es_client, index_prefix: str):
    """Create a GuardrailsStore with a unique test index prefix.

    Cleans up test indices after the test completes.
    """
    from src.infrastructure.guardrails.guardrails_store import GuardrailsStore

    guardrails_store = GuardrailsStore(
        es_client=es_client,
        index_prefix=index_prefix,
    )
    yield guardrails_store

    # Cleanup: delete all test indices
    try:
        index_pattern = f"{index_prefix}_*"
        await es_client.indices.delete(index=index_pattern, ignore=[404])
    except Exception:
        pass


@pytest.fixture
def evaluator(store):
    """Create a GuardrailsEvaluator backed by the test store.

    Uses cache_ttl=0.0 to disable caching so each evaluation
    fetches fresh data from Elasticsearch.
    """
    from src.core.guardrails.evaluator import GuardrailsEvaluator

    return GuardrailsEvaluator(store=store, cache_ttl=0.0)


def _make_guideline(
    guideline_id: str,
    name: str,
    *,
    category: str = "cognitive_isolation",
    priority: int = 500,
    enabled: bool = True,
    agents: list[str] | None = None,
    domains: list[str] | None = None,
    actions: list[str] | None = None,
    paths: list[str] | None = None,
    events: list[str] | None = None,
    gate_types: list[str] | None = None,
    action_type: str = "instruction",
    instruction: str | None = None,
    tools_allowed: list[str] | None = None,
    tools_denied: list[str] | None = None,
    gate_type: str | None = None,
):
    """Create a Guideline instance for testing.

    Args:
        guideline_id: Unique identifier.
        name: Human-readable name.
        category: Guideline category value.
        priority: Priority for conflict resolution.
        enabled: Master enable flag.
        agents: Agent filter list.
        domains: Domain filter list.
        actions: Action filter list.
        paths: Path pattern filter list.
        events: Event filter list.
        gate_types: Gate type filter list.
        action_type: ActionType value string.
        instruction: Instruction text.
        tools_allowed: List of allowed tools.
        tools_denied: List of denied tools.
        gate_type: HITL gate type.

    Returns:
        A Guideline instance ready for use in tests.
    """
    from src.core.guardrails.models import (
        ActionType,
        Guideline,
        GuidelineAction,
        GuidelineCategory,
        GuidelineCondition,
    )

    now = datetime.now(timezone.utc)
    return Guideline(
        id=guideline_id,
        name=name,
        description=f"Test guideline: {name}",
        enabled=enabled,
        category=GuidelineCategory(category),
        priority=priority,
        condition=GuidelineCondition(
            agents=agents,
            domains=domains,
            actions=actions,
            paths=paths,
            events=events,
            gate_types=gate_types,
        ),
        action=GuidelineAction(
            type=ActionType(action_type),
            instruction=instruction,
            tools_allowed=tools_allowed,
            tools_denied=tools_denied,
            gate_type=gate_type,
        ),
        metadata={"test": True},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="test",
    )


class TestFullGuidelineLifecycle:
    """Test complete CRUD lifecycle for a guideline."""

    async def test_full_guideline_lifecycle(self, store) -> None:
        """Test create, retrieve, update, delete lifecycle for a guideline."""
        from src.core.guardrails.exceptions import GuidelineNotFoundError

        # -- Create --
        guideline = _make_guideline(
            "lifecycle-test-1",
            "Lifecycle Test Guideline",
            priority=500,
            agents=["backend"],
            instruction="Follow backend rules.",
        )
        created = await store.create_guideline(guideline)
        assert created.id == "lifecycle-test-1"

        # -- Retrieve --
        fetched = await store.get_guideline("lifecycle-test-1")
        assert fetched.id == "lifecycle-test-1"
        assert fetched.name == "Lifecycle Test Guideline"
        assert fetched.priority == 500
        assert fetched.condition.agents == ["backend"]
        assert fetched.action.instruction == "Follow backend rules."
        assert fetched.version == 1

        # -- Update (change priority) --
        updated = await store.update_guideline(fetched)
        assert updated.version == 2
        assert updated.id == "lifecycle-test-1"

        # Verify update took effect
        refetched = await store.get_guideline("lifecycle-test-1")
        assert refetched.version == 2

        # -- Delete --
        deleted = await store.delete_guideline("lifecycle-test-1")
        assert deleted is True

        # -- Verify gone --
        with pytest.raises(GuidelineNotFoundError):
            await store.get_guideline("lifecycle-test-1")


class TestEvaluationFlow:
    """Test guideline evaluation against task contexts."""

    async def test_evaluate_guidelines(self, store, evaluator) -> None:
        """Test that evaluation matches correct guidelines for a context."""
        from src.core.guardrails.models import TaskContext

        # Create 3 guidelines with different conditions
        g1 = _make_guideline(
            "eval-backend",
            "Backend Isolation",
            priority=900,
            agents=["backend"],
            instruction="Backend agent restrictions apply.",
            tools_allowed=["Read", "Write"],
            tools_denied=["kubectl"],
        )
        g2 = _make_guideline(
            "eval-frontend",
            "Frontend Isolation",
            priority=900,
            agents=["frontend"],
            instruction="Frontend agent restrictions apply.",
            tools_allowed=["npm"],
        )
        g3 = _make_guideline(
            "eval-tdd",
            "TDD Protocol",
            category="tdd_protocol",
            priority=800,
            actions=["implement"],
            instruction="Follow TDD protocol.",
        )

        await store.create_guideline(g1)
        await store.create_guideline(g2)
        await store.create_guideline(g3)

        # Evaluate as backend agent performing implement action
        context = TaskContext(
            agent="backend",
            action="implement",
        )
        result = await evaluator.get_context(context)

        # Should match g1 (backend agent) and g3 (implement action)
        matched_ids = [eg.guideline.id for eg in result.matched_guidelines]
        assert "eval-backend" in matched_ids
        assert "eval-tdd" in matched_ids
        assert "eval-frontend" not in matched_ids

        # Verify combined instruction is populated
        assert "Backend agent restrictions" in result.combined_instruction
        assert "TDD protocol" in result.combined_instruction

        # Verify tools are aggregated
        assert "Read" in result.tools_allowed
        assert "Write" in result.tools_allowed
        assert "kubectl" in result.tools_denied

    async def test_evaluate_no_matches(self, store, evaluator) -> None:
        """Test evaluation when no guidelines match the context."""
        from src.core.guardrails.models import TaskContext

        # Create a guideline for backend only
        g = _make_guideline(
            "eval-nomatch",
            "Backend Only",
            agents=["backend"],
            instruction="Backend only.",
        )
        await store.create_guideline(g)

        # Evaluate as reviewer agent -- should not match
        context = TaskContext(agent="reviewer")
        result = await evaluator.get_context(context)

        assert len(result.matched_guidelines) == 0
        assert result.combined_instruction == ""


class TestAuditTrail:
    """Test audit log operations."""

    async def test_audit_trail(self, store) -> None:
        """Test logging and retrieving audit entries for a guideline."""
        # Create a guideline first
        guideline = _make_guideline(
            "audit-test-1",
            "Audit Test Guideline",
            instruction="Some instruction.",
        )
        await store.create_guideline(guideline)

        # Log audit event for creation
        creation_entry = {
            "event_type": "guideline_created",
            "guideline_id": "audit-test-1",
            "actor": "test-user",
            "changes": {"field": "all", "old_value": "", "new_value": "created"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        entry_id_1 = await store.log_audit_entry(creation_entry)
        assert entry_id_1 is not None

        # Log audit event for update
        update_entry = {
            "event_type": "guideline_updated",
            "guideline_id": "audit-test-1",
            "actor": "test-user",
            "changes": {"field": "priority", "old_value": "500", "new_value": "900"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        entry_id_2 = await store.log_audit_entry(update_entry)
        assert entry_id_2 is not None

        # Retrieve audit log for that guideline
        entries, total = await store.list_audit_entries(
            guideline_id="audit-test-1",
        )

        assert total >= 2
        event_types = [e["event_type"] for e in entries]
        assert "guideline_created" in event_types
        assert "guideline_updated" in event_types

    async def test_audit_filter_by_event_type(self, store) -> None:
        """Test filtering audit entries by event type."""
        # Log multiple event types
        for event_type in ["created", "updated", "deleted"]:
            entry = {
                "event_type": event_type,
                "guideline_id": "audit-filter-test",
                "actor": "test-user",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await store.log_audit_entry(entry)

        # Filter by specific event type
        entries, total = await store.list_audit_entries(
            event_type="updated",
        )

        assert total >= 1
        for e in entries:
            assert e["event_type"] == "updated"


class TestPriorityResolution:
    """Test priority ordering in evaluation results."""

    async def test_priority_resolution(self, store, evaluator) -> None:
        """Test that higher priority guidelines appear first in results."""
        from src.core.guardrails.models import TaskContext

        # Create 2 guidelines matching same context but different priorities
        low_priority = _make_guideline(
            "priority-low",
            "Low Priority Rule",
            priority=100,
            agents=["backend"],
            instruction="Low priority instruction.",
        )
        high_priority = _make_guideline(
            "priority-high",
            "High Priority Rule",
            priority=900,
            agents=["backend"],
            instruction="High priority instruction.",
        )

        await store.create_guideline(low_priority)
        await store.create_guideline(high_priority)

        context = TaskContext(agent="backend")
        result = await evaluator.get_context(context)

        assert len(result.matched_guidelines) == 2
        # Higher priority should come first
        assert result.matched_guidelines[0].guideline.id == "priority-high"
        assert result.matched_guidelines[1].guideline.id == "priority-low"

        # Combined instruction should start with high priority
        assert result.combined_instruction.startswith("High priority instruction.")


class TestConditionMatching:
    """Test condition matching with different specificity levels."""

    async def test_condition_matching_agent_specificity(
        self, store, evaluator
    ) -> None:
        """Test that agent-specific and wildcard guidelines both match."""
        from src.core.guardrails.models import TaskContext

        # Create guideline for backend agent only
        backend_only = _make_guideline(
            "cond-backend-only",
            "Backend Only",
            priority=800,
            agents=["backend"],
            instruction="Backend-specific rule.",
        )
        # Create guideline for all agents (no agent filter = wildcard)
        all_agents = _make_guideline(
            "cond-all-agents",
            "All Agents",
            priority=700,
            instruction="Universal rule for all agents.",
        )

        await store.create_guideline(backend_only)
        await store.create_guideline(all_agents)

        # Evaluate as backend agent -- both should match
        backend_context = TaskContext(agent="backend")
        backend_result = await evaluator.get_context(backend_context)

        backend_matched_ids = [
            eg.guideline.id for eg in backend_result.matched_guidelines
        ]
        assert "cond-backend-only" in backend_matched_ids
        assert "cond-all-agents" in backend_matched_ids

        # Evaluate as frontend agent -- only the all-agents one should match
        frontend_context = TaskContext(agent="frontend")
        frontend_result = await evaluator.get_context(frontend_context)

        frontend_matched_ids = [
            eg.guideline.id for eg in frontend_result.matched_guidelines
        ]
        assert "cond-backend-only" not in frontend_matched_ids
        assert "cond-all-agents" in frontend_matched_ids

    async def test_condition_matching_multi_field(
        self, store, evaluator
    ) -> None:
        """Test matching when condition specifies multiple fields (AND logic)."""
        from src.core.guardrails.models import TaskContext

        # Create a guideline requiring both agent AND action
        specific = _make_guideline(
            "cond-multi",
            "Multi-field Condition",
            priority=800,
            agents=["backend"],
            actions=["implement"],
            instruction="Backend implement rule.",
        )
        await store.create_guideline(specific)

        # Match: backend + implement
        ctx_match = TaskContext(agent="backend", action="implement")
        result_match = await evaluator.get_context(ctx_match)
        matched_ids = [eg.guideline.id for eg in result_match.matched_guidelines]
        assert "cond-multi" in matched_ids

        # No match: backend + review (action mismatch)
        ctx_nomatch = TaskContext(agent="backend", action="review")
        result_nomatch = await evaluator.get_context(ctx_nomatch)
        nomatch_ids = [eg.guideline.id for eg in result_nomatch.matched_guidelines]
        assert "cond-multi" not in nomatch_ids

    async def test_disabled_guidelines_excluded(self, store, evaluator) -> None:
        """Test that disabled guidelines are not returned in evaluation."""
        from src.core.guardrails.models import TaskContext

        enabled_g = _make_guideline(
            "cond-enabled",
            "Enabled Guideline",
            enabled=True,
            instruction="Enabled instruction.",
        )
        disabled_g = _make_guideline(
            "cond-disabled",
            "Disabled Guideline",
            enabled=False,
            instruction="Disabled instruction.",
        )

        await store.create_guideline(enabled_g)
        await store.create_guideline(disabled_g)

        context = TaskContext(agent="backend")
        result = await evaluator.get_context(context)

        matched_ids = [eg.guideline.id for eg in result.matched_guidelines]
        assert "cond-enabled" in matched_ids
        assert "cond-disabled" not in matched_ids


class TestBootstrapIntegration:
    """Test the bootstrap script integration with the store."""

    async def test_bootstrap_creates_guidelines(self, store) -> None:
        """Test that upsert_guidelines creates all default guidelines."""
        from scripts.bootstrap_guardrails import (
            get_default_guidelines,
            upsert_guidelines,
        )

        guidelines = get_default_guidelines()
        assert len(guidelines) >= 10  # at least 11 default guidelines

        # First run: all should be created
        result = await upsert_guidelines(store, guidelines)
        assert result["created"] == len(guidelines)
        assert result["skipped"] == 0
        assert result["errors"] == 0
        assert result["dry_run"] is False

        # Verify guidelines are in ES
        for g in guidelines:
            fetched = await store.get_guideline(g.id)
            assert fetched.id == g.id
            assert fetched.name == g.name

    async def test_bootstrap_idempotent(self, store) -> None:
        """Test that running upsert_guidelines twice is idempotent."""
        from scripts.bootstrap_guardrails import (
            get_default_guidelines,
            upsert_guidelines,
        )

        guidelines = get_default_guidelines()

        # First run
        result1 = await upsert_guidelines(store, guidelines)
        assert result1["created"] == len(guidelines)
        assert result1["skipped"] == 0

        # Second run: all should be skipped
        result2 = await upsert_guidelines(store, guidelines)
        assert result2["created"] == 0
        assert result2["skipped"] == len(guidelines)
        assert result2["errors"] == 0


class TestGateDecisionLogging:
    """Test HITL gate decision logging via the evaluator."""

    async def test_log_gate_decision(self, store, evaluator) -> None:
        """Test logging a gate decision and verifying it in audit."""
        from src.core.guardrails.models import GateDecision, TaskContext

        # Log a gate decision
        decision = GateDecision(
            guideline_id="hitl-gate-devops-invocation",
            gate_type="devops_invocation",
            result="approved",
            reason="User approved devops operation.",
            user_response="A",
            context=TaskContext(
                agent="devops",
                domain="P06",
                action="deploy",
                session_id="test-session-123",
            ),
        )
        audit_id = await evaluator.log_decision(decision)
        assert audit_id is not None

        # Retrieve audit entries for this guideline
        entries, total = await store.list_audit_entries(
            guideline_id="hitl-gate-devops-invocation",
        )
        assert total >= 1

        # Find the entry we just created
        matching = [e for e in entries if e.get("id") == audit_id]
        assert len(matching) == 1

        entry = matching[0]
        assert entry["event_type"] == "gate_decision"
        assert entry["guideline_id"] == "hitl-gate-devops-invocation"
        assert entry["decision"]["result"] == "approved"
        assert entry["decision"]["reason"] == "User approved devops operation."
        assert entry["context"]["agent"] == "devops"


class TestListGuidelines:
    """Test listing guidelines with filters and pagination."""

    async def test_list_with_category_filter(self, store) -> None:
        """Test listing guidelines filtered by category."""
        from src.core.guardrails.models import GuidelineCategory

        g_cog = _make_guideline(
            "list-cog",
            "Cognitive Guideline",
            category="cognitive_isolation",
        )
        g_hitl = _make_guideline(
            "list-hitl",
            "HITL Guideline",
            category="hitl_gate",
        )

        await store.create_guideline(g_cog)
        await store.create_guideline(g_hitl)

        # Filter by cognitive_isolation
        results, total = await store.list_guidelines(
            category=GuidelineCategory.COGNITIVE_ISOLATION,
        )
        result_ids = [g.id for g in results]
        assert "list-cog" in result_ids
        assert "list-hitl" not in result_ids

    async def test_list_with_enabled_filter(self, store) -> None:
        """Test listing only enabled guidelines."""
        g_enabled = _make_guideline(
            "list-enabled",
            "Enabled",
            enabled=True,
        )
        g_disabled = _make_guideline(
            "list-disabled",
            "Disabled",
            enabled=False,
        )

        await store.create_guideline(g_enabled)
        await store.create_guideline(g_disabled)

        # Filter by enabled=True
        results, total = await store.list_guidelines(enabled=True)
        result_ids = [g.id for g in results]
        assert "list-enabled" in result_ids
        assert "list-disabled" not in result_ids

    async def test_list_pagination(self, store) -> None:
        """Test paginated listing of guidelines."""
        # Create 5 guidelines
        for i in range(5):
            g = _make_guideline(
                f"list-page-{i}",
                f"Page Test {i}",
                priority=100 + i,
            )
            await store.create_guideline(g)

        # Get first page (size 2)
        page1, total = await store.list_guidelines(page=1, page_size=2)
        assert len(page1) == 2
        assert total == 5

        # Get second page
        page2, _ = await store.list_guidelines(page=2, page_size=2)
        assert len(page2) == 2

        # Get third page (only 1 remaining)
        page3, _ = await store.list_guidelines(page=3, page_size=2)
        assert len(page3) == 1

        # Verify no overlap between pages
        all_ids = [g.id for g in page1 + page2 + page3]
        assert len(set(all_ids)) == 5
