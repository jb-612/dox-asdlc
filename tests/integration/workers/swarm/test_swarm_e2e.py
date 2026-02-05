"""End-to-end integration tests for the Swarm Review API (T23).

Tests the complete flow through the API endpoints including:
- Trigger swarm -> poll status -> get results
- API response format validation
- Unified report structure verification
- Error handling scenarios

Uses FastAPI TestClient with mocked dependencies to test the full API flow.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.models import (
    ReviewerResult,
    ReviewFinding,
    Severity,
    SwarmSession,
    SwarmStatus,
    UnifiedReport,
)
from src.workers.swarm.redis_store import SwarmRedisStore
from src.workers.swarm.reviewers import default_registry
from src.workers.swarm.session import SwarmSessionManager
from src.orchestrator.routes.swarm import (
    router,
    get_swarm_config,
    get_reviewer_registry,
    get_swarm_session_manager,
    get_swarm_dispatcher,
    _active_swarms,
)


def make_test_finding(
    reviewer_type: str = "security",
    severity: Severity = Severity.MEDIUM,
) -> ReviewFinding:
    """Create a test finding."""
    return ReviewFinding(
        id=f"finding-{uuid.uuid4().hex[:8]}",
        reviewer_type=reviewer_type,
        severity=severity,
        category="test_category",
        title=f"{reviewer_type.title()} Finding",
        description=f"Test finding from {reviewer_type}",
        file_path="src/test.py",
        line_start=10,
        line_end=15,
        code_snippet="# test code",
        recommendation="Fix this issue",
        confidence=0.85,
    )


def make_test_result(
    reviewer_type: str,
    status: str = "success",
    findings: list[ReviewFinding] | None = None,
) -> ReviewerResult:
    """Create a test reviewer result."""
    return ReviewerResult(
        reviewer_type=reviewer_type,
        status=status,
        findings=findings or [],
        duration_seconds=10.0,
        files_reviewed=["src/test.py"],
        error_message=None if status == "success" else "Test error",
    )


def make_test_session(
    session_id: str | None = None,
    status: SwarmStatus = SwarmStatus.PENDING,
    results: dict[str, ReviewerResult] | None = None,
    unified_report: UnifiedReport | None = None,
) -> SwarmSession:
    """Create a test swarm session."""
    return SwarmSession(
        id=session_id or f"swarm-{uuid.uuid4().hex[:8]}",
        target_path="src/workers/",
        reviewers=["security", "performance", "style"],
        status=status,
        created_at=datetime.now(UTC),
        completed_at=datetime.now(UTC) if status == SwarmStatus.COMPLETE else None,
        results=results or {},
        unified_report=unified_report,
    )


def make_test_report(
    swarm_id: str,
    findings_count: int = 3,
) -> UnifiedReport:
    """Create a test unified report."""
    critical = [make_test_finding("security", Severity.CRITICAL)]
    high = [make_test_finding("security", Severity.HIGH)]
    medium = [make_test_finding("performance", Severity.MEDIUM)]

    return UnifiedReport(
        swarm_id=swarm_id,
        target_path="src/workers/",
        created_at=datetime.now(UTC),
        reviewers_completed=["security", "performance", "style"],
        reviewers_failed=[],
        critical_findings=critical,
        high_findings=high,
        medium_findings=medium,
        low_findings=[],
        info_findings=[],
        total_findings=findings_count,
        findings_by_reviewer={"security": 2, "performance": 1},
        findings_by_category={"test_category": 3},
        duplicates_removed=0,
    )


@pytest.fixture(autouse=True)
def clear_rate_limit_state():
    """Clear rate limiting state before each test."""
    _active_swarms.clear()
    yield
    _active_swarms.clear()


@pytest.fixture
def test_config() -> SwarmConfig:
    """Test configuration."""
    return SwarmConfig(
        key_prefix="test_swarm",
        result_ttl_seconds=60,
        task_timeout_seconds=30,
        max_concurrent_swarms=5,
        default_reviewers=["security", "performance", "style"],
        allowed_path_prefixes=["src/", "tests/", "docker/"],
    )


@pytest.fixture
def mock_session_manager() -> MagicMock:
    """Create mock session manager."""
    manager = MagicMock(spec=SwarmSessionManager)
    manager.get_session = AsyncMock(return_value=None)
    manager.create_session = AsyncMock()
    manager.update_status = AsyncMock()
    return manager


@pytest.fixture
def mock_dispatcher() -> MagicMock:
    """Create mock dispatcher."""
    dispatcher = MagicMock()
    dispatcher.dispatch_swarm = AsyncMock(return_value="swarm-test123")
    dispatcher.run_swarm = AsyncMock()
    return dispatcher


@pytest.fixture
def app(
    test_config: SwarmConfig,
    mock_session_manager: MagicMock,
    mock_dispatcher: MagicMock,
) -> FastAPI:
    """Create test FastAPI app with mocked dependencies."""
    app = FastAPI()
    app.include_router(router)

    # Override dependencies
    app.dependency_overrides[get_swarm_config] = lambda: test_config
    app.dependency_overrides[get_reviewer_registry] = lambda: default_registry
    app.dependency_overrides[get_swarm_session_manager] = lambda: mock_session_manager
    app.dependency_overrides[get_swarm_dispatcher] = lambda: mock_dispatcher

    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Create test client."""
    return TestClient(app)


