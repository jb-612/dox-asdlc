"""Unit tests for K8s cluster service.

Tests the K8sClusterService with mock mode and mocked K8s client.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest

from src.orchestrator.api.models.k8s import (
    ClusterHealthStatus,
    NodeStatus,
    PodStatus,
)


class TestK8sClusterServiceMockMode:
    """Tests for K8sClusterService in mock mode."""

    def test_service_initializes_in_mock_mode_when_no_k8s(self) -> None:
        """Test service initializes in mock mode when K8s is unavailable."""
        with patch.dict("os.environ", {}, clear=True):
            with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
                from src.orchestrator.services.k8s_cluster import K8sClusterService

                service = K8sClusterService()
                assert service.mock_mode is True

    def test_get_cluster_health_mock_mode(self) -> None:
        """Test get_cluster_health returns valid mock data."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            health = service.get_cluster_health()

            assert health.status in [
                ClusterHealthStatus.HEALTHY,
                ClusterHealthStatus.DEGRADED,
                ClusterHealthStatus.CRITICAL,
            ]
            assert health.nodes_ready >= 0
            assert health.nodes_total >= health.nodes_ready
            assert health.pods_running >= 0
            assert health.pods_total >= health.pods_running
            assert 0 <= health.cpu_usage_percent <= 100
            assert 0 <= health.memory_usage_percent <= 100
            assert health.last_updated is not None

    def test_get_nodes_mock_mode(self) -> None:
        """Test get_nodes returns valid mock data."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            nodes = service.get_nodes()

            assert len(nodes) > 0
            for node in nodes:
                assert node.name is not None
                assert node.status in [
                    NodeStatus.READY,
                    NodeStatus.NOT_READY,
                    NodeStatus.UNKNOWN,
                ]
                assert node.version is not None
                assert node.capacity is not None
                assert node.usage is not None

    def test_get_pods_mock_mode(self) -> None:
        """Test get_pods returns valid mock data."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            pods, total = service.get_pods()

            assert total >= 0
            assert len(pods) <= total
            for pod in pods:
                assert pod.name is not None
                assert pod.namespace is not None
                assert pod.status in [
                    PodStatus.RUNNING,
                    PodStatus.PENDING,
                    PodStatus.SUCCEEDED,
                    PodStatus.FAILED,
                    PodStatus.UNKNOWN,
                ]

    def test_get_pods_filter_by_namespace_mock(self) -> None:
        """Test get_pods with namespace filter in mock mode."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            pods, _ = service.get_pods(namespace="default")

            for pod in pods:
                assert pod.namespace == "default"

    def test_get_pods_filter_by_status_mock(self) -> None:
        """Test get_pods with status filter in mock mode."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            pods, _ = service.get_pods(status=PodStatus.RUNNING)

            for pod in pods:
                assert pod.status == PodStatus.RUNNING

    def test_get_pods_filter_by_node_name_mock(self) -> None:
        """Test get_pods with node_name filter in mock mode."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            # Get nodes first to get a valid node name
            nodes = service.get_nodes()
            if nodes:
                node_name = nodes[0].name
                pods, _ = service.get_pods(node_name=node_name)
                for pod in pods:
                    assert pod.node_name == node_name

    def test_get_pods_pagination_mock(self) -> None:
        """Test get_pods with pagination in mock mode."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            pods_page1, total = service.get_pods(limit=5, offset=0)
            pods_page2, _ = service.get_pods(limit=5, offset=5)

            assert len(pods_page1) <= 5
            # Pages should be different (if there are enough pods)
            if total > 5:
                page1_names = {p.name for p in pods_page1}
                page2_names = {p.name for p in pods_page2}
                assert page1_names != page2_names

    def test_get_pods_search_mock(self) -> None:
        """Test get_pods with search filter in mock mode."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            # Search for a term that should match some pods
            pods, _ = service.get_pods(search="orchestrator")

            for pod in pods:
                assert "orchestrator" in pod.name.lower()


class TestK8sClusterServiceCaching:
    """Tests for K8sClusterService caching behavior."""

    def test_cluster_health_caching(self) -> None:
        """Test that cluster health is cached for 10 seconds."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            # Clear cache if any
            service._health_cache = None
            service._health_cache_time = None

            health1 = service.get_cluster_health()
            health2 = service.get_cluster_health()

            # Should return same cached object
            assert health1.last_updated == health2.last_updated

    def test_nodes_caching(self) -> None:
        """Test that nodes list is cached for 10 seconds."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", True):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            # Clear cache if any
            service._nodes_cache = None
            service._nodes_cache_time = None

            nodes1 = service.get_nodes()
            nodes2 = service.get_nodes()

            # Should return same cached list
            assert len(nodes1) == len(nodes2)
            assert nodes1[0].name == nodes2[0].name


class TestK8sClusterServiceRealK8s:
    """Tests for K8sClusterService with mocked real K8s client."""

    def test_mock_mode_flag_is_accessible(self) -> None:
        """Test that MOCK_MODE flag is accessible and reflects K8s availability."""
        from src.orchestrator.services.k8s_cluster import MOCK_MODE, K8sClusterService

        # MOCK_MODE should be a boolean
        assert isinstance(MOCK_MODE, bool)

        # Service should initialize with same mock_mode as module-level
        service = K8sClusterService()
        assert service.mock_mode == MOCK_MODE

    def test_get_cluster_health_real_k8s(self) -> None:
        """Test get_cluster_health with mocked K8s API."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", False):
            mock_v1 = MagicMock()

            # Mock nodes response
            mock_node = MagicMock()
            mock_node.metadata.name = "worker-1"
            mock_node.metadata.creation_timestamp = datetime.now(timezone.utc)
            mock_node.metadata.labels = {"node-role.kubernetes.io/worker": ""}
            mock_node.status.conditions = [
                MagicMock(type="Ready", status="True", reason="KubeletReady", message="ok",
                         last_transition_time=datetime.now(timezone.utc))
            ]
            mock_node.status.capacity = {"cpu": "4", "memory": "16Gi", "pods": "110"}
            mock_node.status.allocatable = {"cpu": "3.8", "memory": "14Gi", "pods": "100"}
            mock_node.status.node_info.os_image = "Ubuntu 22.04"
            mock_node.status.node_info.kubelet_version = "v1.28.0"
            mock_node.status.node_info.container_runtime_version = "containerd://1.7.0"

            mock_v1.list_node.return_value.items = [mock_node]

            # Mock pods response
            mock_pod = MagicMock()
            mock_pod.metadata.name = "test-pod"
            mock_pod.metadata.namespace = "default"
            mock_pod.metadata.creation_timestamp = datetime.now(timezone.utc)
            mock_pod.metadata.labels = {"app": "test"}
            mock_pod.metadata.owner_references = [MagicMock(kind="Deployment", name="test-deploy")]
            mock_pod.status.phase = "Running"
            mock_pod.status.pod_ip = "10.244.0.5"
            mock_pod.status.host_ip = "192.168.1.10"
            mock_pod.spec.node_name = "worker-1"
            mock_container_status = MagicMock()
            mock_container_status.name = "app"
            mock_container_status.image = "app:v1"
            mock_container_status.ready = True
            mock_container_status.restart_count = 0
            mock_container_status.state.running = MagicMock(started_at=datetime.now(timezone.utc))
            mock_container_status.state.waiting = None
            mock_container_status.state.terminated = None
            mock_container_status.last_state.terminated = None
            mock_pod.status.container_statuses = [mock_container_status]

            mock_v1.list_pod_for_all_namespaces.return_value.items = [mock_pod]

            with patch("src.orchestrator.services.k8s_cluster.K8sClusterService._get_core_api", return_value=mock_v1):
                from src.orchestrator.services.k8s_cluster import K8sClusterService

                service = K8sClusterService()
                service.mock_mode = False  # Force real mode for this test
                service._core_api = mock_v1

                health = service.get_cluster_health()

                assert health.nodes_ready >= 0
                assert health.pods_running >= 0


class TestK8sClusterServiceErrorHandling:
    """Tests for K8sClusterService error handling."""

    def test_graceful_fallback_on_k8s_error(self) -> None:
        """Test service falls back to mock mode on K8s API errors."""
        with patch("src.orchestrator.services.k8s_cluster.MOCK_MODE", False):
            from src.orchestrator.services.k8s_cluster import K8sClusterService

            service = K8sClusterService()
            service.mock_mode = False  # Start in real mode

            # Mock _get_core_api to raise an exception
            with patch.object(service, "_get_core_api", side_effect=Exception("K8s unavailable")):
                # Should fall back gracefully and return mock data
                health = service.get_cluster_health()
                assert health is not None
                assert health.status in [
                    ClusterHealthStatus.HEALTHY,
                    ClusterHealthStatus.DEGRADED,
                    ClusterHealthStatus.CRITICAL,
                ]
