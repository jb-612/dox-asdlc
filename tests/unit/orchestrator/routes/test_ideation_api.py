"""Tests for Ideation API routes.

Tests the REST API endpoints for PRD Ideation Studio (P05-F11).
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.orchestrator.routes.ideation_api import (
    router,
    get_ideation_service,
    IdeationChatRequest,
    IdeationChatResponse,
    IdeationMessage,
    MaturityState,
    CategoryMaturity,
    Requirement,
    SubmitPRDRequest,
    SubmitPRDResponse,
    PRDDocument,
    PRDSection,
    UserStory,
    SaveDraftRequest,
    SaveDraftResponse,
)


@pytest.fixture
def mock_service() -> AsyncMock:
    """Create a mock ideation service."""
    service = AsyncMock()
    return service


@pytest.fixture
def client(mock_service: AsyncMock) -> TestClient:
    """Create test client with mocked service."""
    app = FastAPI()
    app.include_router(router)

    # Override the service dependency
    app.dependency_overrides[get_ideation_service] = lambda: mock_service

    return TestClient(app)


@pytest.fixture
def sample_maturity_state() -> MaturityState:
    """Create a sample maturity state."""
    return MaturityState(
        score=45.0,
        level="defined",
        categories=[
            CategoryMaturity(
                id="problem",
                name="Problem Statement",
                score=80.0,
                requiredForSubmit=True,
                sections=[],
            ),
            CategoryMaturity(
                id="users",
                name="Target Users",
                score=60.0,
                requiredForSubmit=True,
                sections=[],
            ),
            CategoryMaturity(
                id="functional",
                name="Functional Requirements",
                score=30.0,
                requiredForSubmit=True,
                sections=[],
            ),
        ],
        canSubmit=False,
        gaps=["Functional Requirements needs more detail"],
    )


@pytest.fixture
def sample_requirement() -> Requirement:
    """Create a sample requirement."""
    return Requirement(
        id="REQ-001",
        description="User can upload documents",
        type="functional",
        priority="must_have",
        categoryId="functional",
        sourceMessageId="msg-123",
        createdAt=datetime.now(timezone.utc).isoformat(),
    )


class TestInputValidation:
    """Tests for input validation."""

    def test_chat_empty_message_returns_400(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Empty message should return 400."""
        response = client.post(
            "/api/studio/ideation/chat",
            json={
                "sessionId": "test-session",
                "message": "",
                "currentMaturity": 0,
            },
        )
        assert response.status_code == 400
        assert "empty" in response.json()["detail"].lower()

    def test_chat_whitespace_message_returns_400(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Whitespace-only message should return 400."""
        response = client.post(
            "/api/studio/ideation/chat",
            json={
                "sessionId": "test-session",
                "message": "   ",
                "currentMaturity": 0,
            },
        )
        assert response.status_code == 400
        assert "empty" in response.json()["detail"].lower()

    def test_chat_empty_session_id_returns_400(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Empty session ID should return 400."""
        response = client.post(
            "/api/studio/ideation/chat",
            json={
                "sessionId": "",
                "message": "Hello",
                "currentMaturity": 0,
            },
        )
        assert response.status_code == 400
        assert "session" in response.json()["detail"].lower()

    def test_chat_whitespace_session_id_returns_400(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Whitespace-only session ID should return 400."""
        response = client.post(
            "/api/studio/ideation/chat",
            json={
                "sessionId": "   ",
                "message": "Hello",
                "currentMaturity": 0,
            },
        )
        assert response.status_code == 400
        assert "session" in response.json()["detail"].lower()


class TestIdeationChatEndpoint:
    """Tests for POST /api/studio/ideation/chat endpoint."""

    def test_chat_returns_response_with_maturity_update(
        self, client: TestClient, mock_service: AsyncMock, sample_maturity_state: MaturityState
    ) -> None:
        """Test chat endpoint returns response with maturity update."""
        mock_service.process_chat.return_value = IdeationChatResponse(
            message=IdeationMessage(
                id="msg-001",
                role="assistant",
                content="Tell me more about the users.",
                timestamp=datetime.now(timezone.utc).isoformat(),
                maturityDelta=5.0,
                extractedRequirements=[],
                suggestedFollowups=["Who are the primary users?"],
            ),
            maturityUpdate=sample_maturity_state,
            extractedRequirements=[],
            suggestedFollowups=["Who are the primary users?"],
        )

        response = client.post(
            "/api/studio/ideation/chat",
            json={
                "sessionId": "session-123",
                "message": "I want to build a document management system",
                "currentMaturity": 40.0,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"]["role"] == "assistant"
        assert "maturityUpdate" in data
        assert data["maturityUpdate"]["score"] == 45.0

    def test_chat_with_model_selection(
        self, client: TestClient, mock_service: AsyncMock, sample_maturity_state: MaturityState
    ) -> None:
        """Test chat endpoint accepts model selection."""
        mock_service.process_chat.return_value = IdeationChatResponse(
            message=IdeationMessage(
                id="msg-002",
                role="assistant",
                content="Response from Opus model.",
                timestamp=datetime.now(timezone.utc).isoformat(),
            ),
            maturityUpdate=sample_maturity_state,
            extractedRequirements=[],
            suggestedFollowups=[],
        )

        response = client.post(
            "/api/studio/ideation/chat",
            json={
                "sessionId": "session-123",
                "message": "Use Opus for this response",
                "currentMaturity": 40.0,
                "model": "opus",
            },
        )

        assert response.status_code == 200
        mock_service.process_chat.assert_called_once()
        call_args = mock_service.process_chat.call_args
        assert call_args[1].get("model") == "opus" or call_args[0][0].model == "opus"

    def test_chat_with_rlm_enabled(
        self, client: TestClient, mock_service: AsyncMock, sample_maturity_state: MaturityState
    ) -> None:
        """Test chat endpoint accepts RLM enabled flag."""
        mock_service.process_chat.return_value = IdeationChatResponse(
            message=IdeationMessage(
                id="msg-003",
                role="assistant",
                content="RLM-enhanced response.",
                timestamp=datetime.now(timezone.utc).isoformat(),
            ),
            maturityUpdate=sample_maturity_state,
            extractedRequirements=[],
            suggestedFollowups=[],
        )

        response = client.post(
            "/api/studio/ideation/chat",
            json={
                "sessionId": "session-123",
                "message": "Complex question requiring research",
                "currentMaturity": 40.0,
                "rlmEnabled": True,
            },
        )

        assert response.status_code == 200

    def test_chat_missing_session_id_returns_422(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test chat endpoint returns 422 for missing session ID."""
        response = client.post(
            "/api/studio/ideation/chat",
            json={
                "message": "Hello",
                "currentMaturity": 40.0,
            },
        )

        assert response.status_code == 422

    def test_chat_service_error_returns_500(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test chat endpoint returns 500 on service error."""
        mock_service.process_chat.side_effect = Exception("Service error")

        response = client.post(
            "/api/studio/ideation/chat",
            json={
                "sessionId": "session-123",
                "message": "Hello",
                "currentMaturity": 40.0,
            },
        )

        assert response.status_code == 500


class TestSubmitPRDEndpoint:
    """Tests for POST /api/studio/ideation/submit-prd endpoint."""

    def test_submit_prd_creates_gate_and_returns_draft(
        self, client: TestClient, mock_service: AsyncMock, sample_maturity_state: MaturityState
    ) -> None:
        """Test submit PRD endpoint creates gate and returns draft."""
        sample_maturity_state.score = 85.0
        sample_maturity_state.canSubmit = True

        mock_service.submit_for_prd.return_value = SubmitPRDResponse(
            gateId="gate-123",
            prdDraft=PRDDocument(
                id="prd-001",
                title="Document Management System",
                version="1.0.0",
                sections=[
                    PRDSection(
                        id="sec-001",
                        heading="Overview",
                        content="System overview...",
                        order=1,
                    )
                ],
                createdAt=datetime.now(timezone.utc).isoformat(),
                status="pending_review",
            ),
            userStories=[
                UserStory(
                    id="US-001",
                    title="Upload documents",
                    asA="user",
                    iWant="to upload documents",
                    soThat="I can store them centrally",
                    acceptanceCriteria=["Can upload PDF files", "File size limit enforced"],
                    linkedRequirements=["REQ-001"],
                    priority="must_have",
                )
            ],
            status="pending_review",
        )

        response = client.post(
            "/api/studio/ideation/submit-prd",
            json={
                "sessionId": "session-123",
                "maturityState": sample_maturity_state.model_dump(),
                "includeUserStories": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["gateId"] == "gate-123"
        assert data["prdDraft"]["title"] == "Document Management System"
        assert len(data["userStories"]) == 1
        assert data["status"] == "pending_review"

    def test_submit_prd_below_threshold_returns_400(
        self, client: TestClient, mock_service: AsyncMock, sample_maturity_state: MaturityState
    ) -> None:
        """Test submit PRD returns 400 when maturity is below threshold."""
        sample_maturity_state.score = 70.0
        sample_maturity_state.canSubmit = False

        response = client.post(
            "/api/studio/ideation/submit-prd",
            json={
                "sessionId": "session-123",
                "maturityState": sample_maturity_state.model_dump(),
                "includeUserStories": True,
            },
        )

        assert response.status_code == 400
        data = response.json()
        assert "maturity" in data["detail"].lower()

    def test_submit_prd_without_user_stories(
        self, client: TestClient, mock_service: AsyncMock, sample_maturity_state: MaturityState
    ) -> None:
        """Test submit PRD without user stories."""
        sample_maturity_state.score = 85.0
        sample_maturity_state.canSubmit = True

        mock_service.submit_for_prd.return_value = SubmitPRDResponse(
            gateId="gate-456",
            prdDraft=PRDDocument(
                id="prd-002",
                title="Simple PRD",
                version="1.0.0",
                sections=[],
                createdAt=datetime.now(timezone.utc).isoformat(),
                status="pending_review",
            ),
            userStories=[],
            status="pending_review",
        )

        response = client.post(
            "/api/studio/ideation/submit-prd",
            json={
                "sessionId": "session-123",
                "maturityState": sample_maturity_state.model_dump(),
                "includeUserStories": False,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["userStories"] == []


class TestGetMaturityEndpoint:
    """Tests for GET /api/studio/ideation/{sessionId}/maturity endpoint."""

    def test_get_maturity_returns_current_state(
        self, client: TestClient, mock_service: AsyncMock, sample_maturity_state: MaturityState
    ) -> None:
        """Test get maturity returns current session state."""
        mock_service.get_session_maturity.return_value = sample_maturity_state

        response = client.get("/api/studio/ideation/session-123/maturity")

        assert response.status_code == 200
        data = response.json()
        assert data["score"] == 45.0
        assert data["level"] == "defined"
        assert len(data["categories"]) == 3

    def test_get_maturity_session_not_found(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test get maturity returns 404 for unknown session."""
        mock_service.get_session_maturity.return_value = None

        response = client.get("/api/studio/ideation/unknown-session/maturity")

        assert response.status_code == 404


class TestSaveDraftEndpoint:
    """Tests for POST /api/studio/ideation/{sessionId}/draft endpoint."""

    def test_save_draft_succeeds(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test save draft endpoint succeeds."""
        mock_service.save_draft.return_value = SaveDraftResponse(
            success=True,
            sessionId="session-123",
            savedAt=datetime.now(timezone.utc).isoformat(),
        )

        response = client.post(
            "/api/studio/ideation/session-123/draft",
            json={
                "messages": [
                    {
                        "id": "msg-001",
                        "role": "user",
                        "content": "Hello",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                ],
                "maturityState": {
                    "score": 45.0,
                    "level": "defined",
                    "categories": [],
                    "canSubmit": False,
                    "gaps": [],
                },
                "extractedRequirements": [],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["sessionId"] == "session-123"

    def test_save_draft_with_requirements(
        self, client: TestClient, mock_service: AsyncMock, sample_requirement: Requirement
    ) -> None:
        """Test save draft with extracted requirements."""
        mock_service.save_draft.return_value = SaveDraftResponse(
            success=True,
            sessionId="session-123",
            savedAt=datetime.now(timezone.utc).isoformat(),
        )

        response = client.post(
            "/api/studio/ideation/session-123/draft",
            json={
                "messages": [],
                "maturityState": {
                    "score": 50.0,
                    "level": "defined",
                    "categories": [],
                    "canSubmit": False,
                    "gaps": [],
                },
                "extractedRequirements": [sample_requirement.model_dump()],
            },
        )

        assert response.status_code == 200

    def test_save_draft_service_error(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test save draft handles service errors."""
        mock_service.save_draft.side_effect = Exception("Storage error")

        response = client.post(
            "/api/studio/ideation/session-123/draft",
            json={
                "messages": [],
                "maturityState": {
                    "score": 45.0,
                    "level": "defined",
                    "categories": [],
                    "canSubmit": False,
                    "gaps": [],
                },
                "extractedRequirements": [],
            },
        )

        assert response.status_code == 500


class TestCamelCaseResponse:
    """Tests for camelCase field names in responses."""

    def test_chat_response_uses_camel_case(
        self, client: TestClient, mock_service: AsyncMock, sample_maturity_state: MaturityState
    ) -> None:
        """Test chat response uses camelCase field names."""
        mock_service.process_chat.return_value = IdeationChatResponse(
            message=IdeationMessage(
                id="msg-001",
                role="assistant",
                content="Response",
                timestamp=datetime.now(timezone.utc).isoformat(),
                maturityDelta=5.0,
                extractedRequirements=[],
                suggestedFollowups=["Question?"],
            ),
            maturityUpdate=sample_maturity_state,
            extractedRequirements=[],
            suggestedFollowups=["Question?"],
        )

        response = client.post(
            "/api/studio/ideation/chat",
            json={
                "sessionId": "session-123",
                "message": "Hello",
                "currentMaturity": 40.0,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Check camelCase in message
        assert "maturityDelta" in data["message"]
        assert "extractedRequirements" in data["message"]
        assert "suggestedFollowups" in data["message"]

        # Check camelCase in maturity update
        assert "maturityUpdate" in data
        assert "canSubmit" in data["maturityUpdate"]

    def test_prd_response_uses_camel_case(
        self, client: TestClient, mock_service: AsyncMock, sample_maturity_state: MaturityState
    ) -> None:
        """Test PRD response uses camelCase field names."""
        sample_maturity_state.score = 85.0
        sample_maturity_state.canSubmit = True

        mock_service.submit_for_prd.return_value = SubmitPRDResponse(
            gateId="gate-123",
            prdDraft=PRDDocument(
                id="prd-001",
                title="Test PRD",
                version="1.0.0",
                sections=[],
                createdAt=datetime.now(timezone.utc).isoformat(),
                status="pending_review",
            ),
            userStories=[
                UserStory(
                    id="US-001",
                    title="Test Story",
                    asA="user",
                    iWant="feature",
                    soThat="benefit",
                    acceptanceCriteria=["AC1"],
                    linkedRequirements=["REQ-001"],
                    priority="must_have",
                )
            ],
            status="pending_review",
        )

        response = client.post(
            "/api/studio/ideation/submit-prd",
            json={
                "sessionId": "session-123",
                "maturityState": sample_maturity_state.model_dump(),
                "includeUserStories": True,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Check camelCase in PRD
        assert "gateId" in data
        assert "prdDraft" in data
        assert "createdAt" in data["prdDraft"]

        # Check camelCase in user stories
        assert "userStories" in data
        assert "asA" in data["userStories"][0]
        assert "iWant" in data["userStories"][0]
        assert "soThat" in data["userStories"][0]
        assert "acceptanceCriteria" in data["userStories"][0]
        assert "linkedRequirements" in data["userStories"][0]


class TestListSessionsEndpoint:
    """Tests for GET /api/studio/ideation/sessions endpoint."""

    def test_list_sessions_returns_empty_list(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test list sessions returns empty list when no sessions exist."""
        mock_service.list_sessions.return_value = ([], 0)

        response = client.get("/api/studio/ideation/sessions")

        assert response.status_code == 200
        data = response.json()
        assert data["sessions"] == []
        assert data["total"] == 0
        assert data["limit"] == 20
        assert data["offset"] == 0

    def test_list_sessions_returns_sessions(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test list sessions returns session summaries."""
        mock_service.list_sessions.return_value = (
            [
                {
                    "id": "session-1",
                    "project_name": "Project A",
                    "status": "draft",
                    "created_at": "2024-01-15T10:00:00+00:00",
                    "updated_at": "2024-01-15T11:00:00+00:00",
                    "message_count": 5,
                    "maturity_score": 45.0,
                },
                {
                    "id": "session-2",
                    "project_name": "Project B",
                    "status": "approved",
                    "created_at": "2024-01-14T10:00:00+00:00",
                    "updated_at": "2024-01-14T12:00:00+00:00",
                    "message_count": 10,
                    "maturity_score": 85.0,
                },
            ],
            2,
        )

        response = client.get("/api/studio/ideation/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data["sessions"]) == 2
        assert data["total"] == 2
        assert data["sessions"][0]["id"] == "session-1"
        assert data["sessions"][0]["projectName"] == "Project A"
        assert data["sessions"][0]["messageCount"] == 5
        assert data["sessions"][0]["maturityScore"] == 45.0

    def test_list_sessions_with_user_id_filter(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test list sessions filters by user ID."""
        mock_service.list_sessions.return_value = ([], 0)

        response = client.get("/api/studio/ideation/sessions?user_id=user-123")

        assert response.status_code == 200
        mock_service.list_sessions.assert_called_once_with("user-123", 20, 0)

    def test_list_sessions_with_pagination(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test list sessions respects pagination parameters."""
        mock_service.list_sessions.return_value = ([], 0)

        response = client.get("/api/studio/ideation/sessions?limit=10&offset=5")

        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 10
        assert data["offset"] == 5
        mock_service.list_sessions.assert_called_once_with("anonymous", 10, 5)

    def test_list_sessions_service_error(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test list sessions handles service errors."""
        mock_service.list_sessions.side_effect = Exception("Database error")

        response = client.get("/api/studio/ideation/sessions")

        assert response.status_code == 500


class TestGetSessionEndpoint:
    """Tests for GET /api/studio/ideation/sessions/{session_id} endpoint."""

    def test_get_session_returns_full_details(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test get session returns full session details."""
        from src.core.models.ideation import (
            ChatMessage,
            MessageRole,
            MaturityCategory as DomainMaturityCategory,
            MaturityState as DomainMaturityState,
            ExtractedRequirement,
            RequirementType,
            RequirementPriority,
        )
        from datetime import datetime, timezone

        mock_messages = [
            ChatMessage(
                id="msg-1",
                session_id="session-123",
                role=MessageRole.USER,
                content="Hello",
                timestamp=datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
                maturity_delta=0,
            ),
            ChatMessage(
                id="msg-2",
                session_id="session-123",
                role=MessageRole.ASSISTANT,
                content="Hi there!",
                timestamp=datetime(2024, 1, 15, 10, 1, 0, tzinfo=timezone.utc),
                maturity_delta=5,
            ),
        ]

        mock_maturity = DomainMaturityState(
            session_id="session-123",
            score=45,
            level="defined",
            categories=[
                DomainMaturityCategory(
                    id="problem",
                    name="Problem Statement",
                    score=80,
                    required_for_submit=True,
                )
            ],
            can_submit=False,
            gaps=["Functional Requirements"],
        )

        mock_requirements = [
            ExtractedRequirement(
                id="req-1",
                session_id="session-123",
                description="User can upload files",
                type=RequirementType.FUNCTIONAL,
                priority=RequirementPriority.MUST_HAVE,
                category_id="functional",
                created_at=datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
            )
        ]

        mock_service.get_session.return_value = {
            "id": "session-123",
            "project_name": "Test Project",
            "status": "draft",
            "messages": mock_messages,
            "maturity": mock_maturity,
            "requirements": mock_requirements,
            "created_at": "2024-01-15T10:00:00+00:00",
            "updated_at": "2024-01-15T11:00:00+00:00",
        }

        response = client.get("/api/studio/ideation/sessions/session-123")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "session-123"
        assert data["projectName"] == "Test Project"
        assert len(data["messages"]) == 2
        assert data["messages"][0]["role"] == "user"
        assert data["maturityState"]["score"] == 45
        assert len(data["requirements"]) == 1
        assert data["requirements"][0]["type"] == "functional"

    def test_get_session_not_found(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test get session returns 404 for unknown session."""
        mock_service.get_session.return_value = None

        response = client.get("/api/studio/ideation/sessions/unknown-session")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_session_without_maturity(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test get session handles missing maturity state."""
        from src.core.models.ideation import ChatMessage, MessageRole
        from datetime import datetime, timezone

        mock_service.get_session.return_value = {
            "id": "session-123",
            "project_name": "Test Project",
            "status": "draft",
            "messages": [],
            "maturity": None,
            "requirements": [],
            "created_at": "2024-01-15T10:00:00+00:00",
            "updated_at": "2024-01-15T11:00:00+00:00",
        }

        response = client.get("/api/studio/ideation/sessions/session-123")

        assert response.status_code == 200
        data = response.json()
        assert data["maturityState"] is None

    def test_get_session_service_error(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test get session handles service errors."""
        mock_service.get_session.side_effect = Exception("Database error")

        response = client.get("/api/studio/ideation/sessions/session-123")

        assert response.status_code == 500