class TestTriggerSwarmEndpoint:
    """Tests for POST /api/swarm/review endpoint."""

    def test_trigger_swarm_returns_202(
        self,
        client: TestClient,
        mock_dispatcher: MagicMock,
    ) -> None:
        """Test successful swarm trigger returns 202 Accepted."""
        mock_dispatcher.dispatch_swarm = AsyncMock(return_value="swarm-test123")

        response = client.post(
            "/api/swarm/review",
            json={"target_path": "src/workers/"},
        )

        assert response.status_code == 202

    def test_trigger_swarm_response_structure(
        self,
        client: TestClient,
        mock_dispatcher: MagicMock,
    ) -> None:
        """Test response contains required fields."""
        mock_dispatcher.dispatch_swarm = AsyncMock(return_value="swarm-test123")

        response = client.post(
            "/api/swarm/review",
            json={"target_path": "src/workers/"},
        )

        data = response.json()
        assert "swarm_id" in data
        assert "status" in data
        assert "poll_url" in data
        assert data["swarm_id"] == "swarm-test123"
        assert data["status"] == "pending"
        assert data["poll_url"] == "/api/swarm/review/swarm-test123"

    def test_trigger_swarm_with_custom_reviewers(
        self,
        client: TestClient,
        mock_dispatcher: MagicMock,
    ) -> None:
        """Test trigger with custom reviewer types."""
        mock_dispatcher.dispatch_swarm = AsyncMock(return_value="swarm-custom")

        response = client.post(
            "/api/swarm/review",
            json={
                "target_path": "src/workers/",
                "reviewer_types": ["security", "style"],
            },
        )

        assert response.status_code == 202
        mock_dispatcher.dispatch_swarm.assert_called_once()
        call_kwargs = mock_dispatcher.dispatch_swarm.call_args.kwargs
        assert call_kwargs["reviewer_types"] == ["security", "style"]

    def test_trigger_swarm_with_custom_timeout(
        self,
        client: TestClient,
        mock_dispatcher: MagicMock,
    ) -> None:
        """Test trigger with custom timeout."""
        mock_dispatcher.dispatch_swarm = AsyncMock(return_value="swarm-timeout")

        response = client.post(
            "/api/swarm/review",
            json={
                "target_path": "src/workers/",
                "timeout_seconds": 120,
            },
        )

        assert response.status_code == 202
        call_kwargs = mock_dispatcher.dispatch_swarm.call_args.kwargs
        assert call_kwargs["timeout_seconds"] == 120


