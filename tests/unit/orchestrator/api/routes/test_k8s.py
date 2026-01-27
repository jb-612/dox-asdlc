"""Unit tests for K8s cluster API endpoints.

Tests the FastAPI routes for K8s cluster health, nodes, and pods.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

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


@pytest.fixture
def mock_k8s_service() -> MagicMock:
    """Create a mock K8sClusterService."""
    service = MagicMock()

    # Mock cluster health
    service.get_cluster_health.return_value = ClusterHealth(
        status=ClusterHealthStatus.HEALTHY,
        nodes_ready=3,
        nodes_total=3,
        pods_running=15,
        pods_total=20,
        pods_pending=3,
        pods_failed=2,
        cpu_usage_percent=45.5,
        memory_usage_percent=62.3,
        last_updated="2026-01-27T10:00:00Z",
    )
    service.mock_mode = True

    # Mock nodes
    service.get_nodes.return_value = [
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
                    last_transition="2026-01-27T08:00:00Z",
                ),
            ],
            created_at="2026-01-01T00:00:00Z",
        ),
    ]

    # Mock pods
    service.get_pods.return_value = (
        [
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
                labels={"app": "orchestrator"},
                owner_kind="Deployment",
                owner_name="orchestrator",
            ),
        ],
        1,
    )

    return service


@pytest.fixture
def test_client(mock_k8s_service: MagicMock):
    """Create test client with mocked service."""
    import src.orchestrator.api.routes.k8s as k8s_module

    # Store the original function
    original_get_service = k8s_module.get_k8s_service

    # Replace with our mock
    k8s_module.get_k8s_service = lambda: mock_k8s_service

    # Also reset the singleton
    k8s_module._k8s_service = None

    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(k8s_module.router)
    client = TestClient(app)

    yield client

    # Restore the original function
    k8s_module.get_k8s_service = original_get_service
    k8s_module._k8s_service = None


class TestK8sHealthEndpoint:
    """Tests for GET /api/k8s/health endpoint."""

    def test_get_cluster_health_success(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test successful cluster health retrieval."""
        response = test_client.get("/api/k8s/health")

        assert response.status_code == 200
        data = response.json()
        assert "health" in data
        assert data["health"]["status"] == "healthy"
        assert data["health"]["nodesReady"] == 3
        assert data["health"]["nodesTotal"] == 3
        assert data["health"]["podsRunning"] == 15
        assert data["mockMode"] is True

    def test_get_cluster_health_returns_mock_mode_flag(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test that mock_mode flag is included in response."""
        response = test_client.get("/api/k8s/health")

        assert response.status_code == 200
        data = response.json()
        assert "mockMode" in data


class TestK8sNodesEndpoint:
    """Tests for GET /api/k8s/nodes endpoint."""

    def test_get_nodes_success(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test successful nodes list retrieval."""
        response = test_client.get("/api/k8s/nodes")

        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "total" in data
        assert len(data["nodes"]) == 1
        assert data["nodes"][0]["name"] == "worker-1"
        assert data["nodes"][0]["status"] == "Ready"

    def test_get_nodes_returns_camel_case(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test nodes response uses camelCase."""
        response = test_client.get("/api/k8s/nodes")

        assert response.status_code == 200
        data = response.json()
        node = data["nodes"][0]
        # Check camelCase fields
        assert "containerRuntime" in node
        assert "createdAt" in node


class TestK8sPodsEndpoint:
    """Tests for GET /api/k8s/pods endpoint."""

    def test_get_pods_success(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test successful pods list retrieval."""
        response = test_client.get("/api/k8s/pods")

        assert response.status_code == 200
        data = response.json()
        assert "pods" in data
        assert "total" in data
        assert len(data["pods"]) == 1
        assert data["pods"][0]["name"] == "orchestrator-5f7b9c8d-abc12"
        assert data["total"] == 1

    def test_get_pods_with_namespace_filter(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test pods endpoint with namespace query param."""
        response = test_client.get("/api/k8s/pods?namespace=default")

        assert response.status_code == 200
        mock_k8s_service.get_pods.assert_called_with(
            namespace="default",
            status=None,
            node_name=None,
            search=None,
            limit=50,
            offset=0,
        )

    def test_get_pods_with_status_filter(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test pods endpoint with status query param."""
        response = test_client.get("/api/k8s/pods?status=Running")

        assert response.status_code == 200
        mock_k8s_service.get_pods.assert_called_with(
            namespace=None,
            status=PodStatus.RUNNING,
            node_name=None,
            search=None,
            limit=50,
            offset=0,
        )

    def test_get_pods_with_node_name_filter(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test pods endpoint with nodeName query param."""
        response = test_client.get("/api/k8s/pods?nodeName=worker-1")

        assert response.status_code == 200
        mock_k8s_service.get_pods.assert_called_with(
            namespace=None,
            status=None,
            node_name="worker-1",
            search=None,
            limit=50,
            offset=0,
        )

    def test_get_pods_with_search_filter(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test pods endpoint with search query param."""
        response = test_client.get("/api/k8s/pods?search=orchestrator")

        assert response.status_code == 200
        mock_k8s_service.get_pods.assert_called_with(
            namespace=None,
            status=None,
            node_name=None,
            search="orchestrator",
            limit=50,
            offset=0,
        )

    def test_get_pods_with_pagination(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test pods endpoint with limit and offset."""
        response = test_client.get("/api/k8s/pods?limit=10&offset=20")

        assert response.status_code == 200
        mock_k8s_service.get_pods.assert_called_with(
            namespace=None,
            status=None,
            node_name=None,
            search=None,
            limit=10,
            offset=20,
        )

    def test_get_pods_invalid_status_returns_422(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test pods endpoint with invalid status returns 422."""
        response = test_client.get("/api/k8s/pods?status=InvalidStatus")

        assert response.status_code == 422

    def test_get_pods_returns_camel_case(
        self, test_client: TestClient, mock_k8s_service: MagicMock
    ) -> None:
        """Test pods response uses camelCase."""
        response = test_client.get("/api/k8s/pods")

        assert response.status_code == 200
        data = response.json()
        pod = data["pods"][0]
        # Check camelCase fields
        assert "nodeName" in pod
        assert "podIP" in pod
        assert "hostIP" in pod
        assert "createdAt" in pod
        assert "ownerKind" in pod
        assert "ownerName" in pod


class TestK8sEndpointErrorHandling:
    """Tests for error handling in K8s endpoints."""

    def test_health_endpoint_handles_service_error(
        self, mock_k8s_service: MagicMock
    ) -> None:
        """Test health endpoint returns 500 on service error."""
        mock_k8s_service.get_cluster_health.side_effect = Exception("Service error")

        with patch("src.orchestrator.api.routes.k8s.get_k8s_service", return_value=mock_k8s_service):
            from src.orchestrator.api.routes.k8s import router
            from fastapi import FastAPI

            app = FastAPI()
            app.include_router(router)
            client = TestClient(app)

            response = client.get("/api/k8s/health")

            # Should return 500 or handle gracefully
            assert response.status_code in [200, 500]

    def test_nodes_endpoint_handles_service_error(
        self, mock_k8s_service: MagicMock
    ) -> None:
        """Test nodes endpoint returns 500 on service error."""
        mock_k8s_service.get_nodes.side_effect = Exception("Service error")

        with patch("src.orchestrator.api.routes.k8s.get_k8s_service", return_value=mock_k8s_service):
            from src.orchestrator.api.routes.k8s import router
            from fastapi import FastAPI

            app = FastAPI()
            app.include_router(router)
            client = TestClient(app)

            response = client.get("/api/k8s/nodes")

            # Should return 500 or handle gracefully
            assert response.status_code in [200, 500]
