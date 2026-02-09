"""Unit tests for Guardrails audit, evaluate, export, and import endpoints.

Tests GET /api/guardrails/audit, POST /api/guardrails/evaluate,
GET /api/guardrails/export, and POST /api/guardrails/import.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core.guardrails.exceptions import GuardrailsError
from src.core.guardrails.models import (
    ActionType,
    EvaluatedContext,
    EvaluatedGuideline,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
    TaskContext,
)
from src.orchestrator.routes.guardrails_api import (
    get_guardrails_store,
    router,
)


def _make_guideline(
    guideline_id: str = "gl-001",
    name: str = "Test Guideline",
    category: GuidelineCategory = GuidelineCategory.COGNITIVE_ISOLATION,
    enabled: bool = True,
    priority: int = 100,
    version: int = 1,
) -> Guideline:
    """Create a test Guideline domain object."""
    now = datetime.now(timezone.utc)
    return Guideline(
        id=guideline_id,
        name=name,
        description="A test guideline",
        enabled=enabled,
        category=category,
        priority=priority,
        condition=GuidelineCondition(agents=["backend"]),
        action=GuidelineAction(
            type=ActionType.INSTRUCTION,
            instruction="Follow TDD",
        ),
        metadata={},
        version=version,
        created_at=now,
        updated_at=now,
        created_by="test-user",
    )


@pytest.fixture
def mock_store() -> AsyncMock:
    """Create a mock GuardrailsStore."""
    return AsyncMock()


@pytest.fixture
def client(mock_store: AsyncMock) -> TestClient:
    """Create test client with mocked store dependency."""
    app = FastAPI()
    app.include_router(router)

    app.dependency_overrides[get_guardrails_store] = lambda: mock_store

    return TestClient(app)


# ---------------------------------------------------------------------------
# GET /api/guardrails/audit
# ---------------------------------------------------------------------------


class TestAuditList:
    """Tests for GET /api/guardrails/audit."""

    def test_audit_list_empty(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test audit list returns empty when no entries exist."""
        mock_store.list_audit_entries.return_value = ([], 0)

        response = client.get("/api/guardrails/audit")

        assert response.status_code == 200
        data = response.json()
        assert data["entries"] == []
        assert data["total"] == 0

    def test_audit_list_with_results(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test audit list returns entries and total count."""
        entries = [
            {
                "id": "audit-001",
                "event_type": "guideline_created",
                "guideline_id": "gl-001",
                "timestamp": "2026-01-15T10:00:00+00:00",
                "changes": {"name": "My Guideline"},
            },
            {
                "id": "audit-002",
                "event_type": "guideline_updated",
                "guideline_id": "gl-001",
                "timestamp": "2026-01-15T11:00:00+00:00",
                "changes": {"priority": 200},
            },
        ]
        mock_store.list_audit_entries.return_value = (entries, 2)

        response = client.get("/api/guardrails/audit")

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 2
        assert data["total"] == 2
        assert data["entries"][0]["id"] == "audit-001"
        assert data["entries"][0]["event_type"] == "guideline_created"
        assert data["entries"][1]["id"] == "audit-002"

    def test_audit_list_with_guideline_id_filter(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test audit list filters by guideline_id."""
        entries = [
            {
                "id": "audit-003",
                "event_type": "guideline_toggled",
                "guideline_id": "gl-002",
                "timestamp": "2026-01-15T12:00:00+00:00",
            },
        ]
        mock_store.list_audit_entries.return_value = (entries, 1)

        response = client.get(
            "/api/guardrails/audit", params={"guideline_id": "gl-002"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 1
        assert data["entries"][0]["guideline_id"] == "gl-002"
        mock_store.list_audit_entries.assert_called_once_with(
            guideline_id="gl-002",
            event_type=None,
            date_from=None,
            date_to=None,
            page=1,
            page_size=50,
        )

    def test_audit_list_with_event_type_filter(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test audit list filters by event_type."""
        entries = [
            {
                "id": "audit-004",
                "event_type": "guideline_deleted",
                "guideline_id": "gl-003",
                "timestamp": "2026-01-16T08:00:00+00:00",
            },
        ]
        mock_store.list_audit_entries.return_value = (entries, 1)

        response = client.get(
            "/api/guardrails/audit",
            params={"event_type": "guideline_deleted"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 1
        mock_store.list_audit_entries.assert_called_once_with(
            guideline_id=None,
            event_type="guideline_deleted",
            date_from=None,
            date_to=None,
            page=1,
            page_size=50,
        )

    def test_audit_list_with_pagination(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test audit list respects page and page_size parameters."""
        mock_store.list_audit_entries.return_value = ([], 0)

        response = client.get(
            "/api/guardrails/audit",
            params={"page": 2, "page_size": 10},
        )

        assert response.status_code == 200
        mock_store.list_audit_entries.assert_called_once_with(
            guideline_id=None,
            event_type=None,
            date_from=None,
            date_to=None,
            page=2,
            page_size=10,
        )

    def test_audit_store_error_returns_503(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that store errors during audit listing return 503."""
        mock_store.list_audit_entries.side_effect = GuardrailsError(
            "ES connection failed"
        )

        response = client.get("/api/guardrails/audit")

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data


# ---------------------------------------------------------------------------
# POST /api/guardrails/evaluate
# ---------------------------------------------------------------------------


class TestEvaluate:
    """Tests for POST /api/guardrails/evaluate."""

    def test_evaluate_with_matching_context(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test evaluate returns matching guidelines for a context."""
        guideline = _make_guideline("gl-001", priority=200)
        task_context = TaskContext(agent="backend", domain="P01")
        evaluated_guideline = EvaluatedGuideline(
            guideline=guideline,
            match_score=1.0,
            matched_fields=("agents",),
        )
        evaluated_context = EvaluatedContext(
            context=task_context,
            matched_guidelines=(evaluated_guideline,),
            combined_instruction="Follow TDD",
            tools_allowed=("pytest",),
            tools_denied=("rm",),
            hitl_gates=("devops_invocation",),
        )

        with patch(
            "src.orchestrator.routes.guardrails_api.GuardrailsEvaluator"
        ) as mock_evaluator_cls:
            mock_evaluator = AsyncMock()
            mock_evaluator.get_context.return_value = evaluated_context
            mock_evaluator_cls.return_value = mock_evaluator

            response = client.post(
                "/api/guardrails/evaluate",
                json={"agent": "backend", "domain": "P01"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["matched_count"] == 1
        assert data["combined_instruction"] == "Follow TDD"
        assert data["tools_allowed"] == ["pytest"]
        assert data["tools_denied"] == ["rm"]
        assert data["hitl_gates"] == ["devops_invocation"]
        assert len(data["guidelines"]) == 1
        assert data["guidelines"][0]["guideline_id"] == "gl-001"
        assert data["guidelines"][0]["guideline_name"] == "Test Guideline"
        assert data["guidelines"][0]["priority"] == 200
        assert data["guidelines"][0]["match_score"] == 1.0
        assert data["guidelines"][0]["matched_fields"] == ["agents"]

    def test_evaluate_with_no_matches(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test evaluate returns empty results when no guidelines match."""
        task_context = TaskContext(agent="unknown-agent")
        evaluated_context = EvaluatedContext(
            context=task_context,
            matched_guidelines=(),
            combined_instruction="",
            tools_allowed=(),
            tools_denied=(),
            hitl_gates=(),
        )

        with patch(
            "src.orchestrator.routes.guardrails_api.GuardrailsEvaluator"
        ) as mock_evaluator_cls:
            mock_evaluator = AsyncMock()
            mock_evaluator.get_context.return_value = evaluated_context
            mock_evaluator_cls.return_value = mock_evaluator

            response = client.post(
                "/api/guardrails/evaluate",
                json={"agent": "unknown-agent"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["matched_count"] == 0
        assert data["combined_instruction"] == ""
        assert data["tools_allowed"] == []
        assert data["tools_denied"] == []
        assert data["hitl_gates"] == []
        assert data["guidelines"] == []

    def test_evaluate_store_error_returns_503(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that evaluator errors return 503."""
        with patch(
            "src.orchestrator.routes.guardrails_api.GuardrailsEvaluator"
        ) as mock_evaluator_cls:
            mock_evaluator = AsyncMock()
            mock_evaluator.get_context.side_effect = GuardrailsError(
                "ES connection failed"
            )
            mock_evaluator_cls.return_value = mock_evaluator

            response = client.post(
                "/api/guardrails/evaluate",
                json={"agent": "backend"},
            )

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data


# ---------------------------------------------------------------------------
# GET /api/guardrails/export
# ---------------------------------------------------------------------------


class TestExport:
    """Tests for GET /api/guardrails/export."""

    def test_export_all_guidelines(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test export returns all guidelines as a JSON array."""
        guideline_1 = _make_guideline("gl-001", name="Guideline A")
        guideline_2 = _make_guideline("gl-002", name="Guideline B")
        mock_store.list_guidelines.return_value = (
            [guideline_1, guideline_2],
            2,
        )

        response = client.get("/api/guardrails/export")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        assert data[0]["name"] == "Guideline A"
        assert data[1]["name"] == "Guideline B"

    def test_export_with_category_filter(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test export filters by category."""
        guideline = _make_guideline(
            "gl-001",
            name="HITL Gate",
            category=GuidelineCategory.HITL_GATE,
        )
        mock_store.list_guidelines.return_value = ([guideline], 1)

        response = client.get(
            "/api/guardrails/export",
            params={"category": "hitl_gate"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "HITL Gate"
        # Verify the store was called with a category filter
        mock_store.list_guidelines.assert_called_once()
        call_kwargs = mock_store.list_guidelines.call_args
        assert call_kwargs.kwargs.get("page_size") == 10000

    def test_export_store_error_returns_503(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that store errors during export return 503."""
        mock_store.list_guidelines.side_effect = GuardrailsError(
            "ES connection failed"
        )

        response = client.get("/api/guardrails/export")

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data


# ---------------------------------------------------------------------------
# POST /api/guardrails/import
# ---------------------------------------------------------------------------


class TestImport:
    """Tests for POST /api/guardrails/import."""

    def test_import_guidelines_success(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test importing multiple guidelines returns success count."""
        mock_store.create_guideline.side_effect = lambda g: g
        mock_store.log_audit_entry.return_value = "audit-import"

        payload = [
            {
                "name": "Imported Rule A",
                "description": "First imported rule",
                "category": "custom",
                "priority": 50,
                "enabled": True,
                "condition": {"agents": ["backend"]},
                "action": {
                    "action_type": "instruction",
                    "instruction": "Do A",
                },
            },
            {
                "name": "Imported Rule B",
                "description": "Second imported rule",
                "category": "tdd_protocol",
                "priority": 100,
                "enabled": True,
                "condition": {"domains": ["P01"]},
                "action": {
                    "action_type": "instruction",
                    "instruction": "Do B",
                },
            },
        ]

        response = client.post("/api/guardrails/import", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 2
        assert data["errors"] == []
        assert mock_store.create_guideline.call_count == 2

    def test_import_with_partial_errors(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test importing with some failures returns partial results."""
        # First call succeeds, second fails
        mock_store.create_guideline.side_effect = [
            _make_guideline("gl-imported-1"),
            GuardrailsError("Index write failed"),
        ]
        mock_store.log_audit_entry.return_value = "audit-import"

        payload = [
            {
                "name": "Good Rule",
                "category": "custom",
                "priority": 50,
                "enabled": True,
                "condition": {"agents": ["backend"]},
                "action": {
                    "action_type": "instruction",
                    "instruction": "Do good",
                },
            },
            {
                "name": "Bad Rule",
                "category": "custom",
                "priority": 50,
                "enabled": True,
                "condition": {"agents": ["frontend"]},
                "action": {
                    "action_type": "instruction",
                    "instruction": "Will fail",
                },
            },
        ]

        response = client.post("/api/guardrails/import", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 1
        assert len(data["errors"]) == 1
        assert "Bad Rule" in data["errors"][0]

    def test_import_store_error_returns_503(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that a catastrophic store error during import returns 503."""
        # If the first call raises an unexpected exception type, the whole
        # import should 503
        mock_store.create_guideline.side_effect = RuntimeError(
            "Unexpected failure"
        )

        payload = [
            {
                "name": "Broken Import",
                "category": "custom",
                "priority": 50,
                "enabled": True,
                "condition": {"agents": ["backend"]},
                "action": {
                    "action_type": "instruction",
                    "instruction": "Will fail",
                },
            },
        ]

        response = client.post("/api/guardrails/import", json=payload)

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data


# ---------------------------------------------------------------------------
# Route ordering: /audit should not be matched as {guideline_id}
# ---------------------------------------------------------------------------


class TestRouteOrdering:
    """Tests ensuring static routes are matched before dynamic ones."""

    def test_audit_route_not_matched_as_guideline_id(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that /api/guardrails/audit is not matched as /{guideline_id}."""
        mock_store.list_audit_entries.return_value = ([], 0)

        response = client.get("/api/guardrails/audit")

        # If the route matched /{guideline_id} with guideline_id="audit",
        # it would call get_guideline("audit") instead.
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "total" in data
        # Verify list_audit_entries was called, not get_guideline
        mock_store.list_audit_entries.assert_called_once()
        mock_store.get_guideline.assert_not_called()

    def test_export_route_not_matched_as_guideline_id(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that /api/guardrails/export is not matched as /{guideline_id}."""
        mock_store.list_guidelines.return_value = ([], 0)

        response = client.get("/api/guardrails/export")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify list_guidelines was called, not get_guideline
        mock_store.list_guidelines.assert_called_once()
        mock_store.get_guideline.assert_not_called()
