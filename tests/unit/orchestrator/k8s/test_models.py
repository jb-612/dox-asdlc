"""Unit tests for K8s API models.

Tests model validation, serialization, and constraints.
"""

from __future__ import annotations

from datetime import datetime

import pytest
from pydantic import ValidationError

from src.orchestrator.k8s.models import (
    ClusterHealth,
    ClusterStatus,
    CommandRequest,
    CommandResponse,
    Container,
    ContainerState,
    HealthCheckResult,
    HealthCheckStatus,
    HealthCheckType,
    IngressPath,
    K8sIngress,
    K8sNode,
    K8sPod,
    K8sService,
    MetricsDataPoint,
    MetricsHistory,
    NodeCapacity,
    NodeCondition,
    NodeUsage,
    PodStatus,
    ServicePort,
)


class TestClusterHealth:
    """Tests for ClusterHealth model."""

    def test_cluster_health_creation(self) -> None:
        """Test ClusterHealth creation with all fields."""
        health = ClusterHealth(
            status=ClusterStatus.HEALTHY,
            nodes_ready=3,
            nodes_total=3,
            pods_running=10,
            pods_total=12,
            cpu_percent=45.5,
            memory_percent=60.2,
        )
        assert health.status == ClusterStatus.HEALTHY
        assert health.nodes_ready == 3
        assert health.pods_running == 10
        assert health.cpu_percent == 45.5

    def test_cluster_health_serialization(self) -> None:
        """Test ClusterHealth JSON serialization."""
        health = ClusterHealth(
            status=ClusterStatus.DEGRADED,
            nodes_ready=2,
            nodes_total=3,
            pods_running=8,
            pods_total=10,
            cpu_percent=75.0,
            memory_percent=80.0,
        )
        data = health.model_dump(by_alias=True)
        assert data["status"] == "degraded"
        assert data["nodesReady"] == 2
        assert data["cpuPercent"] == 75.0

    def test_cluster_status_enum_values(self) -> None:
        """Test ClusterStatus enum values."""
        assert ClusterStatus.HEALTHY.value == "healthy"
        assert ClusterStatus.DEGRADED.value == "degraded"
        assert ClusterStatus.CRITICAL.value == "critical"


class TestK8sNode:
    """Tests for K8sNode model."""

    def test_node_creation(self) -> None:
        """Test K8sNode creation."""
        node = K8sNode(
            name="node-1",
            status="Ready",
            roles=["control-plane", "master"],
            version="v1.28.0",
            cpu="4",
            memory="16Gi",
            pods=50,
            conditions=[
                NodeCondition(
                    type="Ready",
                    status="True",
                    reason="KubeletReady",
                    message="kubelet is ready",
                    last_transition=datetime.now().isoformat(),
                )
            ],
        )
        assert node.name == "node-1"
        assert node.status == "Ready"
        assert "control-plane" in node.roles
        assert len(node.conditions) == 1

    def test_node_with_capacity_and_usage(self) -> None:
        """Test K8sNode with capacity and usage info."""
        node = K8sNode(
            name="worker-1",
            status="Ready",
            roles=["worker"],
            version="v1.28.0",
            cpu="8",
            memory="32Gi",
            pods=110,
            capacity=NodeCapacity(cpu="8", memory="32Gi", pods=110),
            usage=NodeUsage(cpu_percent=60.0, memory_percent=75.0, pods_count=45),
            conditions=[],
        )
        assert node.capacity.cpu == "8"
        assert node.usage.cpu_percent == 60.0

    def test_node_serialization(self) -> None:
        """Test K8sNode JSON serialization with camelCase."""
        node = K8sNode(
            name="test-node",
            status="Ready",
            roles=["worker"],
            version="v1.28.0",
            cpu="4",
            memory="8Gi",
            pods=50,
            conditions=[],
        )
        data = node.model_dump()
        # Check camelCase conversion
        assert "name" in data
        assert "version" in data


class TestK8sPod:
    """Tests for K8sPod model."""

    def test_pod_creation(self) -> None:
        """Test K8sPod creation."""
        pod = K8sPod(
            name="my-app-abc123",
            namespace="default",
            status=PodStatus.RUNNING,
            node="worker-1",
            restarts=2,
            age="2d5h",
            containers=[
                Container(
                    name="app",
                    image="myapp:v1.0",
                    ready=True,
                    restart_count=2,
                    state=ContainerState.RUNNING,
                )
            ],
        )
        assert pod.name == "my-app-abc123"
        assert pod.status == PodStatus.RUNNING
        assert len(pod.containers) == 1
        assert pod.containers[0].ready is True

    def test_pod_status_enum(self) -> None:
        """Test PodStatus enum values."""
        assert PodStatus.RUNNING.value == "Running"
        assert PodStatus.PENDING.value == "Pending"
        assert PodStatus.FAILED.value == "Failed"
        assert PodStatus.SUCCEEDED.value == "Succeeded"
        assert PodStatus.UNKNOWN.value == "Unknown"

    def test_container_state_enum(self) -> None:
        """Test ContainerState enum values."""
        assert ContainerState.RUNNING.value == "running"
        assert ContainerState.WAITING.value == "waiting"
        assert ContainerState.TERMINATED.value == "terminated"


