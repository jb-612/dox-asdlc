"""Ideation API routes for PRD Ideation Studio.

This module provides API endpoints for the PRD Ideation Studio (P05-F11):
- POST /api/studio/ideation/chat - Process chat messages
- POST /api/studio/ideation/submit-prd - Submit for PRD generation
- GET /api/studio/ideation/{sessionId}/maturity - Get session maturity
- POST /api/studio/ideation/{sessionId}/draft - Save session draft
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/studio/ideation", tags=["ideation"])


# =============================================================================
# Request/Response Models
# =============================================================================


class SectionMaturity(BaseModel):
    """Section maturity within a category."""

    id: str
    name: str
    score: float


class CategoryMaturity(BaseModel):
    """Category maturity state."""

    id: str
    name: str
    score: float
    requiredForSubmit: bool
    sections: list[SectionMaturity] = []


class MaturityState(BaseModel):
    """Overall maturity state."""

    score: float
    level: str
    categories: list[CategoryMaturity]
    canSubmit: bool
    gaps: list[str] = []


class Requirement(BaseModel):
    """Extracted requirement."""

    id: str
    description: str
    type: str  # functional, non_functional, constraint
    priority: str  # must_have, should_have, could_have
    categoryId: str
    sourceMessageId: str | None = None
    createdAt: str


class IdeationMessage(BaseModel):
    """Message in ideation chat."""

    id: str
    role: str  # user, assistant, system
    content: str
    timestamp: str
    maturityDelta: float | None = None
    extractedRequirements: list[Requirement] = []
    suggestedFollowups: list[str] = []


class IdeationChatRequest(BaseModel):
    """Request for ideation chat."""

    sessionId: str
    message: str
    currentMaturity: float
    model: str | None = None  # sonnet, opus, haiku
    rlmEnabled: bool | None = None

    model_config = {"populate_by_name": True}


class IdeationChatResponse(BaseModel):
    """Response from ideation chat."""

    message: IdeationMessage
    maturityUpdate: MaturityState
    extractedRequirements: list[Requirement]
    suggestedFollowups: list[str]

    model_config = {"populate_by_name": True}


class PRDSection(BaseModel):
    """Section in a PRD document."""

    id: str
    heading: str
    content: str
    order: int


class PRDDocument(BaseModel):
    """PRD document structure."""

    id: str
    title: str
    version: str
    sections: list[PRDSection]
    createdAt: str
    status: str  # draft, pending_review, approved

    model_config = {"populate_by_name": True}


class UserStory(BaseModel):
    """User story."""

    id: str
    title: str
    asA: str
    iWant: str
    soThat: str
    acceptanceCriteria: list[str]
    linkedRequirements: list[str]
    priority: str  # must_have, should_have, could_have

    model_config = {"populate_by_name": True}


class SubmitPRDRequest(BaseModel):
    """Request to submit for PRD generation."""

    sessionId: str
    maturityState: MaturityState
    includeUserStories: bool = True

    model_config = {"populate_by_name": True}


class SubmitPRDResponse(BaseModel):
    """Response from PRD submission."""

    gateId: str
    prdDraft: PRDDocument
    userStories: list[UserStory]
    status: str

    model_config = {"populate_by_name": True}


class SaveDraftRequest(BaseModel):
    """Request to save session draft."""

    messages: list[IdeationMessage]
    maturityState: MaturityState
    extractedRequirements: list[Requirement]

    model_config = {"populate_by_name": True}


class SaveDraftResponse(BaseModel):
    """Response from save draft."""

    success: bool
    sessionId: str
    savedAt: str

    model_config = {"populate_by_name": True}


# =============================================================================
# Service Interface
# =============================================================================


class IdeationService:
    """Service interface for ideation operations.

    Note: Current implementation uses mock responses. The actual service
    implementation will integrate with IdeationAgent, PRDGenerator, and
    UserStoryExtractor from src/workers/agents/ideation/.

    TODO: Implement real service layer connecting to worker agents.

    The service provides:
    - Chat processing with maturity tracking
    - PRD document generation
    - Session maturity retrieval
    - Draft persistence
    """

    async def process_chat(
        self,
        request: IdeationChatRequest,
        model: str | None = None,
    ) -> IdeationChatResponse:
        """Process chat message and return response with maturity update.

        Args:
            request: Chat request.
            model: Optional model override.

        Returns:
            IdeationChatResponse: Response with maturity update.
        """
        # This will be implemented to use IdeationAgent
        raise NotImplementedError("IdeationService.process_chat not implemented")

    async def submit_for_prd(
        self,
        request: SubmitPRDRequest,
    ) -> SubmitPRDResponse:
        """Submit ideation session for PRD generation.

        Args:
            request: PRD submission request.

        Returns:
            SubmitPRDResponse: Response with PRD draft and user stories.
        """
        # This will be implemented to use PRDGenerator and UserStoryExtractor
        raise NotImplementedError("IdeationService.submit_for_prd not implemented")

    async def get_session_maturity(
        self,
        session_id: str,
    ) -> MaturityState | None:
        """Get current maturity state for a session.

        Args:
            session_id: Session identifier.

        Returns:
            MaturityState | None: Current maturity or None if not found.
        """
        # This will be implemented to retrieve from session storage
        raise NotImplementedError("IdeationService.get_session_maturity not implemented")

    async def save_draft(
        self,
        session_id: str,
        request: SaveDraftRequest,
    ) -> SaveDraftResponse:
        """Save session draft.

        Args:
            session_id: Session identifier.
            request: Draft data to save.

        Returns:
            SaveDraftResponse: Response confirming save.
        """
        # This will be implemented to persist to session storage
        raise NotImplementedError("IdeationService.save_draft not implemented")


# Global service instance (will be replaced with DI)
_ideation_service: IdeationService | None = None


def get_ideation_service() -> IdeationService:
    """Get the ideation service instance.

    Returns:
        IdeationService: Service instance.
    """
    global _ideation_service
    if _ideation_service is None:
        _ideation_service = IdeationService()
    return _ideation_service


# =============================================================================
# API Endpoints
# =============================================================================


@router.post("/chat", response_model=IdeationChatResponse)
async def process_chat(
    request: IdeationChatRequest,
    service: IdeationService = Depends(get_ideation_service),
) -> IdeationChatResponse:
    """Process ideation chat message.

    Sends the user message to the IdeationAgent and returns the response
    along with updated maturity scores and extracted requirements.

    Args:
        request: Chat request with message and context.
        service: Ideation service instance.

    Returns:
        IdeationChatResponse: Agent response with maturity update.

    Raises:
        HTTPException: 400 if message is empty or whitespace-only.
        HTTPException: 400 if session_id format is invalid.
        HTTPException: 500 on service error.
    """
    # Validate message is not empty or whitespace-only
    if not request.message or not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty",
        )

    # Validate session_id format (non-empty, alphanumeric with hyphens/underscores)
    if not request.sessionId or not request.sessionId.strip():
        raise HTTPException(
            status_code=400,
            detail="Session ID cannot be empty",
        )

    try:
        return await service.process_chat(
            request,
            model=request.model,
        )
    except NotImplementedError:
        # Return mock response for development
        return _mock_chat_response(request)
    except Exception as e:
        logger.error(f"Chat processing failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process chat: {str(e)}",
        ) from e


@router.post("/submit-prd", response_model=SubmitPRDResponse)
async def submit_prd(
    request: SubmitPRDRequest,
    service: IdeationService = Depends(get_ideation_service),
) -> SubmitPRDResponse:
    """Submit ideation session for PRD generation.

    Triggers PRD generation from the ideation session if maturity
    threshold is met. Creates a HITL gate for review.

    Args:
        request: PRD submission request.
        service: Ideation service instance.

    Returns:
        SubmitPRDResponse: PRD draft and user stories.

    Raises:
        HTTPException: 400 if maturity below threshold.
        HTTPException: 500 on service error.
    """
    # Check maturity threshold
    if not request.maturityState.canSubmit or request.maturityState.score < 80:
        raise HTTPException(
            status_code=400,
            detail=f"Maturity score {request.maturityState.score}% is below the 80% threshold required for PRD submission",
        )

    try:
        return await service.submit_for_prd(request)
    except NotImplementedError:
        # Return mock response for development
        return _mock_submit_response(request)
    except Exception as e:
        logger.error(f"PRD submission failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit PRD: {str(e)}",
        ) from e


@router.get("/{session_id}/maturity", response_model=MaturityState)
async def get_maturity(
    session_id: str = Path(..., description="Session ID"),
    service: IdeationService = Depends(get_ideation_service),
) -> MaturityState:
    """Get current maturity state for a session.

    Args:
        session_id: Session identifier.
        service: Ideation service instance.

    Returns:
        MaturityState: Current maturity state.

    Raises:
        HTTPException: 404 if session not found.
    """
    try:
        maturity = await service.get_session_maturity(session_id)
        if maturity is None:
            raise HTTPException(
                status_code=404,
                detail=f"Session {session_id} not found",
            )
        return maturity
    except NotImplementedError:
        # Return mock response for development
        return _mock_maturity_state()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get maturity failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get maturity: {str(e)}",
        ) from e


@router.post("/{session_id}/draft", response_model=SaveDraftResponse)
async def save_draft(
    request: SaveDraftRequest,
    session_id: str = Path(..., description="Session ID"),
    service: IdeationService = Depends(get_ideation_service),
) -> SaveDraftResponse:
    """Save ideation session draft.

    Persists the current session state for later resumption.

    Args:
        request: Draft data to save.
        session_id: Session identifier.
        service: Ideation service instance.

    Returns:
        SaveDraftResponse: Confirmation of save.

    Raises:
        HTTPException: 500 on service error.
    """
    try:
        return await service.save_draft(session_id, request)
    except NotImplementedError:
        # Return mock response for development
        return SaveDraftResponse(
            success=True,
            sessionId=session_id,
            savedAt=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        logger.error(f"Save draft failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save draft: {str(e)}",
        ) from e


# =============================================================================
# Mock Responses for Development
# =============================================================================


def _mock_maturity_state() -> MaturityState:
    """Create mock maturity state for development."""
    return MaturityState(
        score=45.0,
        level="defined",
        categories=[
            CategoryMaturity(
                id="problem",
                name="Problem Statement",
                score=80.0,
                requiredForSubmit=True,
            ),
            CategoryMaturity(
                id="users",
                name="Target Users",
                score=60.0,
                requiredForSubmit=True,
            ),
            CategoryMaturity(
                id="functional",
                name="Functional Requirements",
                score=30.0,
                requiredForSubmit=True,
            ),
            CategoryMaturity(
                id="nfr",
                name="Non-Functional Requirements",
                score=20.0,
                requiredForSubmit=True,
            ),
            CategoryMaturity(
                id="scope",
                name="Scope & Constraints",
                score=50.0,
                requiredForSubmit=True,
            ),
            CategoryMaturity(
                id="success",
                name="Success Criteria",
                score=40.0,
                requiredForSubmit=True,
            ),
            CategoryMaturity(
                id="risks",
                name="Risks & Assumptions",
                score=25.0,
                requiredForSubmit=True,
            ),
        ],
        canSubmit=False,
        gaps=["Functional Requirements", "Non-Functional Requirements", "Risks & Assumptions"],
    )


def _mock_chat_response(request: IdeationChatRequest) -> IdeationChatResponse:
    """Create mock chat response for development."""
    now = datetime.now(timezone.utc).isoformat()

    return IdeationChatResponse(
        message=IdeationMessage(
            id=f"msg-{now}",
            role="assistant",
            content="Thank you for sharing that. Let me ask some follow-up questions to better understand your requirements.",
            timestamp=now,
            maturityDelta=5.0,
            extractedRequirements=[],
            suggestedFollowups=[
                "What are the main user roles in this system?",
                "What are the most critical features?",
            ],
        ),
        maturityUpdate=_mock_maturity_state(),
        extractedRequirements=[],
        suggestedFollowups=[
            "What are the main user roles in this system?",
            "What are the most critical features?",
        ],
    )


def _mock_submit_response(request: SubmitPRDRequest) -> SubmitPRDResponse:
    """Create mock submit response for development."""
    now = datetime.now(timezone.utc).isoformat()

    return SubmitPRDResponse(
        gateId=f"gate-{request.sessionId}",
        prdDraft=PRDDocument(
            id=f"prd-{request.sessionId}",
            title="Generated PRD",
            version="1.0.0",
            sections=[
                PRDSection(
                    id="sec-001",
                    heading="Overview",
                    content="This PRD outlines the requirements for the system.",
                    order=1,
                ),
                PRDSection(
                    id="sec-002",
                    heading="Functional Requirements",
                    content="The system shall provide the following functionality...",
                    order=2,
                ),
            ],
            createdAt=now,
            status="pending_review",
        ),
        userStories=[
            UserStory(
                id="US-001",
                title="Sample User Story",
                asA="user",
                iWant="to perform an action",
                soThat="I can achieve a goal",
                acceptanceCriteria=["Criterion 1", "Criterion 2"],
                linkedRequirements=["REQ-001"],
                priority="must_have",
            ),
        ],
        status="pending_review",
    )
