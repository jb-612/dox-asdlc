"""Kubernetes cluster service.

Provides K8s cluster health, node, and pod information.
Supports three modes:
1. In-cluster config (when running in K8s via KUBERNETES_SERVICE_HOST)
2. Local kubeconfig (~/.kube/config) for development
3. Mock mode (when neither is available) - same pattern as VictoriaMetrics mock

Features:
- 10 second TTL caching for all data
- Graceful fallback to mock mode on errors
- Filtering and pagination for pods
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

from src.orchestrator.api.models.k8s import (
    ClusterHealth,
    ClusterHealthStatus,
    ConditionStatus,
    Container,
    ContainerStateType,
    K8sNode,
    K8sPod,
    NodeCapacity,
    NodeCondition,
    NodeStatus,
    NodeUsage,
    PodStatus,
)

logger = logging.getLogger(__name__)

# Cache TTL in seconds
CACHE_TTL = 10

# Try to import kubernetes client and configure
MOCK_MODE = True
config = None
client = None

try:
    from kubernetes import client as k8s_client
    from kubernetes import config as k8s_config

    client = k8s_client
    config = k8s_config

    if os.getenv("KUBERNETES_SERVICE_HOST"):
        # Running inside a K8s cluster
        config.load_incluster_config()
        MOCK_MODE = False
        logger.info("K8s cluster service: using in-cluster config")
    else:
        # Try local kubeconfig
        try:
            config.load_kube_config()
            MOCK_MODE = False
            logger.info("K8s cluster service: using local kubeconfig")
        except Exception as e:
            logger.warning(f"K8s cluster service: kubeconfig not available: {e}")
            MOCK_MODE = True
except ImportError as e:
    logger.warning(f"K8s cluster service: kubernetes package not installed: {e}")
    MOCK_MODE = True
except Exception as e:
    logger.warning(f"K8s cluster service: K8s config failed, using mock mode: {e}")
    MOCK_MODE = True


class K8sClusterService:
    """Service for K8s cluster information.

    Provides cluster health, nodes, and pods data with caching.
    Falls back to mock data when K8s API is unavailable.
    """

    def __init__(self) -> None:
        """Initialize the K8s cluster service."""
        self.mock_mode = MOCK_MODE
        self._core_api: Optional[object] = None

        # Cache storage
        self._health_cache: Optional[ClusterHealth] = None
        self._health_cache_time: Optional[float] = None
        self._nodes_cache: Optional[list[K8sNode]] = None
        self._nodes_cache_time: Optional[float] = None
        self._pods_cache: Optional[list[K8sPod]] = None
        self._pods_cache_time: Optional[float] = None

    def _get_core_api(self) -> object:
        """Get K8s CoreV1Api instance.

        Returns:
            CoreV1Api instance for K8s API calls.

        Raises:
            Exception: If K8s client is not available.
        """
        if self._core_api is None:
            if client is None:
                raise Exception("Kubernetes client not available")
            self._core_api = client.CoreV1Api()
        return self._core_api

    def _is_cache_valid(self, cache_time: Optional[float]) -> bool:
        """Check if cache is still valid.

        Args:
            cache_time: Timestamp when cache was populated.

        Returns:
            True if cache is valid, False otherwise.
        """
        if cache_time is None:
            return False
        return (time.time() - cache_time) < CACHE_TTL

    def get_cluster_health(self) -> ClusterHealth:
        """Get cluster health summary.

        Returns:
            ClusterHealth with node/pod counts and resource usage.
        """
        # Check cache
        if self._is_cache_valid(self._health_cache_time) and self._health_cache:
            return self._health_cache

        if self.mock_mode:
            health = self._get_mock_cluster_health()
        else:
            try:
                health = self._get_real_cluster_health()
            except Exception as e:
                logger.warning(f"K8s API error, falling back to mock: {e}")
                health = self._get_mock_cluster_health()

        # Update cache
        self._health_cache = health
        self._health_cache_time = time.time()
        return health

    def _get_real_cluster_health(self) -> ClusterHealth:
        """Get cluster health from real K8s API.

        Returns:
            ClusterHealth from actual K8s cluster.
        """
        api = self._get_core_api()

        # Get nodes
        nodes = api.list_node().items
        nodes_ready = sum(
            1 for n in nodes
            if any(c.type == "Ready" and c.status == "True" for c in n.status.conditions)
        )

        # Get pods
        pods = api.list_pod_for_all_namespaces().items
        pods_running = sum(1 for p in pods if p.status.phase == "Running")
        pods_pending = sum(1 for p in pods if p.status.phase == "Pending")
        pods_failed = sum(1 for p in pods if p.status.phase == "Failed")

        # Calculate resource usage (simplified - real impl would use metrics API)
        # For now, estimate based on running pods
        cpu_percent = min(100.0, (pods_running / max(len(nodes), 1)) * 10)
        memory_percent = min(100.0, (pods_running / max(len(nodes), 1)) * 15)

        # Determine status
        if nodes_ready == len(nodes) and pods_failed == 0:
            status = ClusterHealthStatus.HEALTHY
        elif nodes_ready < len(nodes) or pods_failed > 5:
            status = ClusterHealthStatus.CRITICAL
        else:
            status = ClusterHealthStatus.DEGRADED

        return ClusterHealth(
            status=status,
            nodes_ready=nodes_ready,
            nodes_total=len(nodes),
            pods_running=pods_running,
            pods_total=len(pods),
            pods_pending=pods_pending,
            pods_failed=pods_failed,
            cpu_usage_percent=round(cpu_percent, 1),
            memory_usage_percent=round(memory_percent, 1),
            last_updated=datetime.now(timezone.utc).isoformat(),
        )

    def _get_mock_cluster_health(self) -> ClusterHealth:
        """Get mock cluster health data.

        Returns:
            ClusterHealth with realistic mock data.
        """
        return ClusterHealth(
            status=ClusterHealthStatus.HEALTHY,
            nodes_ready=3,
            nodes_total=3,
            pods_running=15,
            pods_total=20,
            pods_pending=3,
            pods_failed=2,
            cpu_usage_percent=45.5,
            memory_usage_percent=62.3,
            last_updated=datetime.now(timezone.utc).isoformat(),
        )

    def get_nodes(self) -> list[K8sNode]:
        """Get list of cluster nodes.

        Returns:
            List of K8sNode objects.
        """
        # Check cache
        if self._is_cache_valid(self._nodes_cache_time) and self._nodes_cache:
            return self._nodes_cache

        if self.mock_mode:
            nodes = self._get_mock_nodes()
        else:
            try:
                nodes = self._get_real_nodes()
            except Exception as e:
                logger.warning(f"K8s API error, falling back to mock: {e}")
                nodes = self._get_mock_nodes()

        # Update cache
        self._nodes_cache = nodes
        self._nodes_cache_time = time.time()
        return nodes

    def _get_real_nodes(self) -> list[K8sNode]:
        """Get nodes from real K8s API.

        Returns:
            List of K8sNode from actual K8s cluster.
        """
        api = self._get_core_api()
        nodes = api.list_node().items

        result = []
        for node in nodes:
            # Extract roles from labels
            roles = []
            for label in node.metadata.labels or {}:
                if label.startswith("node-role.kubernetes.io/"):
                    role = label.replace("node-role.kubernetes.io/", "")
                    if role:
                        roles.append(role)
            if not roles:
                roles = ["worker"]

            # Get conditions
            conditions = []
            for cond in node.status.conditions or []:
                cond_status = ConditionStatus.UNKNOWN
                if cond.status == "True":
                    cond_status = ConditionStatus.TRUE
                elif cond.status == "False":
                    cond_status = ConditionStatus.FALSE

                conditions.append(NodeCondition(
                    type=cond.type,
                    status=cond_status,
                    reason=cond.reason or "",
                    message=cond.message or "",
                    last_transition=cond.last_transition_time.isoformat() if cond.last_transition_time else "",
                ))

            # Determine status
            status = NodeStatus.UNKNOWN
            ready_cond = next((c for c in node.status.conditions if c.type == "Ready"), None)
            if ready_cond:
                if ready_cond.status == "True":
                    status = NodeStatus.READY
                else:
                    status = NodeStatus.NOT_READY

            # Get capacity
            capacity = node.status.capacity or {}
            allocatable = node.status.allocatable or {}

            result.append(K8sNode(
                name=node.metadata.name,
                status=status,
                roles=roles,
                version=node.status.node_info.kubelet_version if node.status.node_info else "unknown",
                os=node.status.node_info.os_image if node.status.node_info else "unknown",
                container_runtime=node.status.node_info.container_runtime_version if node.status.node_info else "unknown",
                capacity=NodeCapacity(
                    cpu=capacity.get("cpu", "0"),
                    memory=capacity.get("memory", "0"),
                    pods=int(capacity.get("pods", 0)),
                ),
                allocatable=NodeCapacity(
                    cpu=allocatable.get("cpu", "0"),
                    memory=allocatable.get("memory", "0"),
                    pods=int(allocatable.get("pods", 0)),
                ),
                usage=NodeUsage(
                    cpu_percent=50.0,  # Would need metrics API for real values
                    memory_percent=60.0,
                    pods_count=len([p for p in api.list_pod_for_all_namespaces().items if p.spec.node_name == node.metadata.name]),
                ),
                conditions=conditions,
                created_at=node.metadata.creation_timestamp.isoformat() if node.metadata.creation_timestamp else "",
            ))

        return result

    def _get_mock_nodes(self) -> list[K8sNode]:
        """Get mock node data.

        Returns:
            List of K8sNode with realistic mock data.
        """
        now = datetime.now(timezone.utc).isoformat()
        nodes = [
            K8sNode(
                name="control-plane-1",
                status=NodeStatus.READY,
                roles=["control-plane", "master"],
                version="v1.28.0",
                os="Ubuntu 22.04",
                container_runtime="containerd://1.7.0",
                capacity=NodeCapacity(cpu="4", memory="16Gi", pods=110),
                allocatable=NodeCapacity(cpu="3.8", memory="14Gi", pods=100),
                usage=NodeUsage(cpu_percent=35.0, memory_percent=55.0, pods_count=25),
                conditions=[
                    NodeCondition(
                        type="Ready",
                        status=ConditionStatus.TRUE,
                        reason="KubeletReady",
                        message="kubelet is posting ready status",
                        last_transition=now,
                    ),
                ],
                created_at="2026-01-01T00:00:00Z",
            ),
            K8sNode(
                name="worker-1",
                status=NodeStatus.READY,
                roles=["worker"],
                version="v1.28.0",
                os="Ubuntu 22.04",
                container_runtime="containerd://1.7.0",
                capacity=NodeCapacity(cpu="8", memory="32Gi", pods=110),
                allocatable=NodeCapacity(cpu="7.8", memory="30Gi", pods=100),
                usage=NodeUsage(cpu_percent=60.0, memory_percent=75.0, pods_count=45),
                conditions=[
                    NodeCondition(
                        type="Ready",
                        status=ConditionStatus.TRUE,
                        reason="KubeletReady",
                        message="kubelet is posting ready status",
                        last_transition=now,
                    ),
                ],
                created_at="2026-01-01T00:00:00Z",
            ),
            K8sNode(
                name="worker-2",
                status=NodeStatus.READY,
                roles=["worker"],
                version="v1.28.0",
                os="Ubuntu 22.04",
                container_runtime="containerd://1.7.0",
                capacity=NodeCapacity(cpu="8", memory="32Gi", pods=110),
                allocatable=NodeCapacity(cpu="7.8", memory="30Gi", pods=100),
                usage=NodeUsage(cpu_percent=45.0, memory_percent=60.0, pods_count=35),
                conditions=[
                    NodeCondition(
                        type="Ready",
                        status=ConditionStatus.TRUE,
                        reason="KubeletReady",
                        message="kubelet is posting ready status",
                        last_transition=now,
                    ),
                ],
                created_at="2026-01-01T00:00:00Z",
            ),
        ]
        return nodes

    def get_pods(
        self,
        namespace: Optional[str] = None,
        status: Optional[PodStatus] = None,
        node_name: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[K8sPod], int]:
        """Get list of pods with filtering and pagination.

        Args:
            namespace: Filter by namespace.
            status: Filter by pod status.
            node_name: Filter by node name.
            search: Search term for pod name.
            limit: Maximum number of pods to return.
            offset: Number of pods to skip.

        Returns:
            Tuple of (filtered pod list, total count before pagination).
        """
        # Get all pods (from cache or fresh)
        if self._is_cache_valid(self._pods_cache_time) and self._pods_cache:
            all_pods = self._pods_cache
        else:
            if self.mock_mode:
                all_pods = self._get_mock_pods()
            else:
                try:
                    all_pods = self._get_real_pods()
                except Exception as e:
                    logger.warning(f"K8s API error, falling back to mock: {e}")
                    all_pods = self._get_mock_pods()

            # Update cache
            self._pods_cache = all_pods
            self._pods_cache_time = time.time()

        # Apply filters
        filtered = all_pods
        if namespace:
            filtered = [p for p in filtered if p.namespace == namespace]
        if status:
            filtered = [p for p in filtered if p.status == status]
        if node_name:
            filtered = [p for p in filtered if p.node_name == node_name]
        if search:
            search_lower = search.lower()
            filtered = [p for p in filtered if search_lower in p.name.lower()]

        total = len(filtered)

        # Apply pagination
        paginated = filtered[offset : offset + limit]

        return paginated, total

    def _get_real_pods(self) -> list[K8sPod]:
        """Get pods from real K8s API.

        Returns:
            List of K8sPod from actual K8s cluster.
        """
        api = self._get_core_api()
        pods = api.list_pod_for_all_namespaces().items

        result = []
        for pod in pods:
            # Map phase to status
            phase = pod.status.phase or "Unknown"
            pod_status = PodStatus.UNKNOWN
            if phase == "Running":
                pod_status = PodStatus.RUNNING
            elif phase == "Pending":
                pod_status = PodStatus.PENDING
            elif phase == "Succeeded":
                pod_status = PodStatus.SUCCEEDED
            elif phase == "Failed":
                pod_status = PodStatus.FAILED

            # Get containers
            containers = []
            total_restarts = 0
            for cs in pod.status.container_statuses or []:
                # Determine state
                state = ContainerStateType.WAITING
                state_reason = None
                if cs.state.running:
                    state = ContainerStateType.RUNNING
                elif cs.state.terminated:
                    state = ContainerStateType.TERMINATED
                    state_reason = cs.state.terminated.reason
                elif cs.state.waiting:
                    state = ContainerStateType.WAITING
                    state_reason = cs.state.waiting.reason

                containers.append(Container(
                    name=cs.name,
                    image=cs.image,
                    ready=cs.ready,
                    restart_count=cs.restart_count,
                    state=state,
                    state_reason=state_reason,
                ))
                total_restarts += cs.restart_count

            # Get owner reference
            owner_kind = ""
            owner_name = ""
            if pod.metadata.owner_references:
                owner_kind = pod.metadata.owner_references[0].kind
                owner_name = pod.metadata.owner_references[0].name

            # Calculate age
            age = "unknown"
            if pod.metadata.creation_timestamp:
                delta = datetime.now(timezone.utc) - pod.metadata.creation_timestamp
                if delta.days > 0:
                    age = f"{delta.days}d"
                elif delta.seconds // 3600 > 0:
                    age = f"{delta.seconds // 3600}h"
                else:
                    age = f"{delta.seconds // 60}m"

            result.append(K8sPod(
                name=pod.metadata.name,
                namespace=pod.metadata.namespace,
                status=pod_status,
                phase=phase,
                node_name=pod.spec.node_name or "",
                pod_ip=pod.status.pod_ip or "",
                host_ip=pod.status.host_ip or "",
                containers=containers,
                restarts=total_restarts,
                age=age,
                created_at=pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else "",
                labels=pod.metadata.labels or {},
                owner_kind=owner_kind,
                owner_name=owner_name,
            ))

        return result

    def _get_mock_pods(self) -> list[K8sPod]:
        """Get mock pod data.

        Returns:
            List of K8sPod with realistic mock data.
        """
        pods = [
            # aSDLC services
            K8sPod(
                name="orchestrator-5f7b9c8d-abc12",
                namespace="default",
                status=PodStatus.RUNNING,
                phase="Running",
                node_name="worker-1",
                pod_ip="10.244.1.5",
                host_ip="192.168.1.11",
                containers=[
                    Container(
                        name="orchestrator",
                        image="asdlc/orchestrator:v0.1.0",
                        ready=True,
                        restart_count=0,
                        state=ContainerStateType.RUNNING,
                    ),
                ],
                restarts=0,
                age="2d5h",
                created_at="2026-01-25T10:00:00Z",
                labels={"app": "orchestrator", "component": "asdlc"},
                owner_kind="Deployment",
                owner_name="orchestrator",
            ),
            K8sPod(
                name="workers-7c8d9e0f-def34",
                namespace="default",
                status=PodStatus.RUNNING,
                phase="Running",
                node_name="worker-1",
                pod_ip="10.244.1.6",
                host_ip="192.168.1.11",
                containers=[
                    Container(
                        name="workers",
                        image="asdlc/workers:v0.1.0",
                        ready=True,
                        restart_count=1,
                        state=ContainerStateType.RUNNING,
                    ),
                ],
                restarts=1,
                age="2d5h",
                created_at="2026-01-25T10:00:00Z",
                labels={"app": "workers", "component": "asdlc"},
                owner_kind="Deployment",
                owner_name="workers",
            ),
            K8sPod(
                name="hitl-ui-4a5b6c7d-ghi56",
                namespace="default",
                status=PodStatus.RUNNING,
                phase="Running",
                node_name="worker-2",
                pod_ip="10.244.2.5",
                host_ip="192.168.1.12",
                containers=[
                    Container(
                        name="hitl-ui",
                        image="asdlc/hitl-ui:v0.1.0",
                        ready=True,
                        restart_count=0,
                        state=ContainerStateType.RUNNING,
                    ),
                ],
                restarts=0,
                age="2d5h",
                created_at="2026-01-25T10:00:00Z",
                labels={"app": "hitl-ui", "component": "asdlc"},
                owner_kind="Deployment",
                owner_name="hitl-ui",
            ),
            # Infrastructure
            K8sPod(
                name="redis-master-0",
                namespace="default",
                status=PodStatus.RUNNING,
                phase="Running",
                node_name="worker-1",
                pod_ip="10.244.1.10",
                host_ip="192.168.1.11",
                containers=[
                    Container(
                        name="redis",
                        image="redis:7.2-alpine",
                        ready=True,
                        restart_count=0,
                        state=ContainerStateType.RUNNING,
                    ),
                ],
                restarts=0,
                age="5d",
                created_at="2026-01-22T10:00:00Z",
                labels={"app": "redis", "role": "master"},
                owner_kind="StatefulSet",
                owner_name="redis-master",
            ),
            K8sPod(
                name="elasticsearch-0",
                namespace="default",
                status=PodStatus.RUNNING,
                phase="Running",
                node_name="worker-2",
                pod_ip="10.244.2.10",
                host_ip="192.168.1.12",
                containers=[
                    Container(
                        name="elasticsearch",
                        image="elasticsearch:8.11.0",
                        ready=True,
                        restart_count=0,
                        state=ContainerStateType.RUNNING,
                    ),
                ],
                restarts=0,
                age="5d",
                created_at="2026-01-22T10:00:00Z",
                labels={"app": "elasticsearch"},
                owner_kind="StatefulSet",
                owner_name="elasticsearch",
            ),
            # System pods
            K8sPod(
                name="coredns-5c98db65d4-jkl78",
                namespace="kube-system",
                status=PodStatus.RUNNING,
                phase="Running",
                node_name="control-plane-1",
                pod_ip="10.244.0.2",
                host_ip="192.168.1.10",
                containers=[
                    Container(
                        name="coredns",
                        image="k8s.gcr.io/coredns:v1.10.1",
                        ready=True,
                        restart_count=0,
                        state=ContainerStateType.RUNNING,
                    ),
                ],
                restarts=0,
                age="30d",
                created_at="2025-12-27T10:00:00Z",
                labels={"k8s-app": "kube-dns"},
                owner_kind="Deployment",
                owner_name="coredns",
            ),
            # Pending pod
            K8sPod(
                name="batch-job-mno90",
                namespace="default",
                status=PodStatus.PENDING,
                phase="Pending",
                node_name="",
                pod_ip="",
                host_ip="",
                containers=[
                    Container(
                        name="batch",
                        image="asdlc/batch:v0.1.0",
                        ready=False,
                        restart_count=0,
                        state=ContainerStateType.WAITING,
                        state_reason="ContainerCreating",
                    ),
                ],
                restarts=0,
                age="5m",
                created_at="2026-01-27T09:55:00Z",
                labels={"app": "batch-job"},
                owner_kind="Job",
                owner_name="batch-job",
            ),
            # Failed pod
            K8sPod(
                name="failed-task-pqr12",
                namespace="default",
                status=PodStatus.FAILED,
                phase="Failed",
                node_name="worker-1",
                pod_ip="10.244.1.20",
                host_ip="192.168.1.11",
                containers=[
                    Container(
                        name="task",
                        image="asdlc/task:v0.1.0",
                        ready=False,
                        restart_count=3,
                        state=ContainerStateType.TERMINATED,
                        state_reason="Error",
                    ),
                ],
                restarts=3,
                age="1h",
                created_at="2026-01-27T09:00:00Z",
                labels={"app": "failed-task"},
                owner_kind="Job",
                owner_name="failed-task",
            ),
        ]
        return pods
