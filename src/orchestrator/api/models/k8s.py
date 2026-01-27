"""Kubernetes cluster API Pydantic models.

These models match the TypeScript interfaces in docker/hitl-ui/src/api/types/kubernetes.ts
for consistent frontend-backend communication.

Uses snake_case internally with camelCase aliases for JSON serialization.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase.

    Args:
        string: Snake case string.

    Returns:
        CamelCase string.
    """
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model with camelCase serialization for JSON output."""

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


# =============================================================================
# Enums
# =============================================================================


class ClusterHealthStatus(str, Enum):
    """Cluster health status.

    Matches TypeScript: ClusterHealthStatus = 'healthy' | 'degraded' | 'critical'
    """

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    CRITICAL = "critical"


class NodeStatus(str, Enum):
    """Node status.

    Matches TypeScript: NodeStatus = 'Ready' | 'NotReady' | 'Unknown'
    """

    READY = "Ready"
    NOT_READY = "NotReady"
    UNKNOWN = "Unknown"


class ConditionStatus(str, Enum):
    """Condition status for node conditions.

    Matches TypeScript: ConditionStatus = 'True' | 'False' | 'Unknown'
    """

    TRUE = "True"
    FALSE = "False"
    UNKNOWN = "Unknown"


class PodStatus(str, Enum):
    """Pod status.

    Matches TypeScript: PodStatus = 'Running' | 'Pending' | 'Succeeded' | 'Failed' | 'Unknown'
    """

    RUNNING = "Running"
    PENDING = "Pending"
    SUCCEEDED = "Succeeded"
    FAILED = "Failed"
    UNKNOWN = "Unknown"


class ContainerStateType(str, Enum):
    """Container state type.

    Matches TypeScript: ContainerStateType = 'running' | 'waiting' | 'terminated'
    """

    RUNNING = "running"
    WAITING = "waiting"
    TERMINATED = "terminated"


# =============================================================================
# Cluster Health Models
# =============================================================================


class ClusterHealth(CamelModel):
    """Cluster health summary.

    Matches TypeScript ClusterHealth interface.
    """

    status: ClusterHealthStatus
    nodes_ready: int = Field(..., alias="nodesReady")
    nodes_total: int = Field(..., alias="nodesTotal")
    pods_running: int = Field(..., alias="podsRunning")
    pods_total: int = Field(..., alias="podsTotal")
    pods_pending: int = Field(..., alias="podsPending")
    pods_failed: int = Field(..., alias="podsFailed")
    cpu_usage_percent: float = Field(..., alias="cpuUsagePercent")
    memory_usage_percent: float = Field(..., alias="memoryUsagePercent")
    last_updated: str = Field(..., alias="lastUpdated")


# =============================================================================
# Node Models
# =============================================================================


class NodeCondition(CamelModel):
    """Node condition status.

    Matches TypeScript NodeCondition interface.
    """

    type: str
    status: ConditionStatus
    reason: str
    message: str
    last_transition: str = Field(..., alias="lastTransition")


class NodeCapacity(CamelModel):
    """Node resource capacity.

    Matches TypeScript NodeCapacity interface.
    """

    cpu: str
    memory: str
    pods: int


class NodeUsage(CamelModel):
    """Node resource usage.

    Matches TypeScript NodeUsage interface.
    """

    cpu_percent: float = Field(..., alias="cpuPercent")
    memory_percent: float = Field(..., alias="memoryPercent")
    pods_count: int = Field(..., alias="podsCount")


class K8sNode(CamelModel):
    """Kubernetes node information.

    Matches TypeScript K8sNode interface.
    """

    name: str
    status: NodeStatus
    roles: list[str]
    version: str
    os: str
    container_runtime: str = Field(..., alias="containerRuntime")
    capacity: NodeCapacity
    allocatable: NodeCapacity
    usage: NodeUsage
    conditions: list[NodeCondition]
    created_at: str = Field(..., alias="createdAt")


# =============================================================================
# Pod Models
# =============================================================================


class ContainerState(CamelModel):
    """Container state details.

    Matches TypeScript ContainerState interface.
    """

    state: ContainerStateType
    reason: Optional[str] = None
    exit_code: Optional[int] = Field(None, alias="exitCode")
    started_at: Optional[str] = Field(None, alias="startedAt")
    finished_at: Optional[str] = Field(None, alias="finishedAt")


class Container(CamelModel):
    """Container information within a pod.

    Matches TypeScript Container interface.
    """

    name: str
    image: str
    ready: bool
    restart_count: int = Field(..., alias="restartCount")
    state: ContainerStateType
    state_reason: Optional[str] = Field(None, alias="stateReason")
    last_state: Optional[ContainerState] = Field(None, alias="lastState")


class K8sPod(CamelModel):
    """Kubernetes pod information.

    Matches TypeScript K8sPod interface.
    """

    name: str
    namespace: str
    status: PodStatus
    phase: str
    node_name: str = Field(..., alias="nodeName")
    pod_ip: str = Field(..., alias="podIP")
    host_ip: str = Field(..., alias="hostIP")
    containers: list[Container]
    restarts: int
    age: str
    created_at: str = Field(..., alias="createdAt")
    labels: dict[str, str] = Field(default_factory=dict)
    owner_kind: str = Field(..., alias="ownerKind")
    owner_name: str = Field(..., alias="ownerName")


# =============================================================================
# Response Wrapper Models
# =============================================================================


class K8sNodesResponse(CamelModel):
    """Response for nodes list endpoint.

    Matches TypeScript K8sNodesResponse interface.
    """

    nodes: list[K8sNode]
    total: int


class K8sPodsResponse(CamelModel):
    """Response for pods list endpoint.

    Matches TypeScript K8sPodsResponse interface.
    """

    pods: list[K8sPod]
    total: int


class ClusterHealthResponse(CamelModel):
    """Response for cluster health endpoint.

    Includes mock_mode flag to indicate if data is from mock or real K8s API.
    """

    health: ClusterHealth
    mock_mode: bool = Field(False, alias="mockMode")