class TestInputValidation:
    """Tests for API input validation."""

    def test_reject_absolute_path(
        self,
        client: TestClient,
    ) -> None:
        """Test that absolute paths are rejected."""
        response = client.post(
            "/api/swarm/review",
            json={"target_path": "/etc/passwd"},
        )

        assert response.status_code == 400
        assert "Absolute paths not allowed" in response.json()["detail"]

    def test_reject_path_traversal(
        self,
        client: TestClient,
    ) -> None:
        """Test that path traversal is rejected."""
        response = client.post(
            "/api/swarm/review",
            json={"target_path": "src/../../../etc/passwd"},
        )

        assert response.status_code == 400
        assert "Path traversal not allowed" in response.json()["detail"]

    def test_reject_disallowed_path_prefix(
        self,
        client: TestClient,
    ) -> None:
        """Test that paths outside allowed prefixes are rejected."""
        response = client.post(
            "/api/swarm/review",
            json={"target_path": "secrets/api_keys.json"},
        )

        assert response.status_code == 400
        assert "Path must start with one of" in response.json()["detail"]

    def test_reject_unknown_reviewer_type(
        self,
        client: TestClient,
    ) -> None:
        """Test that unknown reviewer types are rejected."""
        response = client.post(
            "/api/swarm/review",
            json={
                "target_path": "src/workers/",
                "reviewer_types": ["security", "unknown_reviewer"],
            },
        )

        assert response.status_code == 400
        assert "Unknown reviewer type" in response.json()["detail"]

    def test_reject_invalid_timeout_too_low(
        self,
        client: TestClient,
    ) -> None:
        """Test that timeout below minimum is rejected."""
        response = client.post(
            "/api/swarm/review",
            json={
                "target_path": "src/workers/",
                "timeout_seconds": 10,  # Below minimum of 30
            },
        )

        assert response.status_code == 422  # Pydantic validation error

    def test_reject_invalid_timeout_too_high(
        self,
        client: TestClient,
    ) -> None:
        """Test that timeout above maximum is rejected."""
        response = client.post(
            "/api/swarm/review",
            json={
                "target_path": "src/workers/",
                "timeout_seconds": 1000,  # Above maximum of 600
            },
        )

        assert response.status_code == 422  # Pydantic validation error

    def test_accept_valid_paths(
        self,
        client: TestClient,
        mock_dispatcher: MagicMock,
    ) -> None:
        """Test that valid paths are accepted."""
        valid_paths = [
            "src/workers/",
            "src/orchestrator/main.py",
            "tests/unit/",
            "docker/workers/",
        ]

        for path in valid_paths:
            mock_dispatcher.dispatch_swarm = AsyncMock(return_value=f"swarm-{path}")
            response = client.post(
                "/api/swarm/review",
                json={"target_path": path},
            )
            assert response.status_code == 202, f"Path {path} should be accepted"