class TestK8sService:
    """Tests for K8sService model."""

    def test_service_creation(self) -> None:
        """Test K8sService creation."""
        service = K8sService(
            name="my-service",
            namespace="default",
            type="ClusterIP",
            cluster_ip="10.96.0.1",
            ports=[
                ServicePort(
                    name="http",
                    protocol="TCP",
                    port=80,
                    target_port=8080,
                )
            ],
            selector={"app": "my-app"},
        )
        assert service.name == "my-service"
        assert service.type == "ClusterIP"
        assert len(service.ports) == 1
        assert service.ports[0].port == 80

    def test_service_with_node_port(self) -> None:
        """Test K8sService with NodePort."""
        service = K8sService(
            name="node-service",
            namespace="default",
            type="NodePort",
            cluster_ip="10.96.0.2",
            ports=[
                ServicePort(
                    name="http",
                    protocol="TCP",
                    port=80,
                    target_port=8080,
                    node_port=30080,
                )
            ],
            selector={"app": "node-app"},
        )
        assert service.ports[0].node_port == 30080


class TestK8sIngress:
    """Tests for K8sIngress model."""

    def test_ingress_creation(self) -> None:
        """Test K8sIngress creation."""
        ingress = K8sIngress(
            name="my-ingress",
            namespace="default",
            hosts=["app.example.com"],
            paths=[
                IngressPath(
                    host="app.example.com",
                    path="/api",
                    service_name="api-service",
                    service_port=80,
                )
            ],
            tls=True,
        )
        assert ingress.name == "my-ingress"
        assert ingress.tls is True
        assert len(ingress.hosts) == 1


class TestCommandRequest:
    """Tests for CommandRequest model."""

    def test_command_request_creation(self) -> None:
        """Test CommandRequest creation."""
        req = CommandRequest(
            action="get",
            resource="pods",
            namespace="default",
            flags=["-o", "json"],
        )
        assert req.action == "get"
        assert req.resource == "pods"
        assert req.namespace == "default"
        assert "-o" in req.flags

    def test_command_request_without_namespace(self) -> None:
        """Test CommandRequest without namespace."""
        req = CommandRequest(
            action="get",
            resource="nodes",
        )
        assert req.namespace is None
        assert req.flags == []


class TestCommandResponse:
    """Tests for CommandResponse model."""

    def test_command_response_success(self) -> None:
        """Test successful CommandResponse."""
        resp = CommandResponse(
            output="NAME   READY   STATUS\npod-1  1/1     Running",
            exit_code=0,
            duration=150,
        )
        assert resp.output is not None
        assert resp.exit_code == 0
        assert resp.duration == 150

    def test_command_response_error(self) -> None:
        """Test error CommandResponse."""
        resp = CommandResponse(
            output="",
            exit_code=1,
            duration=50,
            error="Pod not found",
        )
        assert resp.exit_code == 1
        assert resp.error == "Pod not found"


class TestMetricsHistory:
    """Tests for MetricsHistory model."""

    def test_metrics_history_creation(self) -> None:
        """Test MetricsHistory creation."""
        history = MetricsHistory(
            timestamps=["2026-01-25T10:00:00Z", "2026-01-25T10:01:00Z"],
            cpu=[45.0, 48.0],
            memory=[60.0, 62.0],
        )
        assert len(history.timestamps) == 2
        assert len(history.cpu) == 2
        assert len(history.memory) == 2

    def test_metrics_datapoint(self) -> None:
        """Test MetricsDataPoint creation."""
        point = MetricsDataPoint(
            timestamp="2026-01-25T10:00:00Z",
            cpu_percent=55.5,
            memory_percent=70.2,
        )
        assert point.cpu_percent == 55.5
        assert point.memory_percent == 70.2


class TestHealthCheckResult:
    """Tests for HealthCheckResult model."""

    def test_health_check_result_pass(self) -> None:
        """Test passing health check result."""
        result = HealthCheckResult(
            status=HealthCheckStatus.PASS,
            message="DNS resolution working",
            duration=25,
        )
        assert result.status == HealthCheckStatus.PASS
        assert result.duration == 25

    def test_health_check_result_fail(self) -> None:
        """Test failing health check result."""
        result = HealthCheckResult(
            status=HealthCheckStatus.FAIL,
            message="etcd cluster unavailable",
            duration=5000,
        )
        assert result.status == HealthCheckStatus.FAIL

    def test_health_check_type_enum(self) -> None:
        """Test HealthCheckType enum values."""
        assert HealthCheckType.DNS.value == "dns"
        assert HealthCheckType.CONNECTIVITY.value == "connectivity"
        assert HealthCheckType.STORAGE.value == "storage"
        assert HealthCheckType.API_SERVER.value == "api-server"
        assert HealthCheckType.ETCD.value == "etcd"
        assert HealthCheckType.SCHEDULER.value == "scheduler"
        assert HealthCheckType.CONTROLLER.value == "controller"

    def test_health_check_status_enum(self) -> None:
        """Test HealthCheckStatus enum values."""
        assert HealthCheckStatus.PASS.value == "pass"
        assert HealthCheckStatus.FAIL.value == "fail"
        assert HealthCheckStatus.WARNING.value == "warning"
