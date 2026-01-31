"""Pydantic models for Correlations API (Brainflare Hub).

This module defines the data models for managing correlations between ideas,
including correlation types, edge data, and graph visualization structures.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class CorrelationType(str, Enum):
    """Type of correlation between ideas.

    Attributes:
        SIMILAR: Semantically similar content.
        RELATED: General relationship between ideas.
        CONTRADICTS: Opposing or conflicting ideas.
    """

    SIMILAR = "similar"
    RELATED = "related"
    CONTRADICTS = "contradicts"


class IdeaCorrelation(BaseModel):
    """Correlation between two ideas.

    Represents an edge in the ideas graph, connecting two ideas
    with a specific relationship type.

    Attributes:
        id: Unique correlation identifier.
        source_idea_id: ID of the source idea.
        target_idea_id: ID of the target idea.
        correlation_type: Type of relationship.
        created_by: User ID or "system" for auto-generated.
        notes: Optional notes about the correlation.
        created_at: When the correlation was created.
    """

    id: str
    source_idea_id: str
    target_idea_id: str
    correlation_type: CorrelationType
    created_by: str  # user_id or "system"
    notes: str | None = None
    created_at: datetime

    model_config = {"populate_by_name": True}


class CreateCorrelationRequest(BaseModel):
    """Request to create a correlation between two ideas.

    Attributes:
        source_idea_id: ID of the source idea.
        target_idea_id: ID of the target idea.
        correlation_type: Type of relationship (defaults to RELATED).
        notes: Optional notes about the correlation.
    """

    source_idea_id: str
    target_idea_id: str
    correlation_type: CorrelationType = CorrelationType.RELATED
    notes: str | None = None

    model_config = {"populate_by_name": True}


class GraphNode(BaseModel):
    """Node for graph visualization.

    Represents an idea as a node in the correlation graph.

    Attributes:
        id: Idea ID (used as node ID).
        label: Display label (truncated idea content).
        classification: Idea classification type.
        labels: List of tags/labels on the idea.
        degree: Number of edges connected to this node.
    """

    id: str
    label: str
    classification: str | None = None
    labels: list[str] = Field(default_factory=list)
    degree: int = 0

    model_config = {"populate_by_name": True}


class GraphEdge(BaseModel):
    """Edge for graph visualization.

    Represents a correlation as an edge in the graph.

    Attributes:
        id: Correlation ID (used as edge ID).
        source: Source node ID.
        target: Target node ID.
        correlation_type: Type of correlation.
    """

    id: str
    source: str
    target: str
    correlation_type: CorrelationType

    model_config = {"populate_by_name": True}


class GraphResponse(BaseModel):
    """Response with graph data for visualization.

    Contains all nodes and edges for rendering the correlation graph.

    Attributes:
        nodes: List of graph nodes (ideas).
        edges: List of graph edges (correlations).
    """

    nodes: list[GraphNode]
    edges: list[GraphEdge]

    model_config = {"populate_by_name": True}
