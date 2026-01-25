"""Kubernetes API models.

Pydantic models for K8s API request/response types.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

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
    """Base model with camelCase serialization."""

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


class ClusterStatus(str, Enum):
    """Cluster health status."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    CRITICAL = "critical"


class PodStatus(str, Enum):
    """Pod status."""

    RUNNING = "Running"
    PENDING = "Pending"
    SUCCEEDED = "Succeeded"
    FAILED = "Failed"
    UNKNOWN = "Unknown"


class ContainerState(str, Enum):
    """Container state."""

    RUNNING = "running"
    WAITING = "waiting"
    TERMINATED = "terminated"


class HealthCheckType(str, Enum):
    """Health check types."""

    DNS = "dns"
    CONNECTIVITY = "connectivity"
    STORAGE = "storage"
    API_SERVER = "api-server"
    ETCD = "etcd"
    SCHEDULER = "scheduler"
    CONTROLLER = "controller"


class HealthCheckStatus(str, Enum):
    """Health check status."""

    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"


class ClusterHealth(CamelModel):
    """Cluster health summary.

    Provides an overview of cluster health metrics.
    """

    status: ClusterStatus
    nodes_ready: int = Field(..., alias="nodesReady")
    nodes_total: int = Field(..., alias="nodesTotal")
    pods_running: int = Field(..., alias="podsRunning")
    pods_total: int = Field(..., alias="podsTotal")
    cpu_percent: float = Field(..., alias="cpuPercent")
    memory_percent: float = Field(..., alias="memoryPercent")


class NodeCondition(CamelModel):
    """Node condition status."""

    type: str
    status: str
    reason: str
    message: str
    last_transition: str = Field(..., alias="lastTransition")


class NodeCapacity(CamelModel):
    """Node resource capacity."""

    cpu: str
    memory: str
    pods: int


class NodeUsage(CamelModel):
    """Node resource usage."""

    cpu_percent: float = Field(..., alias="cpuPercent")
    memory_percent: float = Field(..., alias="memoryPercent")
    pods_count: int = Field(..., alias="podsCount")


class K8sNode(CamelModel):
    """Kubernetes node information."""

    name: str
    status: str
    roles: list[str]
    version: str
    cpu: str
    memory: str
    pods: int
    conditions: list[NodeCondition]
    capacity: NodeCapacity | None = None
    usage: NodeUsage | None = None


class Container(CamelModel):
    """Container information within a pod."""

    name: str
    image: str
    ready: bool
    restart_count: int = Field(..., alias="restartCount")
    state: ContainerState
    state_reason: str | None = Field(None, alias="stateReason")


class K8sPod(CamelModel):
    """Kubernetes pod information."""

    name: str
    namespace: str
    status: PodStatus
    node: str
    restarts: int
    age: str
    containers: list[Container]
    pod_ip: str | None = Field(None, alias="podIP")
    host_ip: str | None = Field(None, alias="hostIP")
    labels: dict[str, str] = Field(default_factory=dict)
    owner_kind: str | None = Field(None, alias="ownerKind")
    owner_name: str | None = Field(None, alias="ownerName")


class ServicePort(CamelModel):
    """Service port configuration."""

    name: str
    protocol: str
    port: int
    target_port: int = Field(..., alias="targetPort")
    node_port: int | None = Field(None, alias="nodePort")


class K8sService(CamelModel):
    """Kubernetes service information."""

    name: str
    namespace: str
    type: str
    cluster_ip: str = Field(..., alias="clusterIP")
    ports: list[ServicePort]
    selector: dict[str, str]


class IngressPath(CamelModel):
    """Ingress path rule."""

    host: str
    path: str
    service_name: str = Field(..., alias="serviceName")
    service_port: int = Field(..., alias="servicePort")


class K8sIngress(CamelModel):
    """Kubernetes ingress information."""

    name: str
    namespace: str
    hosts: list[str]
    paths: list[IngressPath]
    tls: bool


class CommandRequest(CamelModel):
    """Kubernetes command execution request.

    Commands are parameterized and validated server-side.
    Raw command strings are NOT accepted for security.
    """

    action: str
    resource: str
    namespace: str | None = None
    flags: list[str] = Field(default_factory=list)


class CommandResponse(CamelModel):
    """Kubernetes command execution response."""

    output: str
    exit_code: int = Field(..., alias="exitCode")
    duration: int  # milliseconds
    error: str | None = None


class MetricsDataPoint(CamelModel):
    """Single metrics data point."""

    timestamp: str
    cpu_percent: float = Field(..., alias="cpuPercent")
    memory_percent: float = Field(..., alias="memoryPercent")


class MetricsHistory(CamelModel):
    """Metrics time series data."""

    timestamps: list[str]
    cpu: list[float]
    memory: list[float]


class HealthCheckResult(CamelModel):
    """Health check result."""

    status: HealthCheckStatus
    message: str
    duration: int  # milliseconds
    details: dict[str, Any] | None = None
