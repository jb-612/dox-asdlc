"""Unit tests for Guardrails CRUD API endpoints.

Tests POST, PUT, DELETE, and toggle endpoints for guardrails guidelines.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core.guardrails.exceptions import (
    GuardrailsError,
    GuidelineConflictError,
    GuidelineNotFoundError,
)
from src.core.guardrails.models import (
    ActionType,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
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


class TestCreateGuideline:
    """Tests for POST /api/guardrails."""

    def test_create_valid_guideline_returns_201(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test creating a valid guideline returns 201 with response data."""
        # The store returns whatever guideline is passed to it
        mock_store.create_guideline.side_effect = lambda g: g
        mock_store.log_audit_entry.return_value = "audit-001"

        payload = {
            "name": "TDD Protocol",
            "description": "Enforce TDD workflow",
            "category": "tdd_protocol",
            "priority": 200,
            "enabled": True,
            "condition": {"agents": ["backend"]},
            "action": {
                "action_type": "instruction",
                "instruction": "Write tests first",
            },
        }

        response = client.post("/api/guardrails", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "TDD Protocol"
        assert data["description"] == "Enforce TDD workflow"
        assert data["priority"] == 200
        assert data["enabled"] is True
        assert data["version"] == 1
        assert data["created_by"] == "api"
        assert data["id"]  # should have a generated ID
        mock_store.create_guideline.assert_called_once()
        mock_store.log_audit_entry.assert_called_once()

    def test_create_with_validation_error_returns_422(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that missing required fields returns 422."""
        # Missing 'name', 'condition', 'action' -- all required
        payload = {
            "description": "No name provided",
            "category": "tdd_protocol",
        }

        response = client.post("/api/guardrails", json=payload)

        assert response.status_code == 422

    def test_create_store_error_returns_503(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that store errors during creation return 503."""
        mock_store.create_guideline.side_effect = GuardrailsError(
            "ES connection failed"
        )

        payload = {
            "name": "Broken Guideline",
            "description": "Will fail",
            "category": "custom",
            "priority": 100,
            "enabled": True,
            "condition": {"agents": ["backend"]},
            "action": {
                "action_type": "instruction",
                "instruction": "Do something",
            },
        }

        response = client.post("/api/guardrails", json=payload)

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data


class TestUpdateGuideline:
    """Tests for PUT /api/guardrails/{guideline_id}."""

    def test_update_with_correct_version_returns_200(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test updating a guideline with correct version returns 200."""
        existing = _make_guideline("gl-001", version=1)
        updated = _make_guideline("gl-001", name="Updated Name", version=2)

        mock_store.get_guideline.return_value = existing
        mock_store.update_guideline.return_value = updated
        mock_store.log_audit_entry.return_value = "audit-002"

        payload = {
            "name": "Updated Name",
            "version": 1,
        }

        response = client.put("/api/guardrails/gl-001", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "gl-001"
        mock_store.update_guideline.assert_called_once()
        mock_store.log_audit_entry.assert_called_once()

    def test_update_with_wrong_version_returns_409(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that version mismatch returns 409 conflict."""
        existing = _make_guideline("gl-001", version=3)

        mock_store.get_guideline.return_value = existing
        mock_store.update_guideline.side_effect = GuidelineConflictError(
            "gl-001", expected_version=1, actual_version=3
        )

        payload = {
            "name": "Updated Name",
            "version": 1,
        }

        response = client.put("/api/guardrails/gl-001", json=payload)

        assert response.status_code == 409
        data = response.json()
        assert "detail" in data

    def test_update_nonexistent_guideline_returns_404(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test updating a non-existent guideline returns 404."""
        mock_store.get_guideline.side_effect = GuidelineNotFoundError(
            "gl-missing"
        )

        payload = {
            "name": "Does not matter",
            "version": 1,
        }

        response = client.put("/api/guardrails/gl-missing", json=payload)

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data


class TestDeleteGuideline:
    """Tests for DELETE /api/guardrails/{guideline_id}."""

    def test_delete_existing_guideline_returns_204(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test deleting an existing guideline returns 204 No Content."""
        mock_store.delete_guideline.return_value = True
        mock_store.log_audit_entry.return_value = "audit-003"

        response = client.delete("/api/guardrails/gl-001")

        assert response.status_code == 204
        assert response.content == b""
        mock_store.delete_guideline.assert_called_once_with("gl-001")
        mock_store.log_audit_entry.assert_called_once()

    def test_delete_nonexistent_guideline_returns_404(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test deleting a non-existent guideline returns 404."""
        mock_store.delete_guideline.side_effect = GuidelineNotFoundError(
            "gl-missing"
        )

        response = client.delete("/api/guardrails/gl-missing")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data


class TestDomainEnumRoundTrip:
    """Tests verifying domain enum values round-trip through the API layer."""

    def test_all_domain_action_types_round_trip_through_create(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test each domain ActionType survives create -> get round-trip."""
        from src.core.guardrails.models import ActionType as DomainActionType

        for action_type in DomainActionType:
            mock_store.create_guideline.side_effect = lambda g: g
            mock_store.log_audit_entry.return_value = "audit-rt"

            payload = {
                "name": f"Test {action_type.value}",
                "description": "Round-trip test",
                "category": "custom",
                "priority": 100,
                "enabled": True,
                "condition": {"agents": ["backend"]},
                "action": {
                    "action_type": action_type.value,
                    "instruction": "Test instruction",
                },
            }

            response = client.post("/api/guardrails", json=payload)

            assert response.status_code == 201, (
                f"Failed for action_type={action_type.value}: "
                f"{response.json()}"
            )
            data = response.json()
            assert data["action"]["action_type"] == action_type.value

    def test_all_domain_categories_round_trip_through_create(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test each domain GuidelineCategory survives create -> get round-trip."""
        from src.core.guardrails.models import (
            GuidelineCategory as DomainCategory,
        )

        for category in DomainCategory:
            mock_store.create_guideline.side_effect = lambda g: g
            mock_store.log_audit_entry.return_value = "audit-rt"

            payload = {
                "name": f"Test {category.value}",
                "description": "Round-trip test",
                "category": category.value,
                "priority": 100,
                "enabled": True,
                "condition": {"agents": ["backend"]},
                "action": {
                    "action_type": "instruction",
                    "instruction": "Test instruction",
                },
            }

            response = client.post("/api/guardrails", json=payload)

            assert response.status_code == 201, (
                f"Failed for category={category.value}: "
                f"{response.json()}"
            )
            data = response.json()
            assert data["category"] == category.value

    def test_domain_guideline_to_response_preserves_all_action_types(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test _guideline_to_response preserves all domain ActionType values."""
        from src.core.guardrails.models import ActionType as DomainActionType

        for action_type in DomainActionType:
            gl = _make_guideline(f"gl-{action_type.value}")
            # Override the action with the specific type
            gl = Guideline(
                id=gl.id,
                name=gl.name,
                description=gl.description,
                enabled=gl.enabled,
                category=gl.category,
                priority=gl.priority,
                condition=gl.condition,
                action=GuidelineAction(
                    type=action_type, instruction="test"
                ),
                metadata=gl.metadata,
                version=gl.version,
                created_at=gl.created_at,
                updated_at=gl.updated_at,
                created_by=gl.created_by,
            )
            mock_store.get_guideline.return_value = gl

            response = client.get(f"/api/guardrails/gl-{action_type.value}")

            assert response.status_code == 200, (
                f"Failed for action_type={action_type.value}"
            )
            data = response.json()
            assert data["action"]["action_type"] == action_type.value

    def test_domain_guideline_to_response_preserves_all_categories(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test _guideline_to_response preserves all domain category values."""
        from src.core.guardrails.models import (
            GuidelineCategory as DomainCategory,
        )

        for category in DomainCategory:
            gl = _make_guideline(
                f"gl-{category.value}", category=category
            )
            mock_store.get_guideline.return_value = gl

            response = client.get(f"/api/guardrails/gl-{category.value}")

            assert response.status_code == 200, (
                f"Failed for category={category.value}"
            )
            data = response.json()
            assert data["category"] == category.value

    def test_context_constraint_category_not_coerced_to_custom(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Regression: context_constraint must not be coerced to custom (F02)."""
        mock_store.create_guideline.side_effect = lambda g: g
        mock_store.log_audit_entry.return_value = "audit-f02"

        payload = {
            "name": "Commit size limit",
            "description": "Limits commit to 10 files",
            "category": "context_constraint",
            "priority": 700,
            "enabled": True,
            "condition": {"actions": ["commit"]},
            "action": {
                "action_type": "constraint",
                "max_files": 10,
            },
        }

        response = client.post("/api/guardrails", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "context_constraint"
        assert data["action"]["action_type"] == "constraint"
        assert data["action"]["max_files"] == 10

    def test_tool_restriction_action_type_not_lossy(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Regression: tool_restriction action type preserved exactly (F01)."""
        mock_store.create_guideline.side_effect = lambda g: g
        mock_store.log_audit_entry.return_value = "audit-f01"

        payload = {
            "name": "Backend tool restrictions",
            "description": "Restrict backend tools",
            "category": "cognitive_isolation",
            "priority": 900,
            "enabled": True,
            "condition": {"agents": ["backend"]},
            "action": {
                "action_type": "tool_restriction",
                "tools_allowed": ["Read", "Write", "Edit"],
                "tools_denied": [],
            },
        }

        response = client.post("/api/guardrails", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["action"]["action_type"] == "tool_restriction"


class TestToggleGuideline:
    """Tests for POST /api/guardrails/{guideline_id}/toggle."""

    def test_toggle_enabled_to_disabled(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test toggling an enabled guideline to disabled."""
        existing = _make_guideline("gl-001", enabled=True, version=1)
        toggled = _make_guideline("gl-001", enabled=False, version=2)

        mock_store.get_guideline.return_value = existing
        mock_store.update_guideline.return_value = toggled
        mock_store.log_audit_entry.return_value = "audit-004"

        response = client.post("/api/guardrails/gl-001/toggle")

        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False
        mock_store.update_guideline.assert_called_once()
        mock_store.log_audit_entry.assert_called_once()

    def test_toggle_disabled_to_enabled(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test toggling a disabled guideline to enabled."""
        existing = _make_guideline("gl-001", enabled=False, version=1)
        toggled = _make_guideline("gl-001", enabled=True, version=2)

        mock_store.get_guideline.return_value = existing
        mock_store.update_guideline.return_value = toggled
        mock_store.log_audit_entry.return_value = "audit-005"

        response = client.post("/api/guardrails/gl-001/toggle")

        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is True
        mock_store.update_guideline.assert_called_once()

    def test_toggle_nonexistent_guideline_returns_404(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test toggling a non-existent guideline returns 404."""
        mock_store.get_guideline.side_effect = GuidelineNotFoundError(
            "gl-missing"
        )

        response = client.post("/api/guardrails/gl-missing/toggle")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
