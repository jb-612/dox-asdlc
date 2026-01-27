"""Unit tests for K8s cluster API Pydantic models.

Tests model validation, serialization (snake_case to camelCase), and constraints.
Matches TypeScript interfaces in docker/hitl-ui/src/api/types/kubernetes.ts.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError


class TestClusterHealthStatus:
    """Tests for ClusterHealthStatus enum."""

    def test_cluster_health_status_values(self) -> None:
        """Test all ClusterHealthStatus enum values exist."""
        from src.orchestrator.api.models.k8s import ClusterHealthStatus

        assert ClusterHealthStatus.HEALTHY.value == "healthy"
        assert ClusterHealthStatus.DEGRADED.value == "degraded"
        assert ClusterHealthStatus.CRITICAL.value == "critical"


class TestClusterHealth:
    """Tests for ClusterHealth model."""

    def test_cluster_health_creation(self) -> None:
        """Test ClusterHealth creation with all required fields."""
        from src.orchestrator.api.models.k8s import ClusterHealth, ClusterHealthStatus

        health = ClusterHealth(
            status=ClusterHealthStatus.HEALTHY,
            nodes_ready=3,
            nodes_total=3,
            pods_running=15,
            pods_total=20,
            pods_pending=3,
            pods_failed=2,
            cpu_usage_percent=45.5,
            memory_usage_percent=60.2,
            last_updated="2026-01-27T10:00:00Z",
        )
        assert health.status == ClusterHealthStatus.HEALTHY
        assert health.nodes_ready == 3
        assert health.nodes_total == 3
        assert health.pods_running == 15
        assert health.pods_pending == 3
        assert health.pods_failed == 2
        assert health.cpu_usage_percent == 45.5
        assert health.memory_usage_percent == 60.2

    def test_cluster_health_serialization_camel_case(self) -> None:
        """Test ClusterHealth JSON serialization uses camelCase."""
        from src.orchestrator.api.models.k8s import ClusterHealth, ClusterHealthStatus

        health = ClusterHealth(
            status=ClusterHealthStatus.DEGRADED,
            nodes_ready=2,
            nodes_total=3,
            pods_running=10,
            pods_total=15,
            pods_pending=3,
            pods_failed=2,
            cpu_usage_percent=75.0,
            memory_usage_percent=80.0,
            last_updated="2026-01-27T10:00:00Z",
        )
        data = health.model_dump(by_alias=True)
        assert data["status"] == "degraded"
        assert data["nodesReady"] == 2
        assert data["nodesTotal"] == 3
        assert data["podsRunning"] == 10
        assert data["podsTotal"] == 15
        assert data["podsPending"] == 3
        assert data["podsFailed"] == 2
        assert data["cpuUsagePercent"] == 75.0
        assert data["memoryUsagePercent"] == 80.0
        assert data["lastUpdated"] == "2026-01-27T10:00:00Z"


class TestNodeCondition:
    """Tests for NodeCondition model."""

    def test_node_condition_creation(self) -> None:
        """Test NodeCondition creation."""
        from src.orchestrator.api.models.k8s import NodeCondition, ConditionStatus

        condition = NodeCondition(
            type="Ready",
            status=ConditionStatus.TRUE,
            reason="KubeletReady",
            message="kubelet is posting ready status",
            last_transition="2026-01-27T08:00:00Z",
        )
        assert condition.type == "Ready"
        assert condition.status == ConditionStatus.TRUE
        assert condition.reason == "KubeletReady"

    def test_node_condition_serialization(self) -> None:
        """Test NodeCondition serialization to camelCase."""
        from src.orchestrator.api.models.k8s import NodeCondition, ConditionStatus

        condition = NodeCondition(
            type="Ready",
            status=ConditionStatus.TRUE,
            reason="KubeletReady",
            message="kubelet is posting ready status",
            last_transition="2026-01-27T08:00:00Z",
        )
        data = condition.model_dump(by_alias=True)
        assert data["lastTransition"] == "2026-01-27T08:00:00Z"


class TestConditionStatus:
    """Tests for ConditionStatus enum."""

    def test_condition_status_values(self) -> None:
        """Test ConditionStatus enum values."""
        from src.orchestrator.api.models.k8s import ConditionStatus

        assert ConditionStatus.TRUE.value == "True"
        assert ConditionStatus.FALSE.value == "False"
        assert ConditionStatus.UNKNOWN.value == "Unknown"


class TestNodeCapacity:
    """Tests for NodeCapacity model."""

    def test_node_capacity_creation(self) -> None:
        """Test NodeCapacity creation."""
        from src.orchestrator.api.models.k8s import NodeCapacity

        capacity = NodeCapacity(cpu="4", memory="16Gi", pods=110)
        assert capacity.cpu == "4"
        assert capacity.memory == "16Gi"
        assert capacity.pods == 110


class TestNodeUsage:
    """Tests for NodeUsage model."""

    def test_node_usage_creation(self) -> None:
        """Test NodeUsage creation."""
        from src.orchestrator.api.models.k8s import NodeUsage

        usage = NodeUsage(cpu_percent=60.5, memory_percent=75.2, pods_count=45)
        assert usage.cpu_percent == 60.5
        assert usage.memory_percent == 75.2
        assert usage.pods_count == 45

    def test_node_usage_serialization(self) -> None:
        """Test NodeUsage serialization to camelCase."""
        from src.orchestrator.api.models.k8s import NodeUsage

        usage = NodeUsage(cpu_percent=60.5, memory_percent=75.2, pods_count=45)
        data = usage.model_dump(by_alias=True)
        assert data["cpuPercent"] == 60.5
        assert data["memoryPercent"] == 75.2
        assert data["podsCount"] == 45


class TestNodeStatus:
    """Tests for NodeStatus enum."""

    def test_node_status_values(self) -> None:
        """Test NodeStatus enum values."""
        from src.orchestrator.api.models.k8s import NodeStatus

        assert NodeStatus.READY.value == "Ready"
        assert NodeStatus.NOT_READY.value == "NotReady"
        assert NodeStatus.UNKNOWN.value == "Unknown"


class TestK8sNode:
    """Tests for K8sNode model."""

    def test_k8s_node_creation(self) -> None:
        """Test K8sNode creation with all fields."""
        from src.orchestrator.api.models.k8s import (
            K8sNode,
            NodeStatus,
            NodeCapacity,
            NodeUsage,
            NodeCondition,
            ConditionStatus,
        )

        node = K8sNode(
            name="worker-1",
            status=NodeStatus.READY,
            roles=["worker"],
            version="v1.28.0",
            os="linux",
            container_runtime="containerd://1.7.0",
            capacity=NodeCapacity(cpu="8", memory="32Gi", pods=110),
            allocatable=NodeCapacity(cpu="7.8", memory="30Gi", pods=100),
            usage=NodeUsage(cpu_percent=60.0, memory_percent=75.0, pods_count=45),
            conditions=[
                NodeCondition(
                    type="Ready",
                    status=ConditionStatus.TRUE,
                    reason="KubeletReady",
                    message="kubelet is ready",
                    last_transition="2026-01-27T08:00:00Z",
                )
            ],
            created_at="2026-01-01T00:00:00Z",
        )
        assert node.name == "worker-1"
        assert node.status == NodeStatus.READY
        assert "worker" in node.roles
        assert node.capacity.cpu == "8"
        assert node.usage.cpu_percent == 60.0

    def test_k8s_node_serialization(self) -> None:
        """Test K8sNode JSON serialization with camelCase."""
        from src.orchestrator.api.models.k8s import (
            K8sNode,
            NodeStatus,
            NodeCapacity,
            NodeUsage,
            ConditionStatus,
            NodeCondition,
        )

        node = K8sNode(
            name="worker-1",
            status=NodeStatus.READY,
            roles=["worker"],
            version="v1.28.0",
            os="linux",
            container_runtime="containerd://1.7.0",
            capacity=NodeCapacity(cpu="8", memory="32Gi", pods=110),
            allocatable=NodeCapacity(cpu="7.8", memory="30Gi", pods=100),
            usage=NodeUsage(cpu_percent=60.0, memory_percent=75.0, pods_count=45),
            conditions=[
                NodeCondition(
                    type="Ready",
                    status=ConditionStatus.TRUE,
                    reason="KubeletReady",
                    message="kubelet is ready",
                    last_transition="2026-01-27T08:00:00Z",
                )
            ],
            created_at="2026-01-01T00:00:00Z",
        )
        data = node.model_dump(by_alias=True)
        assert data["containerRuntime"] == "containerd://1.7.0"
        assert data["createdAt"] == "2026-01-01T00:00:00Z"


class TestPodStatus:
    """Tests for PodStatus enum."""

    def test_pod_status_values(self) -> None:
        """Test PodStatus enum values."""
        from src.orchestrator.api.models.k8s import PodStatus

        assert PodStatus.RUNNING.value == "Running"
        assert PodStatus.PENDING.value == "Pending"
        assert PodStatus.SUCCEEDED.value == "Succeeded"
        assert PodStatus.FAILED.value == "Failed"
        assert PodStatus.UNKNOWN.value == "Unknown"


class TestContainerStateType:
    """Tests for ContainerStateType enum."""

    def test_container_state_type_values(self) -> None:
        """Test ContainerStateType enum values."""
        from src.orchestrator.api.models.k8s import ContainerStateType

        assert ContainerStateType.RUNNING.value == "running"
        assert ContainerStateType.WAITING.value == "waiting"
        assert ContainerStateType.TERMINATED.value == "terminated"


class TestContainerState:
    """Tests for ContainerState model."""

    def test_container_state_running(self) -> None:
        """Test ContainerState for running container."""
        from src.orchestrator.api.models.k8s import ContainerState, ContainerStateType

        state = ContainerState(
            state=ContainerStateType.RUNNING,
            started_at="2026-01-27T08:00:00Z",
        )
        assert state.state == ContainerStateType.RUNNING
        assert state.started_at == "2026-01-27T08:00:00Z"
        assert state.reason is None

    def test_container_state_terminated(self) -> None:
        """Test ContainerState for terminated container."""
        from src.orchestrator.api.models.k8s import ContainerState, ContainerStateType

        state = ContainerState(
            state=ContainerStateType.TERMINATED,
            reason="Completed",
            exit_code=0,
            started_at="2026-01-27T08:00:00Z",
            finished_at="2026-01-27T09:00:00Z",
        )
        assert state.state == ContainerStateType.TERMINATED
        assert state.exit_code == 0
        assert state.finished_at is not None

    def test_container_state_serialization(self) -> None:
        """Test ContainerState serialization to camelCase."""
        from src.orchestrator.api.models.k8s import ContainerState, ContainerStateType

        state = ContainerState(
            state=ContainerStateType.TERMINATED,
            exit_code=0,
            started_at="2026-01-27T08:00:00Z",
            finished_at="2026-01-27T09:00:00Z",
        )
        data = state.model_dump(by_alias=True)
        assert data["exitCode"] == 0
        assert data["startedAt"] == "2026-01-27T08:00:00Z"
        assert data["finishedAt"] == "2026-01-27T09:00:00Z"


class TestContainer:
    """Tests for Container model."""

    def test_container_creation(self) -> None:
        """Test Container creation."""
        from src.orchestrator.api.models.k8s import Container, ContainerStateType

        container = Container(
            name="app",
            image="myapp:v1.0",
            ready=True,
            restart_count=2,
            state=ContainerStateType.RUNNING,
        )
        assert container.name == "app"
        assert container.image == "myapp:v1.0"
        assert container.ready is True
        assert container.restart_count == 2

    def test_container_with_last_state(self) -> None:
        """Test Container with last_state."""
        from src.orchestrator.api.models.k8s import (
            Container,
            ContainerState,
            ContainerStateType,
        )

        container = Container(
            name="app",
            image="myapp:v1.0",
            ready=True,
            restart_count=2,
            state=ContainerStateType.RUNNING,
            last_state=ContainerState(
                state=ContainerStateType.TERMINATED,
                exit_code=1,
                reason="Error",
            ),
        )
        assert container.last_state is not None
        assert container.last_state.exit_code == 1

    def test_container_serialization(self) -> None:
        """Test Container serialization to camelCase."""
        from src.orchestrator.api.models.k8s import Container, ContainerStateType

        container = Container(
            name="app",
            image="myapp:v1.0",
            ready=True,
            restart_count=2,
            state=ContainerStateType.RUNNING,
            state_reason="Running",
        )
        data = container.model_dump(by_alias=True)
        assert data["restartCount"] == 2
        assert data["stateReason"] == "Running"


class TestK8sPod:
    """Tests for K8sPod model."""

    def test_k8s_pod_creation(self) -> None:
        """Test K8sPod creation with all fields."""
        from src.orchestrator.api.models.k8s import (
            K8sPod,
            PodStatus,
            Container,
            ContainerStateType,
        )

        pod = K8sPod(
            name="my-app-abc123",
            namespace="default",
            status=PodStatus.RUNNING,
            phase="Running",
            node_name="worker-1",
            pod_ip="10.244.0.5",
            host_ip="192.168.1.10",
            containers=[
                Container(
                    name="app",
                    image="myapp:v1.0",
                    ready=True,
                    restart_count=0,
                    state=ContainerStateType.RUNNING,
                )
            ],
            restarts=0,
            age="2d5h",
            created_at="2026-01-25T10:00:00Z",
            labels={"app": "my-app", "env": "prod"},
            owner_kind="Deployment",
            owner_name="my-app",
        )
        assert pod.name == "my-app-abc123"
        assert pod.status == PodStatus.RUNNING
        assert pod.node_name == "worker-1"
        assert len(pod.containers) == 1
        assert pod.labels["app"] == "my-app"

    def test_k8s_pod_serialization(self) -> None:
        """Test K8sPod JSON serialization with camelCase."""
        from src.orchestrator.api.models.k8s import (
            K8sPod,
            PodStatus,
            Container,
            ContainerStateType,
        )

        pod = K8sPod(
            name="my-app-abc123",
            namespace="default",
            status=PodStatus.RUNNING,
            phase="Running",
            node_name="worker-1",
            pod_ip="10.244.0.5",
            host_ip="192.168.1.10",
            containers=[
                Container(
                    name="app",
                    image="myapp:v1.0",
                    ready=True,
                    restart_count=0,
                    state=ContainerStateType.RUNNING,
                )
            ],
            restarts=0,
            age="2d5h",
            created_at="2026-01-25T10:00:00Z",
            labels={"app": "my-app"},
            owner_kind="Deployment",
            owner_name="my-app",
        )
        data = pod.model_dump(by_alias=True)
        assert data["nodeName"] == "worker-1"
        assert data["podIP"] == "10.244.0.5"
        assert data["hostIP"] == "192.168.1.10"
        assert data["createdAt"] == "2026-01-25T10:00:00Z"
        assert data["ownerKind"] == "Deployment"
        assert data["ownerName"] == "my-app"


class TestK8sNodesResponse:
    """Tests for K8sNodesResponse wrapper model."""

    def test_k8s_nodes_response_creation(self) -> None:
        """Test K8sNodesResponse creation."""
        from src.orchestrator.api.models.k8s import (
            K8sNodesResponse,
            K8sNode,
            NodeStatus,
            NodeCapacity,
            NodeUsage,
        )

        response = K8sNodesResponse(
            nodes=[
                K8sNode(
                    name="worker-1",
                    status=NodeStatus.READY,
                    roles=["worker"],
                    version="v1.28.0",
                    os="linux",
                    container_runtime="containerd://1.7.0",
                    capacity=NodeCapacity(cpu="8", memory="32Gi", pods=110),
                    allocatable=NodeCapacity(cpu="7.8", memory="30Gi", pods=100),
                    usage=NodeUsage(cpu_percent=60.0, memory_percent=75.0, pods_count=45),
                    conditions=[],
                    created_at="2026-01-01T00:00:00Z",
                )
            ],
            total=1,
        )
        assert len(response.nodes) == 1
        assert response.total == 1


class TestK8sPodsResponse:
    """Tests for K8sPodsResponse wrapper model."""

    def test_k8s_pods_response_creation(self) -> None:
        """Test K8sPodsResponse creation."""
        from src.orchestrator.api.models.k8s import (
            K8sPodsResponse,
            K8sPod,
            PodStatus,
            Container,
            ContainerStateType,
        )

        response = K8sPodsResponse(
            pods=[
                K8sPod(
                    name="my-app-abc123",
                    namespace="default",
                    status=PodStatus.RUNNING,
                    phase="Running",
                    node_name="worker-1",
                    pod_ip="10.244.0.5",
                    host_ip="192.168.1.10",
                    containers=[
                        Container(
                            name="app",
                            image="myapp:v1.0",
                            ready=True,
                            restart_count=0,
                            state=ContainerStateType.RUNNING,
                        )
                    ],
                    restarts=0,
                    age="2d5h",
                    created_at="2026-01-25T10:00:00Z",
                    labels={},
                    owner_kind="Deployment",
                    owner_name="my-app",
                )
            ],
            total=1,
        )
        assert len(response.pods) == 1
        assert response.total == 1


class TestClusterHealthResponse:
    """Tests for ClusterHealthResponse wrapper model."""

    def test_cluster_health_response_creation(self) -> None:
        """Test ClusterHealthResponse creation."""
        from src.orchestrator.api.models.k8s import (
            ClusterHealthResponse,
            ClusterHealth,
            ClusterHealthStatus,
        )

        response = ClusterHealthResponse(
            health=ClusterHealth(
                status=ClusterHealthStatus.HEALTHY,
                nodes_ready=3,
                nodes_total=3,
                pods_running=15,
                pods_total=20,
                pods_pending=3,
                pods_failed=2,
                cpu_usage_percent=45.5,
                memory_usage_percent=60.2,
                last_updated="2026-01-27T10:00:00Z",
            ),
            mock_mode=False,
        )
        assert response.health.status == ClusterHealthStatus.HEALTHY
        assert response.mock_mode is False

    def test_cluster_health_response_serialization(self) -> None:
        """Test ClusterHealthResponse serialization."""
        from src.orchestrator.api.models.k8s import (
            ClusterHealthResponse,
            ClusterHealth,
            ClusterHealthStatus,
        )

        response = ClusterHealthResponse(
            health=ClusterHealth(
                status=ClusterHealthStatus.HEALTHY,
                nodes_ready=3,
                nodes_total=3,
                pods_running=15,
                pods_total=20,
                pods_pending=3,
                pods_failed=2,
                cpu_usage_percent=45.5,
                memory_usage_percent=60.2,
                last_updated="2026-01-27T10:00:00Z",
            ),
            mock_mode=True,
        )
        data = response.model_dump(by_alias=True)
        assert data["mockMode"] is True