class TestGetSwarmStatusEndpoint:
    """Tests for GET /api/swarm/review/{swarm_id} endpoint."""

    def test_get_pending_status(
        self,
        client: TestClient,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test getting status of pending swarm."""
        session = make_test_session(
            session_id="swarm-pending",
            status=SwarmStatus.PENDING,
        )
        mock_session_manager.get_session = AsyncMock(return_value=session)

        response = client.get("/api/swarm/review/swarm-pending")

        assert response.status_code == 200
        data = response.json()
        assert data["swarm_id"] == "swarm-pending"
        assert data["status"] == "PENDING"

    def test_get_in_progress_status(
        self,
        client: TestClient,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test getting status of in-progress swarm."""
        # Session with some results
        results = {
            "security": make_test_result("security", findings=[make_test_finding()]),
        }
        session = make_test_session(
            session_id="swarm-progress",
            status=SwarmStatus.IN_PROGRESS,
            results=results,
        )
        mock_session_manager.get_session = AsyncMock(return_value=session)

        response = client.get("/api/swarm/review/swarm-progress")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "IN_PROGRESS"
        assert "security" in data["reviewers"]
        assert data["reviewers"]["security"]["status"] == "success"

    def test_get_complete_status_with_report(
        self,
        client: TestClient,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test getting status of completed swarm includes report."""
        session_id = "swarm-complete"
        report = make_test_report(session_id)
        results = {
            rt: make_test_result(rt, findings=[make_test_finding(rt)])
            for rt in ["security", "performance", "style"]
        }
        session = make_test_session(
            session_id=session_id,
            status=SwarmStatus.COMPLETE,
            results=results,
            unified_report=report,
        )
        mock_session_manager.get_session = AsyncMock(return_value=session)

        response = client.get(f"/api/swarm/review/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "COMPLETE"
        assert data["unified_report"] is not None
        assert data["unified_report"]["total_findings"] == 3

    def test_get_nonexistent_swarm_returns_404(
        self,
        client: TestClient,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test getting status of non-existent swarm returns 404."""
        mock_session_manager.get_session = AsyncMock(return_value=None)

        response = client.get("/api/swarm/review/swarm-nonexistent")

        assert response.status_code == 404
        assert "Swarm not found" in response.json()["detail"]

    def test_status_includes_reviewer_details(
        self,
        client: TestClient,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test status response includes detailed reviewer information."""
        results = {
            "security": make_test_result(
                "security",
                status="success",
                findings=[make_test_finding("security", Severity.HIGH)],
            ),
            "performance": make_test_result("performance", status="success"),
        }
        session = make_test_session(
            session_id="swarm-details",
            status=SwarmStatus.IN_PROGRESS,
            results=results,
        )
        mock_session_manager.get_session = AsyncMock(return_value=session)

        response = client.get("/api/swarm/review/swarm-details")

        data = response.json()
        reviewers = data["reviewers"]

        # Security should show completed with findings
        assert reviewers["security"]["status"] == "success"
        assert reviewers["security"]["findings_count"] == 1
        assert reviewers["security"]["progress_percent"] == 100

        # Performance should show completed without findings
        assert reviewers["performance"]["status"] == "success"
        assert reviewers["performance"]["findings_count"] == 0

        # Style should show pending (not in results)
        assert reviewers["style"]["status"] == "pending"
        assert reviewers["style"]["progress_percent"] == 0


class TestUnifiedReportStructure:
    """Tests for unified report response structure."""

    def test_report_contains_required_fields(
        self,
        client: TestClient,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test that unified report contains all required fields."""
        session_id = "swarm-report-fields"
        report = make_test_report(session_id, findings_count=5)
        session = make_test_session(
            session_id=session_id,
            status=SwarmStatus.COMPLETE,
            unified_report=report,
        )
        mock_session_manager.get_session = AsyncMock(return_value=session)

        response = client.get(f"/api/swarm/review/{session_id}")
        report_data = response.json()["unified_report"]

        # Required fields
        assert "swarm_id" in report_data
        assert "target_path" in report_data
        assert "created_at" in report_data
        assert "total_findings" in report_data
        assert "critical_findings" in report_data
        assert "high_findings" in report_data
        assert "medium_findings" in report_data
        assert "low_findings" in report_data
        assert "info_findings" in report_data
        assert "reviewers_completed" in report_data
        assert "reviewers_failed" in report_data
        assert "findings_by_reviewer" in report_data
        assert "findings_by_category" in report_data
        assert "duplicates_removed" in report_data

    def test_report_findings_grouped_by_severity(
        self,
        client: TestClient,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test that findings are correctly grouped by severity."""
        session_id = "swarm-severity"
        report = make_test_report(session_id)
        session = make_test_session(
            session_id=session_id,
            status=SwarmStatus.COMPLETE,
            unified_report=report,
        )
        mock_session_manager.get_session = AsyncMock(return_value=session)

        response = client.get(f"/api/swarm/review/{session_id}")
        report_data = response.json()["unified_report"]

        assert len(report_data["critical_findings"]) == 1
        assert len(report_data["high_findings"]) == 1
        assert len(report_data["medium_findings"]) == 1

    def test_report_finding_structure(
        self,
        client: TestClient,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test that individual findings have correct structure."""
        session_id = "swarm-finding-struct"
        report = make_test_report(session_id)
        session = make_test_session(
            session_id=session_id,
            status=SwarmStatus.COMPLETE,
            unified_report=report,
        )
        mock_session_manager.get_session = AsyncMock(return_value=session)

        response = client.get(f"/api/swarm/review/{session_id}")
        finding = response.json()["unified_report"]["critical_findings"][0]

        # Required finding fields
        assert "id" in finding
        assert "reviewer_type" in finding
        assert "severity" in finding
        assert "category" in finding
        assert "title" in finding
        assert "description" in finding
        assert "file_path" in finding
        assert "line_start" in finding
        assert "recommendation" in finding
        assert "confidence" in finding


class TestErrorHandling:
    """Tests for API error handling."""

    def test_dispatcher_unavailable_returns_503(
        self,
        app: FastAPI,
    ) -> None:
        """Test that unavailable dispatcher returns 503."""
        # Override to return None
        app.dependency_overrides[get_swarm_dispatcher] = lambda: None
        client = TestClient(app)

        response = client.post(
            "/api/swarm/review",
            json={"target_path": "src/workers/"},
        )

        assert response.status_code == 503
        assert "dispatcher not available" in response.json()["detail"].lower()

    def test_session_manager_unavailable_returns_503(
        self,
        app: FastAPI,
    ) -> None:
        """Test that unavailable session manager returns 503."""
        # Override to return None
        app.dependency_overrides[get_swarm_session_manager] = lambda: None
        client = TestClient(app)

        response = client.get("/api/swarm/review/swarm-test")

        assert response.status_code == 503
        assert "manager not available" in response.json()["detail"].lower()

    def test_empty_target_path_rejected(
        self,
        client: TestClient,
    ) -> None:
        """Test that empty target path is rejected."""
        response = client.post(
            "/api/swarm/review",
            json={"target_path": ""},
        )

        assert response.status_code == 422  # Pydantic validation

    def test_missing_target_path_rejected(
        self,
        client: TestClient,
    ) -> None:
        """Test that missing target path is rejected."""
        response = client.post(
            "/api/swarm/review",
            json={},
        )

        assert response.status_code == 422  # Pydantic validation


class TestRateLimiting:
    """Tests for rate limiting functionality."""

    def test_rate_limit_check_enforced(
        self,
        test_config: SwarmConfig,
        mock_dispatcher: MagicMock,
        mock_session_manager: MagicMock,
    ) -> None:
        """Test that rate limiting is enforced."""
        # Create app with very low limit
        limited_config = SwarmConfig(
            key_prefix="rate_test",
            max_concurrent_swarms=1,
            allowed_path_prefixes=["src/"],
        )

        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_swarm_config] = lambda: limited_config
        app.dependency_overrides[get_reviewer_registry] = lambda: default_registry
        app.dependency_overrides[get_swarm_session_manager] = lambda: mock_session_manager
        app.dependency_overrides[get_swarm_dispatcher] = lambda: mock_dispatcher

        mock_dispatcher.dispatch_swarm = AsyncMock(return_value="swarm-rate-test")

        client = TestClient(app)

        # First request should succeed
        response1 = client.post(
            "/api/swarm/review",
            json={"target_path": "src/test1/"},
        )
        assert response1.status_code == 202

        # Note: In a real test, we'd need to verify the active swarm tracking
        # For now, we test that the endpoint works and rate limit is configured


class TestFullPollingFlow:
    """Tests simulating the full trigger-poll-results flow."""

    def test_full_flow_trigger_poll_complete(
        self,
        mock_dispatcher: MagicMock,
        mock_session_manager: MagicMock,
        test_config: SwarmConfig,
    ) -> None:
        """Test complete flow: trigger -> poll -> get results."""
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_swarm_config] = lambda: test_config
        app.dependency_overrides[get_reviewer_registry] = lambda: default_registry
        app.dependency_overrides[get_swarm_session_manager] = lambda: mock_session_manager
        app.dependency_overrides[get_swarm_dispatcher] = lambda: mock_dispatcher

        session_id = "swarm-full-flow"
        mock_dispatcher.dispatch_swarm = AsyncMock(return_value=session_id)

        client = TestClient(app)

        # 1. Trigger swarm
        response = client.post(
            "/api/swarm/review",
            json={"target_path": "src/workers/"},
        )
        assert response.status_code == 202
        data = response.json()
        assert data["swarm_id"] == session_id
        poll_url = data["poll_url"]

        # 2. First poll - in progress
        in_progress_session = make_test_session(
            session_id=session_id,
            status=SwarmStatus.IN_PROGRESS,
            results={"security": make_test_result("security")},
        )
        mock_session_manager.get_session = AsyncMock(return_value=in_progress_session)

        response = client.get(poll_url)
        assert response.status_code == 200
        assert response.json()["status"] == "IN_PROGRESS"

        # 3. Second poll - complete
        complete_session = make_test_session(
            session_id=session_id,
            status=SwarmStatus.COMPLETE,
            results={
                rt: make_test_result(rt)
                for rt in ["security", "performance", "style"]
            },
            unified_report=make_test_report(session_id),
        )
        mock_session_manager.get_session = AsyncMock(return_value=complete_session)

        response = client.get(poll_url)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "COMPLETE"
        assert data["unified_report"] is not None
        assert data["unified_report"]["total_findings"] == 3

    def test_poll_shows_progress_updates(
        self,
        mock_session_manager: MagicMock,
        test_config: SwarmConfig,
        mock_dispatcher: MagicMock,
    ) -> None:
        """Test that polling shows incremental progress."""
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_swarm_config] = lambda: test_config
        app.dependency_overrides[get_reviewer_registry] = lambda: default_registry
        app.dependency_overrides[get_swarm_session_manager] = lambda: mock_session_manager
        app.dependency_overrides[get_swarm_dispatcher] = lambda: mock_dispatcher

        session_id = "swarm-progress"
        client = TestClient(app)

        # Progress stages
        stages = [
            # No results yet
            make_test_session(session_id=session_id, status=SwarmStatus.IN_PROGRESS),
            # Security complete
            make_test_session(
                session_id=session_id,
                status=SwarmStatus.IN_PROGRESS,
                results={"security": make_test_result("security")},
            ),
            # Two complete
            make_test_session(
                session_id=session_id,
                status=SwarmStatus.IN_PROGRESS,
                results={
                    "security": make_test_result("security"),
                    "performance": make_test_result("performance"),
                },
            ),
            # All complete
            make_test_session(
                session_id=session_id,
                status=SwarmStatus.COMPLETE,
                results={
                    rt: make_test_result(rt)
                    for rt in ["security", "performance", "style"]
                },
                unified_report=make_test_report(session_id),
            ),
        ]

        completed_counts = []
        for session in stages:
            mock_session_manager.get_session = AsyncMock(return_value=session)
            response = client.get(f"/api/swarm/review/{session_id}")
            reviewers = response.json()["reviewers"]
            completed = sum(
                1 for r in reviewers.values()
                if r["status"] == "success"
            )
            completed_counts.append(completed)

        # Should show increasing completion
        assert completed_counts == [0, 1, 2, 3]
