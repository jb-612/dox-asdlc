"""Classification API routes.

This module provides REST endpoints for idea classification, including
single idea classification, batch processing, and job status tracking.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.orchestrator.api.models.classification import (
    BatchClassificationRequest,
    ClassificationResult,
    LabelDefinition,
    LabelTaxonomy,
)
from src.orchestrator.api.models.idea import Idea, UpdateIdeaRequest


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ideas", tags=["classification"])
admin_router = APIRouter(prefix="/api/admin/labels", tags=["classification-admin"])


# Request/Response models for the API
class BatchJobResponse(BaseModel):
    """Response for batch classification job creation."""

    job_id: str
    status: str = "queued"
    total: int


class JobStatusResponse(BaseModel):
    """Response for job status check."""

    job_id: str
    status: str
    total: int
    completed: int
    failed: int
    results: list[dict[str, Any]] = Field(default_factory=list)
    errors: list[dict[str, Any]] = Field(default_factory=list)


class AddLabelsRequest(BaseModel):
    """Request to add labels to an idea."""

    labels: list[str]


# Dependency injection helpers
def get_classification_service():
    """Get the classification service instance."""
    from src.orchestrator.services.classification_service import (
        get_classification_service as _get_service,
    )

    return _get_service()


def get_classification_worker():
    """Get the classification worker instance."""
    from src.workers.classification_worker import ClassificationWorker

    import os
    import redis.asyncio as redis

    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        redis_host = os.environ.get("REDIS_HOST", "localhost")
        redis_port = os.environ.get("REDIS_PORT", "6379")
        redis_url = f"redis://{redis_host}:{redis_port}"

    redis_client = redis.from_url(redis_url)
    service = get_classification_service()

    return ClassificationWorker(
        redis_client=redis_client,
        classification_service=service,
    )


def get_ideas_service():
    """Get the ideas service instance."""
    from src.orchestrator.services.ideas_service import get_ideas_service as _get_service

    return _get_service()


def get_label_taxonomy_service():
    """Get the label taxonomy service instance."""
    from src.orchestrator.services.label_taxonomy_service import (
        get_label_taxonomy_service as _get_service,
    )

    return _get_service()


# Endpoints


@router.post("/{idea_id}/classify", response_model=ClassificationResult)
async def classify_idea(
    idea_id: str,
    force: bool = Query(default=False, description="Force reclassification"),
) -> ClassificationResult:
    """Classify a single idea.

    Args:
        idea_id: The ID of the idea to classify.
        force: If True, reclassify even if already classified.

    Returns:
        ClassificationResult: The classification result.

    Raises:
        HTTPException: 404 if idea not found.
    """
    service = get_classification_service()

    try:
        result = await service.classify_idea(idea_id, force=force)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/classify/batch", response_model=BatchJobResponse, status_code=202)
async def batch_classify(
    request: BatchClassificationRequest,
    force: bool = Query(default=False, description="Force reclassification"),
) -> BatchJobResponse:
    """Queue multiple ideas for classification.

    Args:
        request: Batch classification request with idea IDs.
        force: If True, reclassify even if already classified.

    Returns:
        BatchJobResponse: Job ID and status.

    Raises:
        HTTPException: 400 if idea_ids list is empty.
    """
    if not request.idea_ids:
        raise HTTPException(status_code=400, detail="idea_ids list cannot be empty")

    worker = get_classification_worker()
    job_id = await worker.enqueue_batch(request.idea_ids, force=force)

    return BatchJobResponse(
        job_id=job_id,
        status="queued",
        total=len(request.idea_ids),
    )


@router.get("/classify/job/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str) -> JobStatusResponse:
    """Get the status of a batch classification job.

    Args:
        job_id: The ID of the job to check.

    Returns:
        JobStatusResponse: Job status and results.

    Raises:
        HTTPException: 404 if job not found.
    """
    worker = get_classification_worker()
    status = await worker.get_job_status(job_id)

    if status is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    return JobStatusResponse(
        job_id=status["job_id"],
        status=status["status"],
        total=status["total"],
        completed=status["completed"],
        failed=status.get("failed", 0),
        results=status.get("results", []),
        errors=status.get("errors", []),
    )


@router.post("/{idea_id}/labels", response_model=Idea)
async def add_labels(idea_id: str, request: AddLabelsRequest) -> Idea:
    """Add labels to an idea.

    Args:
        idea_id: The ID of the idea.
        request: Labels to add.

    Returns:
        Idea: Updated idea with new labels.

    Raises:
        HTTPException: 404 if idea not found.
    """
    service = get_ideas_service()

    idea = await service.get_idea(idea_id)
    if idea is None:
        raise HTTPException(status_code=404, detail=f"Idea not found: {idea_id}")

    # Merge new labels with existing
    new_labels = list(set(idea.labels + request.labels))

    update_request = UpdateIdeaRequest(labels=new_labels)
    updated_idea = await service.update_idea(idea_id, update_request)

    if updated_idea is None:
        raise HTTPException(status_code=404, detail=f"Idea not found: {idea_id}")

    return updated_idea


@router.delete("/{idea_id}/labels/{label}", response_model=Idea)
async def remove_label(idea_id: str, label: str) -> Idea:
    """Remove a label from an idea.

    Args:
        idea_id: The ID of the idea.
        label: The label to remove.

    Returns:
        Idea: Updated idea with label removed.

    Raises:
        HTTPException: 404 if idea not found.
    """
    service = get_ideas_service()

    idea = await service.get_idea(idea_id)
    if idea is None:
        raise HTTPException(status_code=404, detail=f"Idea not found: {idea_id}")

    # Remove the label
    new_labels = [l for l in idea.labels if l != label]

    update_request = UpdateIdeaRequest(labels=new_labels)
    updated_idea = await service.update_idea(idea_id, update_request)

    if updated_idea is None:
        raise HTTPException(status_code=404, detail=f"Idea not found: {idea_id}")

    return updated_idea


# Taxonomy Admin Endpoints


@admin_router.get("/taxonomy", response_model=LabelTaxonomy)
async def get_taxonomy() -> LabelTaxonomy:
    """Get the current label taxonomy.

    Returns:
        LabelTaxonomy: The current taxonomy with all labels.
    """
    service = get_label_taxonomy_service()
    return await service.get_taxonomy()


@admin_router.put("/taxonomy", response_model=LabelTaxonomy)
async def update_taxonomy(taxonomy: LabelTaxonomy) -> LabelTaxonomy:
    """Update the entire label taxonomy.

    Args:
        taxonomy: The new taxonomy to store.

    Returns:
        LabelTaxonomy: The updated taxonomy.
    """
    service = get_label_taxonomy_service()
    return await service.update_taxonomy(taxonomy)


@admin_router.post("/taxonomy/labels", response_model=LabelTaxonomy, status_code=201)
async def add_label(label: LabelDefinition) -> LabelTaxonomy:
    """Add a new label to the taxonomy.

    Args:
        label: The label definition to add.

    Returns:
        LabelTaxonomy: The updated taxonomy with the new label.

    Raises:
        HTTPException: 409 if a label with the same ID already exists.
    """
    service = get_label_taxonomy_service()

    try:
        return await service.add_label(label)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@admin_router.put("/taxonomy/labels/{label_id}", response_model=LabelTaxonomy)
async def update_label(label_id: str, label: LabelDefinition) -> LabelTaxonomy:
    """Update an existing label in the taxonomy.

    Args:
        label_id: The ID of the label to update.
        label: The new label definition.

    Returns:
        LabelTaxonomy: The updated taxonomy.

    Raises:
        HTTPException: 404 if the label is not found.
    """
    service = get_label_taxonomy_service()

    try:
        return await service.update_label(label_id, label)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@admin_router.delete("/taxonomy/labels/{label_id}", response_model=LabelTaxonomy)
async def delete_label(label_id: str) -> LabelTaxonomy:
    """Delete a label from the taxonomy.

    Args:
        label_id: The ID of the label to delete.

    Returns:
        LabelTaxonomy: The updated taxonomy without the deleted label.

    Raises:
        HTTPException: 404 if the label is not found.
    """
    service = get_label_taxonomy_service()

    try:
        return await service.delete_label(label_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
