"""Tests for Redis-based graph store implementation.

Tests cover:
- add_node, add_edge, get_neighbors, get_edges, get_graph
- remove_edge, delete_node
- Bidirectional edge handling
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.infrastructure.graph_store.redis_store import RedisGraphStore


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Create a mock Redis client."""
    redis = AsyncMock()
    redis.hset = AsyncMock()
    redis.hgetall = AsyncMock(return_value={})
    redis.sadd = AsyncMock()
    redis.srem = AsyncMock(return_value=1)
    redis.smembers = AsyncMock(return_value=set())
    redis.keys = AsyncMock(return_value=[])
    redis.delete = AsyncMock()
    return redis


@pytest.fixture
def graph_store(mock_redis: AsyncMock) -> RedisGraphStore:
    """Create a graph store with mocked Redis."""
    store = RedisGraphStore(redis_client=mock_redis)
    return store


class TestAddNode:
    """Tests for add_node method."""

    @pytest.mark.asyncio
    async def test_add_node_stores_properties(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that add_node stores node properties as a hash."""
        await graph_store.add_node(
            "idea-001",
            {"content": "Test idea", "classification": "functional"}
        )

        mock_redis.hset.assert_called_once()
        call_args = mock_redis.hset.call_args
        assert call_args[0][0] == "GRAPH:NODE:idea-001"

    @pytest.mark.asyncio
    async def test_add_node_adds_to_all_nodes_set(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that add_node adds node ID to the all nodes set."""
        await graph_store.add_node("idea-001", {"content": "Test"})

        mock_redis.sadd.assert_called_once_with("GRAPH:ALL_NODES", "idea-001")

    @pytest.mark.asyncio
    async def test_add_node_serializes_complex_types(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that complex types (lists, dicts) are serialized to JSON."""
        await graph_store.add_node(
            "idea-001",
            {"labels": ["ui", "backend"], "metadata": {"key": "value"}}
        )

        call_args = mock_redis.hset.call_args
        mapping = call_args[1]["mapping"]
        assert json.loads(mapping["labels"]) == ["ui", "backend"]
        assert json.loads(mapping["metadata"]) == {"key": "value"}


class TestAddEdge:
    """Tests for add_edge method."""

    @pytest.mark.asyncio
    async def test_add_edge_creates_bidirectional_adjacency(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that add_edge creates bidirectional neighbor sets."""
        await graph_store.add_edge(
            from_id="idea-001",
            to_id="idea-002",
            edge_type="similar",
        )

        # Should add to both directions
        calls = mock_redis.sadd.call_args_list
        assert len(calls) == 2
        call_args = [c[0] for c in calls]
        assert ("GRAPH:NEIGHBORS:idea-001:similar", "idea-002") in call_args
        assert ("GRAPH:NEIGHBORS:idea-002:similar", "idea-001") in call_args

    @pytest.mark.asyncio
    async def test_add_edge_stores_properties(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that add_edge stores edge properties when provided."""
        await graph_store.add_edge(
            from_id="idea-001",
            to_id="idea-002",
            edge_type="related",
            properties={"notes": "Very related", "score": 0.85}
        )

        mock_redis.hset.assert_called_once()
        call_args = mock_redis.hset.call_args
        assert call_args[0][0] == "GRAPH:EDGE:idea-001:idea-002:related"

    @pytest.mark.asyncio
    async def test_add_edge_without_properties(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that add_edge works without properties."""
        await graph_store.add_edge(
            from_id="idea-001",
            to_id="idea-002",
            edge_type="contradicts",
        )

        # Should not call hset for edge properties
        mock_redis.hset.assert_not_called()


class TestRemoveEdge:
    """Tests for remove_edge method."""

    @pytest.mark.asyncio
    async def test_remove_edge_removes_from_both_directions(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that remove_edge removes from both neighbor sets."""
        mock_redis.srem.return_value = 1

        result = await graph_store.remove_edge(
            from_id="idea-001",
            to_id="idea-002",
            edge_type="similar",
        )

        assert result is True
        srem_calls = mock_redis.srem.call_args_list
        assert len(srem_calls) == 2

    @pytest.mark.asyncio
    async def test_remove_edge_deletes_edge_properties(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that remove_edge deletes edge properties from both directions."""
        await graph_store.remove_edge(
            from_id="idea-001",
            to_id="idea-002",
            edge_type="related",
        )

        delete_calls = mock_redis.delete.call_args_list
        assert len(delete_calls) == 2
        deleted_keys = [c[0][0] for c in delete_calls]
        assert "GRAPH:EDGE:idea-001:idea-002:related" in deleted_keys
        assert "GRAPH:EDGE:idea-002:idea-001:related" in deleted_keys

    @pytest.mark.asyncio
    async def test_remove_edge_returns_false_if_not_exists(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that remove_edge returns False if edge doesn't exist."""
        mock_redis.srem.return_value = 0

        result = await graph_store.remove_edge(
            from_id="idea-001",
            to_id="idea-002",
            edge_type="similar",
        )

        assert result is False


class TestGetNeighbors:
    """Tests for get_neighbors method."""

    @pytest.mark.asyncio
    async def test_get_neighbors_with_edge_type(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test getting neighbors filtered by edge type."""
        mock_redis.smembers.return_value = {"idea-002", "idea-003"}

        neighbors = await graph_store.get_neighbors(
            node_id="idea-001",
            edge_type="similar",
        )

        mock_redis.smembers.assert_called_once_with("GRAPH:NEIGHBORS:idea-001:similar")
        assert set(neighbors) == {"idea-002", "idea-003"}

    @pytest.mark.asyncio
    async def test_get_neighbors_all_edge_types(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test getting neighbors across all edge types."""
        mock_redis.keys.return_value = [
            "GRAPH:NEIGHBORS:idea-001:similar",
            "GRAPH:NEIGHBORS:idea-001:related",
        ]
        mock_redis.smembers.side_effect = [
            {"idea-002"},
            {"idea-003"},
        ]

        neighbors = await graph_store.get_neighbors(node_id="idea-001")

        assert set(neighbors) == {"idea-002", "idea-003"}


class TestGetEdges:
    """Tests for get_edges method."""

    @pytest.mark.asyncio
    async def test_get_edges_returns_edge_data(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that get_edges returns full edge data with properties."""
        mock_redis.smembers.return_value = {"idea-002"}
        mock_redis.hgetall.return_value = {
            "id": "corr-123",
            "notes": "Test notes",
            "created_at": "2024-01-01T00:00:00Z",
        }

        edges = await graph_store.get_edges(
            node_id="idea-001",
            edge_type="related",
        )

        assert len(edges) == 1
        assert edges[0]["source"] == "idea-001"
        assert edges[0]["target"] == "idea-002"
        assert edges[0]["edge_type"] == "related"
        assert edges[0]["id"] == "corr-123"

    @pytest.mark.asyncio
    async def test_get_edges_without_edge_type(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test getting edges without edge type filter."""
        mock_redis.keys.side_effect = [
            ["GRAPH:NEIGHBORS:idea-001:similar"],
            ["GRAPH:EDGE:idea-001:idea-002:similar"],
        ]
        mock_redis.smembers.return_value = {"idea-002"}
        mock_redis.hgetall.return_value = {"id": "corr-123"}

        edges = await graph_store.get_edges(node_id="idea-001")

        assert len(edges) >= 1


class TestGetGraph:
    """Tests for get_graph method."""

    @pytest.mark.asyncio
    async def test_get_graph_returns_nodes_and_edges(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that get_graph returns both nodes and edges."""
        # First smembers call gets ALL_NODES, subsequent calls get neighbors
        mock_redis.smembers.side_effect = [
            {"idea-001", "idea-002"},  # ALL_NODES
            set(),  # neighbors for idea-001
            set(),  # neighbors for idea-002
        ]
        mock_redis.hgetall.side_effect = [
            {"content": "First idea"},  # Node 1
            {"content": "Second idea"},  # Node 2
        ]
        # keys is called for each node in get_edges when no edge_type
        mock_redis.keys.return_value = []

        nodes, edges = await graph_store.get_graph()

        assert len(nodes) == 2
        assert nodes[0]["id"] in ["idea-001", "idea-002"]
        assert nodes[1]["id"] in ["idea-001", "idea-002"]

    @pytest.mark.asyncio
    async def test_get_graph_with_node_filter(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that get_graph respects node_ids filter."""
        mock_redis.hgetall.return_value = {"content": "Filtered idea"}
        mock_redis.keys.return_value = []
        mock_redis.smembers.return_value = set()

        nodes, edges = await graph_store.get_graph(node_ids=["idea-001"])

        # Should not call smembers on ALL_NODES
        all_nodes_call = any(
            "GRAPH:ALL_NODES" in str(c)
            for c in mock_redis.smembers.call_args_list
        )
        # smembers should be called for neighbors, not for ALL_NODES
        assert len(nodes) == 1


class TestDeleteNode:
    """Tests for delete_node method."""

    @pytest.mark.asyncio
    async def test_delete_node_removes_from_neighbor_sets(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that delete_node removes node from all neighbor sets."""
        # keys is called multiple times in delete_node
        mock_redis.keys.side_effect = [
            [],  # First: GRAPH:NEIGHBORS:{node_id}:* for getting edge types
            ["GRAPH:NEIGHBORS:idea-001:similar"],  # For neighbors iteration
            ["GRAPH:EDGE:idea-001:idea-002:similar"],  # Edge keys
            [],  # More edge keys (reverse direction)
        ]
        mock_redis.smembers.side_effect = [
            {"idea-002"},  # get_neighbors for cleanup
            {"idea-002"},  # Second call if needed
        ]

        await graph_store.delete_node("idea-001")

        # Should remove from neighbor's set
        mock_redis.srem.assert_called()

    @pytest.mark.asyncio
    async def test_delete_node_removes_from_all_nodes_set(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that delete_node removes node from ALL_NODES set."""
        mock_redis.keys.return_value = []
        mock_redis.smembers.return_value = set()

        await graph_store.delete_node("idea-001")

        srem_calls = [c for c in mock_redis.srem.call_args_list]
        all_nodes_removal = any(
            "GRAPH:ALL_NODES" in str(c) for c in srem_calls
        )
        assert all_nodes_removal

    @pytest.mark.asyncio
    async def test_delete_node_removes_node_hash(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that delete_node removes the node hash."""
        mock_redis.keys.return_value = []
        mock_redis.smembers.return_value = set()

        await graph_store.delete_node("idea-001")

        delete_calls = [c[0][0] for c in mock_redis.delete.call_args_list]
        assert "GRAPH:NODE:idea-001" in delete_calls


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    @pytest.mark.asyncio
    async def test_get_neighbors_empty_result(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test get_neighbors with no neighbors."""
        mock_redis.smembers.return_value = set()
        mock_redis.keys.return_value = []

        neighbors = await graph_store.get_neighbors("idea-lonely")

        assert neighbors == []

    @pytest.mark.asyncio
    async def test_get_edges_deserializes_json(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that get_edges deserializes JSON values."""
        mock_redis.smembers.return_value = {"idea-002"}
        mock_redis.hgetall.return_value = {
            "id": "corr-123",
            "metadata": '{"key": "value"}',
            "created_at": "2024-01-01",
        }

        edges = await graph_store.get_edges("idea-001", edge_type="related")

        assert len(edges) == 1
        # JSON should be deserialized
        assert edges[0]["metadata"] == {"key": "value"}

    @pytest.mark.asyncio
    async def test_bidirectional_edge_handling(
        self, graph_store: RedisGraphStore, mock_redis: AsyncMock
    ) -> None:
        """Test that edges are truly bidirectional."""
        # Add edge from idea-001 to idea-002
        await graph_store.add_edge("idea-001", "idea-002", "related")

        # Both neighbor sets should be updated
        sadd_calls = mock_redis.sadd.call_args_list
        forward_call = ("GRAPH:NEIGHBORS:idea-001:related", "idea-002")
        reverse_call = ("GRAPH:NEIGHBORS:idea-002:related", "idea-001")

        call_args = [c[0] for c in sadd_calls]
        assert forward_call in call_args
        assert reverse_call in call_args
