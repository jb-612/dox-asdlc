"""Kubernetes cluster API routes.

This module provides API endpoints for K8s cluster health, nodes, and pods.

Endpoints:
- GET /api/k8s/health - Cluster health overview
- GET /api/k8s/nodes - List cluster nodes
- GET /api/k8s/pods - List pods with filtering and pagination
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from src.orchestrator.api.models.k8s import (
    ClusterHealthResponse,
    K8sNodesResponse,
    K8sPodsResponse,
    PodStatus,
)
from src.orchestrator.services.k8s_cluster import K8sClusterService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/k8s", tags=["k8s"])

# Service singleton
_k8s_service: Optional[K8sClusterService] = None


def get_k8s_service() -> K8sClusterService:
    """Get or create the K8sClusterService singleton.

    Returns:
        K8sClusterService instance.
    """
    global _k8s_service
    if _k8s_service is None:
        _k8s_service = K8sClusterService()
    return _k8s_service


@router.get("/health", response_model=ClusterHealthResponse)
def get_cluster_health() -> ClusterHealthResponse:
    """Get cluster health overview.

    Returns:
        ClusterHealthResponse with health metrics and mock_mode flag.

    Raises:
        HTTPException: If an error occurs fetching cluster health.
    """
    try:
        service = get_k8s_service()
        health = service.get_cluster_health()
        return ClusterHealthResponse(
            health=health,
            mock_mode=service.mock_mode,
        )
    except Exception as e:
        logger.error(f"Error fetching cluster health: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching cluster health: {e}")


@router.get("/nodes", response_model=K8sNodesResponse)
def get_nodes() -> K8sNodesResponse:
    """Get list of cluster nodes.

    Returns:
        K8sNodesResponse with list of nodes and total count.

    Raises:
        HTTPException: If an error occurs fetching nodes.
    """
    try:
        service = get_k8s_service()
        nodes = service.get_nodes()
        return K8sNodesResponse(
            nodes=nodes,
            total=len(nodes),
        )
    except Exception as e:
        logger.error(f"Error fetching nodes: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching nodes: {e}")


@router.get("/pods", response_model=K8sPodsResponse)
def get_pods(
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    status: Optional[PodStatus] = Query(None, description="Filter by pod status"),
    nodeName: Optional[str] = Query(None, description="Filter by node name"),
    search: Optional[str] = Query(None, description="Search term for pod name"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of pods to return"),
    offset: int = Query(0, ge=0, description="Number of pods to skip"),
) -> K8sPodsResponse:
    """Get list of pods with filtering and pagination.

    Args:
        namespace: Filter by namespace.
        status: Filter by pod status (Running, Pending, Failed, Succeeded, Unknown).
        nodeName: Filter by node name.
        search: Search term for pod name.
        limit: Maximum number of pods to return (default 50, max 500).
        offset: Number of pods to skip (for pagination).

    Returns:
        K8sPodsResponse with list of pods and total count.

    Raises:
        HTTPException: If an error occurs fetching pods.
    """
    try:
        service = get_k8s_service()
        pods, total = service.get_pods(
            namespace=namespace,
            status=status,
            node_name=nodeName,
            search=search,
            limit=limit,
            offset=offset,
        )
        return K8sPodsResponse(
            pods=pods,
            total=total,
        )
    except Exception as e:
        logger.error(f"Error fetching pods: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching pods: {e}")
