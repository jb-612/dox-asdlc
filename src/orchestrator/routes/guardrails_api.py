"""Guardrails Configuration API endpoints.

Provides REST API endpoints for CRUD operations on guardrails guidelines,
context evaluation, audit log viewing, and bulk import/export (P11-F01).

Endpoints:
- GET /api/guardrails - List guidelines with optional filtering and pagination
- GET /api/guardrails/audit - View audit log entries
- GET /api/guardrails/export - Export guidelines as JSON
- POST /api/guardrails/evaluate - Evaluate context against guidelines
- POST /api/guardrails/import - Bulk import guidelines
- GET /api/guardrails/{guideline_id} - Get a single guideline by ID
- POST /api/guardrails - Create a new guideline
- PUT /api/guardrails/{guideline_id} - Update an existing guideline
- DELETE /api/guardrails/{guideline_id} - Delete a guideline
- POST /api/guardrails/{guideline_id}/toggle - Toggle guideline enabled state
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from fastapi.security import APIKeyHeader

from src.core.guardrails.exceptions import (
    GuardrailsError,
    GuidelineConflictError,
    GuidelineNotFoundError,
    GuidelineValidationError,
)
from src.core.guardrails.evaluator import GuardrailsEvaluator
from src.core.guardrails.models import (
    ActionType,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
    TaskContext,
)
from src.infrastructure.guardrails.guardrails_store import GuardrailsStore
from src.orchestrator.api.models.guardrails import (
    ActionTypeEnum,
    AuditLogEntry,
    AuditLogResponse,
    EvaluatedContextResponse,
    EvaluatedGuidelineResponse,
    GuidelineActionModel,
    GuidelineCategoryEnum,
    GuidelineConditionModel,
    GuidelineCreate,
    GuidelineResponse,
    GuidelineUpdate,
    GuidelinesListResponse,
    TaskContextRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/guardrails", tags=["guardrails"])

MAX_IMPORT_BATCH_SIZE = 100

# ---------------------------------------------------------------------------
# Optional API key authentication for write endpoints
# ---------------------------------------------------------------------------

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

GUARDRAILS_API_KEY = os.getenv("GUARDRAILS_API_KEY", "")


async def verify_api_key(
    api_key: str | None = Depends(_api_key_header),
) -> None:
    """Verify the API key for write operations.

    If ``GUARDRAILS_API_KEY`` is not set, authentication is disabled and all
    requests are allowed through.

    Raises:
        HTTPException: 401 if the key is required but missing or invalid.
    """
    if not GUARDRAILS_API_KEY:
        return  # Auth disabled when no key configured
    if not api_key or api_key != GUARDRAILS_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

# ---------------------------------------------------------------------------
# Lazy-init dependency for GuardrailsStore
# ---------------------------------------------------------------------------

_es_client = None
_store: Optional[GuardrailsStore] = None
_evaluator: Optional[GuardrailsEvaluator] = None
_store_lock = asyncio.Lock()


async def get_guardrails_store() -> GuardrailsStore:
    """Get or create the GuardrailsStore singleton.

    Loads configuration from environment via ``GuardrailsConfig.from_env()``
    so that ``GUARDRAILS_INDEX_PREFIX`` and ``ELASTICSEARCH_URL`` are
    respected.  Uses an asyncio lock to prevent duplicate initialization
    under concurrent requests.

    Returns:
        GuardrailsStore backed by AsyncElasticsearch.
    """
    global _es_client, _store
    if _store is not None:
        return _store
    async with _store_lock:
        if _store is not None:
            return _store
        from elasticsearch import AsyncElasticsearch

        from src.core.guardrails.config import GuardrailsConfig

        config = GuardrailsConfig.from_env()
        _es_client = AsyncElasticsearch([config.elasticsearch_url])
        _store = GuardrailsStore(
            es_client=_es_client,
            index_prefix=config.index_prefix,
        )
    return _store


async def get_guardrails_evaluator() -> GuardrailsEvaluator:
    """Get or create the GuardrailsEvaluator singleton.

    Uses the shared GuardrailsStore and cache TTL from configuration.

    Returns:
        GuardrailsEvaluator backed by the shared store.
    """
    global _evaluator
    if _evaluator is None:
        from src.core.guardrails.config import GuardrailsConfig

        store = await get_guardrails_store()
        config = GuardrailsConfig.from_env()
        _evaluator = GuardrailsEvaluator(store=store, cache_ttl=config.cache_ttl)
    return _evaluator


async def shutdown_guardrails_store() -> None:
    """Shut down the guardrails store singleton and release resources.

    Closes the underlying Elasticsearch client to prevent socket/file
    descriptor leaks.  Safe to call even if the store was never created.
    """
    global _es_client, _store, _evaluator
    if _store is not None:
        await _store.close()
        logger.info("Guardrails store shut down")
    _es_client = None
    _store = None
    _evaluator = None


# ---------------------------------------------------------------------------
# Helper: convert domain Guideline to Pydantic response model
# ---------------------------------------------------------------------------

def _guideline_to_response(guideline: Guideline) -> GuidelineResponse:
    """Convert a domain Guideline dataclass to a GuidelineResponse model.

    Args:
        guideline: The domain Guideline object.

    Returns:
        A GuidelineResponse Pydantic model.
    """
    d = guideline.to_dict()
    condition = GuidelineConditionModel(
        agents=d["condition"].get("agents"),
        domains=d["condition"].get("domains"),
        actions=d["condition"].get("actions"),
        paths=d["condition"].get("paths"),
        events=d["condition"].get("events"),
        gate_types=d["condition"].get("gate_types"),
    )
    action = GuidelineActionModel(
        action_type=ActionTypeEnum(d["action"]["type"]),
        instruction=d["action"].get("instruction"),
        tools_allowed=d["action"].get("tools_allowed"),
        tools_denied=d["action"].get("tools_denied"),
        gate_type=d["action"].get("gate_type"),
        gate_threshold=d["action"].get("gate_threshold"),
        max_files=d["action"].get("max_files"),
        require_tests=d["action"].get("require_tests"),
        require_review=d["action"].get("require_review"),
    )
    return GuidelineResponse(
        id=d["id"],
        name=d["name"],
        description=d["description"],
        category=d["category"],
        priority=d["priority"],
        enabled=d["enabled"],
        condition=condition,
        action=action,
        version=d["version"],
        created_at=d["created_at"],
        updated_at=d["updated_at"],
        created_by=d.get("created_by"),
    )


# ---------------------------------------------------------------------------
# Helper: map Pydantic category enum to domain category enum
# ---------------------------------------------------------------------------


def _resolve_category(
    api_category: Optional[GuidelineCategoryEnum],
) -> Optional[GuidelineCategory]:
    """Map a Pydantic GuidelineCategoryEnum to the domain GuidelineCategory.

    API enum values match domain enum values exactly, so this is a
    direct conversion.

    Args:
        api_category: The API-layer category enum value, or None.

    Returns:
        The corresponding domain GuidelineCategory, or None.
    """
    if api_category is None:
        return None
    return GuidelineCategory(api_category.value)


def _build_domain_guideline_from_create(
    body: GuidelineCreate,
) -> Guideline:
    """Build a domain Guideline from a GuidelineCreate request body.

    Generates a new UUID, sets version=1, and uses current UTC time
    for timestamps.  API enum values match domain enum values exactly,
    so conversion uses direct ``ActionType()`` / ``GuidelineCategory()``
    constructors.

    Args:
        body: The validated GuidelineCreate Pydantic model.

    Returns:
        A new domain Guideline instance ready for persistence.
    """
    now = datetime.now(timezone.utc)
    condition = GuidelineCondition(
        agents=body.condition.agents,
        domains=body.condition.domains,
        actions=body.condition.actions,
        paths=body.condition.paths,
        events=body.condition.events,
        gate_types=body.condition.gate_types,
    )
    action = GuidelineAction(
        type=ActionType(body.action.action_type.value),
        instruction=body.action.instruction,
        tools_allowed=body.action.tools_allowed,
        tools_denied=body.action.tools_denied,
        gate_type=body.action.gate_type,
        gate_threshold=body.action.gate_threshold,
        max_files=body.action.max_files,
        require_tests=body.action.require_tests,
        require_review=body.action.require_review,
    )
    return Guideline(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        enabled=body.enabled,
        category=GuidelineCategory(body.category.value),
        priority=body.priority,
        condition=condition,
        action=action,
        metadata={},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="api",
    )


def _apply_update_to_guideline(
    existing: Guideline,
    body: GuidelineUpdate,
) -> Guideline:
    """Apply partial updates from a GuidelineUpdate to an existing Guideline.

    Since Guideline is a frozen dataclass, this builds a new dict from
    the existing guideline, overrides non-None fields from the update
    body, and reconstructs via ``Guideline.from_dict()``.  API enum
    values match domain enum values exactly, so conversion uses the
    ``.value`` attribute directly.

    Args:
        existing: The current persisted guideline.
        body: The validated GuidelineUpdate Pydantic model.

    Returns:
        A new Guideline instance with applied changes but the
        *original* version (the store handles version increment).
    """
    data = existing.to_dict()

    if body.name is not None:
        data["name"] = body.name
    if body.description is not None:
        data["description"] = body.description
    if body.category is not None:
        data["category"] = body.category.value
    if body.priority is not None:
        data["priority"] = body.priority
    if body.enabled is not None:
        data["enabled"] = body.enabled
    if body.condition is not None:
        # Deep-merge: only overwrite fields explicitly provided
        existing_condition = dict(data.get("condition", {}))
        for k, v in body.condition.model_dump().items():
            if v is not None:
                existing_condition[k] = v
        data["condition"] = existing_condition
    if body.action is not None:
        # Deep-merge: start from existing action, override provided fields
        existing_action = dict(data.get("action", {}))
        existing_action["type"] = body.action.action_type.value
        if body.action.instruction is not None:
            existing_action["instruction"] = body.action.instruction
        if body.action.tools_allowed is not None:
            existing_action["tools_allowed"] = body.action.tools_allowed
        if body.action.tools_denied is not None:
            existing_action["tools_denied"] = body.action.tools_denied
        if body.action.gate_type is not None:
            existing_action["gate_type"] = body.action.gate_type
        if body.action.gate_threshold is not None:
            existing_action["gate_threshold"] = body.action.gate_threshold
        if body.action.max_files is not None:
            existing_action["max_files"] = body.action.max_files
        if body.action.require_tests is not None:
            existing_action["require_tests"] = body.action.require_tests
        if body.action.require_review is not None:
            existing_action["require_review"] = body.action.require_review
        data["action"] = existing_action

    # Keep version from the request body for optimistic locking
    data["version"] = body.version

    return Guideline.from_dict(data)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=GuidelinesListResponse)
async def list_guidelines(
    category: Optional[GuidelineCategoryEnum] = Query(
        None, description="Filter by guideline category"
    ),
    enabled: Optional[bool] = Query(
        None, description="Filter by enabled status"
    ),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(
        20, ge=1, le=100, description="Results per page (1-100)"
    ),
    store: GuardrailsStore = Depends(get_guardrails_store),
) -> GuidelinesListResponse:
    """List guardrails guidelines with optional filtering and pagination.

    Args:
        category: Optional category filter.
        enabled: Optional enabled-state filter.
        page: 1-based page number.
        page_size: Number of results per page.
        store: Injected GuardrailsStore dependency.

    Returns:
        GuidelinesListResponse with matching guidelines and total count.

    Raises:
        HTTPException: 503 if the store is unavailable.
    """
    try:
        domain_category = _resolve_category(category)
        guidelines, total = await store.list_guidelines(
            category=domain_category,
            enabled=enabled,
            page=page,
            page_size=page_size,
        )
        return GuidelinesListResponse(
            guidelines=[_guideline_to_response(g) for g in guidelines],
            total=total,
            page=page,
            page_size=page_size,
        )
    except GuidelineValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GuardrailsError as exc:
        logger.error("Error listing guidelines: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
        ) from exc


# ---------------------------------------------------------------------------
# Audit, Evaluate, Export, Import  (MUST be registered before /{guideline_id})
# ---------------------------------------------------------------------------


@router.get("/audit", response_model=AuditLogResponse)
async def list_audit_entries(
    guideline_id: Optional[str] = Query(
        None, description="Filter by guideline ID"
    ),
    event_type: Optional[str] = Query(
        None, description="Filter by event type"
    ),
    date_from: Optional[str] = Query(
        None, description="ISO date lower bound (inclusive)"
    ),
    date_to: Optional[str] = Query(
        None, description="ISO date upper bound (inclusive)"
    ),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(
        50, ge=1, le=200, description="Results per page (1-200)"
    ),
    store: GuardrailsStore = Depends(get_guardrails_store),
) -> AuditLogResponse:
    """List audit log entries with optional filtering and pagination.

    Args:
        guideline_id: Optional filter by guideline ID.
        event_type: Optional filter by event type string.
        date_from: Optional ISO date for lower bound (inclusive).
        date_to: Optional ISO date for upper bound (inclusive).
        page: 1-based page number.
        page_size: Number of results per page (max 200).
        store: Injected GuardrailsStore dependency.

    Returns:
        AuditLogResponse with matching entries and total count.

    Raises:
        HTTPException: 503 if the store is unavailable.
    """
    try:
        entries, total = await store.list_audit_entries(
            guideline_id=guideline_id,
            event_type=event_type,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
        return AuditLogResponse(
            entries=[
                AuditLogEntry(
                    id=e.get("id", ""),
                    event_type=e.get("event_type", ""),
                    guideline_id=e.get("guideline_id"),
                    timestamp=e.get("timestamp", ""),
                    decision=e.get("decision"),
                    context=e.get("context"),
                    changes=e.get("changes"),
                )
                for e in entries
            ],
            total=total,
        )
    except GuidelineValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GuardrailsError as exc:
        logger.error("Error listing audit entries: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
        ) from exc


@router.post("/evaluate", response_model=EvaluatedContextResponse)
async def evaluate_context(
    body: TaskContextRequest,
) -> EvaluatedContextResponse:
    """Evaluate a task context against all enabled guidelines.

    Creates a TaskContext from the request body, runs the evaluator,
    and returns aggregated results including matched guidelines,
    combined instructions, and tool/gate lists.

    Args:
        body: The validated TaskContextRequest with context fields.
        store: Injected GuardrailsStore dependency.

    Returns:
        EvaluatedContextResponse with matched guidelines and aggregations.

    Raises:
        HTTPException: 503 if the store or evaluator is unavailable.
    """
    try:
        task_context = TaskContext(
            agent=body.agent or "",
            domain=body.domain,
            action=body.action,
            paths=body.paths,
            event=body.event,
            gate_type=body.gate_type,
            session_id=body.session_id,
        )
        evaluator = await get_guardrails_evaluator()
        evaluated = await evaluator.get_context(task_context)
        return EvaluatedContextResponse(
            matched_count=len(evaluated.matched_guidelines),
            combined_instruction=evaluated.combined_instruction,
            tools_allowed=list(evaluated.tools_allowed),
            tools_denied=list(evaluated.tools_denied),
            hitl_gates=list(evaluated.hitl_gates),
            guidelines=[
                EvaluatedGuidelineResponse(
                    guideline_id=eg.guideline.id,
                    guideline_name=eg.guideline.name,
                    priority=eg.guideline.priority,
                    match_score=eg.match_score,
                    matched_fields=list(eg.matched_fields),
                )
                for eg in evaluated.matched_guidelines
            ],
        )
    except GuidelineValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GuardrailsError as exc:
        logger.error("Error evaluating context: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
        ) from exc


@router.get("/export", response_model=list[GuidelineResponse])
async def export_guidelines(
    category: Optional[GuidelineCategoryEnum] = Query(
        None, description="Filter by guideline category"
    ),
    store: GuardrailsStore = Depends(get_guardrails_store),
) -> list[GuidelineResponse]:
    """Export guidelines as a JSON array.

    Fetches all guidelines (up to 10000) with an optional category
    filter and returns them as a flat list.

    Args:
        category: Optional category filter.
        store: Injected GuardrailsStore dependency.

    Returns:
        A list of GuidelineResponse models.

    Raises:
        HTTPException: 503 if the store is unavailable.
    """
    try:
        domain_category = _resolve_category(category)
        guidelines, _ = await store.list_guidelines(
            category=domain_category,
            page=1,
            page_size=10000,
        )
        return [_guideline_to_response(g) for g in guidelines]
    except GuardrailsError as exc:
        logger.error("Error exporting guidelines: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
        ) from exc


@router.post("/import")
async def import_guidelines(
    body: list[GuidelineCreate],
    store: GuardrailsStore = Depends(get_guardrails_store),
    _key: None = Depends(verify_api_key),
) -> dict[str, Any]:
    """Bulk import guidelines from a JSON array.

    For each item in the request body, creates a domain Guideline and
    persists it.  Individual failures are captured and returned in the
    ``errors`` list without aborting the entire import.

    Args:
        body: A list of GuidelineCreate Pydantic models.
        store: Injected GuardrailsStore dependency.

    Returns:
        A dict with ``imported`` count and ``errors`` list.

    Raises:
        HTTPException: 503 if a catastrophic error prevents processing.
    """
    if len(body) > MAX_IMPORT_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Import batch too large: {len(body)} items (max {MAX_IMPORT_BATCH_SIZE})",
        )
    imported = 0
    errors: list[str] = []
    try:
        for item in body:
            try:
                guideline = _build_domain_guideline_from_create(item)
                await store.create_guideline(guideline)
                await store.log_audit_entry({
                    "event_type": "guideline_imported",
                    "guideline_id": guideline.id,
                    "changes": {"name": guideline.name},
                })
                imported += 1
            except GuardrailsError as item_exc:
                errors.append(
                    f"Failed to import '{item.name}': {item_exc}"
                )
    except Exception as exc:
        logger.error("Error importing guidelines: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
        ) from exc
    return {"imported": imported, "errors": errors}


# ---------------------------------------------------------------------------
# Dynamic-path endpoints (MUST come after static routes like /audit, /export)
# ---------------------------------------------------------------------------


@router.get("/{guideline_id}", response_model=GuidelineResponse)
async def get_guideline(
    guideline_id: str,
    store: GuardrailsStore = Depends(get_guardrails_store),
) -> GuidelineResponse:
    """Get a single guideline by ID.

    Args:
        guideline_id: The unique identifier of the guideline.
        store: Injected GuardrailsStore dependency.

    Returns:
        GuidelineResponse for the matching guideline.

    Raises:
        HTTPException: 404 if the guideline is not found.
        HTTPException: 503 if the store is unavailable.
    """
    try:
        guideline = await store.get_guideline(guideline_id)
        return _guideline_to_response(guideline)
    except GuidelineNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Guideline not found: {guideline_id}",
        )
    except GuardrailsError as exc:
        logger.error("Error getting guideline %s: %s", guideline_id, exc)
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
        ) from exc


@router.post("", response_model=GuidelineResponse, status_code=201)
async def create_guideline(
    body: GuidelineCreate,
    store: GuardrailsStore = Depends(get_guardrails_store),
    _key: None = Depends(verify_api_key),
) -> GuidelineResponse:
    """Create a new guardrails guideline.

    Args:
        body: The validated GuidelineCreate request body.
        store: Injected GuardrailsStore dependency.

    Returns:
        GuidelineResponse for the newly created guideline.

    Raises:
        HTTPException: 503 if the store is unavailable.
    """
    try:
        guideline = _build_domain_guideline_from_create(body)
        created = await store.create_guideline(guideline)
        await store.log_audit_entry({
            "event_type": "guideline_created",
            "guideline_id": created.id,
            "changes": {"name": created.name},
        })
        return _guideline_to_response(created)
    except GuidelineValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GuardrailsError as exc:
        logger.error("Error creating guideline: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
        ) from exc


@router.put("/{guideline_id}", response_model=GuidelineResponse)
async def update_guideline(
    guideline_id: str,
    body: GuidelineUpdate,
    store: GuardrailsStore = Depends(get_guardrails_store),
    _key: None = Depends(verify_api_key),
) -> GuidelineResponse:
    """Update an existing guardrails guideline.

    Uses optimistic locking: the ``version`` field in the request body
    must match the version currently stored.

    Args:
        guideline_id: The unique identifier of the guideline.
        body: The validated GuidelineUpdate request body (version required).
        store: Injected GuardrailsStore dependency.

    Returns:
        GuidelineResponse for the updated guideline.

    Raises:
        HTTPException: 404 if the guideline is not found.
        HTTPException: 409 if there is a version conflict.
        HTTPException: 503 if the store is unavailable.
    """
    try:
        existing = await store.get_guideline(guideline_id)
        updated_guideline = _apply_update_to_guideline(existing, body)
        result = await store.update_guideline(updated_guideline)
        await store.log_audit_entry({
            "event_type": "guideline_updated",
            "guideline_id": guideline_id,
        })
        return _guideline_to_response(result)
    except GuidelineNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Guideline not found: {guideline_id}",
        )
    except GuidelineConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )
    except GuardrailsError as exc:
        logger.error(
            "Error updating guideline %s: %s", guideline_id, exc
        )
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
        ) from exc


@router.delete("/{guideline_id}", status_code=204)
async def delete_guideline(
    guideline_id: str,
    store: GuardrailsStore = Depends(get_guardrails_store),
    _key: None = Depends(verify_api_key),
) -> Response:
    """Delete a guardrails guideline.

    Args:
        guideline_id: The unique identifier of the guideline.
        store: Injected GuardrailsStore dependency.

    Returns:
        204 No Content on success.

    Raises:
        HTTPException: 404 if the guideline is not found.
        HTTPException: 503 if the store is unavailable.
    """
    try:
        await store.delete_guideline(guideline_id)
        await store.log_audit_entry({
            "event_type": "guideline_deleted",
            "guideline_id": guideline_id,
        })
        return Response(status_code=204)
    except GuidelineNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Guideline not found: {guideline_id}",
        )
    except GuardrailsError as exc:
        logger.error(
            "Error deleting guideline %s: %s", guideline_id, exc
        )
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
        ) from exc


@router.post(
    "/{guideline_id}/toggle", response_model=GuidelineResponse
)
async def toggle_guideline(
    guideline_id: str,
    store: GuardrailsStore = Depends(get_guardrails_store),
    _key: None = Depends(verify_api_key),
) -> GuidelineResponse:
    """Toggle the enabled state of a guideline.

    Fetches the current guideline, flips the ``enabled`` flag, and
    persists the update.

    Args:
        guideline_id: The unique identifier of the guideline.
        store: Injected GuardrailsStore dependency.

    Returns:
        GuidelineResponse with the toggled enabled state.

    Raises:
        HTTPException: 404 if the guideline is not found.
        HTTPException: 409 if there is a version conflict.
        HTTPException: 503 if the store is unavailable.
    """
    try:
        existing = await store.get_guideline(guideline_id)
        # Build toggled guideline via dict round-trip (frozen dataclass)
        data = existing.to_dict()
        data["enabled"] = not existing.enabled
        toggled = Guideline.from_dict(data)
        result = await store.update_guideline(toggled)
        await store.log_audit_entry({
            "event_type": "guideline_toggled",
            "guideline_id": guideline_id,
            "changes": {"enabled": result.enabled},
        })
        return _guideline_to_response(result)
    except GuidelineNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Guideline not found: {guideline_id}",
        )
    except GuidelineConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )
    except GuardrailsError as exc:
        logger.error(
            "Error toggling guideline %s: %s", guideline_id, exc
        )
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable",
        ) from exc
