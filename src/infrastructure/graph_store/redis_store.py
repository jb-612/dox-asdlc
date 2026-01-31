"""Redis-based graph store implementation.

Stores correlation graph in Redis using sets and hashes for efficient
neighbor lookups and edge property storage.

Key patterns:
- GRAPH:NODE:{node_id} -> Hash with node properties
- GRAPH:EDGE:{from_id}:{to_id}:{edge_type} -> Hash with edge properties
- GRAPH:NEIGHBORS:{node_id}:{edge_type} -> Set of connected node IDs
- GRAPH:ALL_NODES -> Set of all node IDs
"""

from __future__ import annotations

import json
import os
from typing import Any

from redis.asyncio import Redis


class RedisGraphStore:
    """Store correlation graph in Redis using sets and hashes.

    This implementation uses Redis data structures to provide efficient
    graph operations:
    - Nodes are stored as hashes for property access
    - Edges use bidirectional adjacency sets for O(1) neighbor lookups
    - Edge properties are stored in separate hashes

    Example:
        store = RedisGraphStore()
        await store.add_node("idea-001", {"content": "My idea"})
        await store.add_edge("idea-001", "idea-002", "similar", {"score": 0.85})
        neighbors = await store.get_neighbors("idea-001", edge_type="similar")
    """

    def __init__(self, redis_client: Redis | None = None) -> None:
        """Initialize the Redis graph store.

        Args:
            redis_client: Optional Redis client. If not provided,
                         will be created lazily using REDIS_URL env var.
        """
        self._redis = redis_client

    async def _get_redis(self) -> Redis:
        """Get the Redis client, creating it lazily if needed.

        Returns:
            Redis: The async Redis client.
        """
        if self._redis is None:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            self._redis = Redis.from_url(redis_url, decode_responses=True)
        return self._redis

    def _serialize_value(self, value: Any) -> str:
        """Serialize a value for Redis storage.

        Args:
            value: Value to serialize.

        Returns:
            String representation suitable for Redis.
        """
        if isinstance(value, (list, dict)):
            return json.dumps(value)
        return str(value)

    def _deserialize_value(self, value: str) -> Any:
        """Deserialize a value from Redis.

        Args:
            value: String value from Redis.

        Returns:
            Deserialized value (dict/list if JSON, otherwise string).
        """
        if value.startswith(("[", "{")):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return value

    async def add_node(self, node_id: str, properties: dict) -> None:
        """Add or update a node.

        Args:
            node_id: Unique identifier for the node.
            properties: Dictionary of node properties to store.
        """
        redis = await self._get_redis()
        await redis.hset(
            f"GRAPH:NODE:{node_id}",
            mapping={k: self._serialize_value(v) for k, v in properties.items()},
        )
        await redis.sadd("GRAPH:ALL_NODES", node_id)

    async def add_edge(
        self,
        from_id: str,
        to_id: str,
        edge_type: str,
        properties: dict | None = None,
    ) -> None:
        """Add an edge between nodes.

        Creates bidirectional adjacency for efficient neighbor lookups.

        Args:
            from_id: Source node ID.
            to_id: Target node ID.
            edge_type: Type of edge.
            properties: Optional edge properties.
        """
        redis = await self._get_redis()
        # Bidirectional adjacency
        await redis.sadd(f"GRAPH:NEIGHBORS:{from_id}:{edge_type}", to_id)
        await redis.sadd(f"GRAPH:NEIGHBORS:{to_id}:{edge_type}", from_id)
        # Store edge properties
        if properties:
            edge_key = f"GRAPH:EDGE:{from_id}:{to_id}:{edge_type}"
            await redis.hset(
                edge_key,
                mapping={k: self._serialize_value(v) for k, v in properties.items()},
            )

    async def remove_edge(
        self,
        from_id: str,
        to_id: str,
        edge_type: str,
    ) -> bool:
        """Remove an edge.

        Args:
            from_id: Source node ID.
            to_id: Target node ID.
            edge_type: Type of edge.

        Returns:
            True if edge existed and was removed, False otherwise.
        """
        redis = await self._get_redis()
        removed = await redis.srem(f"GRAPH:NEIGHBORS:{from_id}:{edge_type}", to_id)
        await redis.srem(f"GRAPH:NEIGHBORS:{to_id}:{edge_type}", from_id)
        await redis.delete(f"GRAPH:EDGE:{from_id}:{to_id}:{edge_type}")
        await redis.delete(f"GRAPH:EDGE:{to_id}:{from_id}:{edge_type}")
        return removed > 0

    async def get_neighbors(
        self,
        node_id: str,
        edge_type: str | None = None,
    ) -> list[str]:
        """Get directly connected node IDs.

        Args:
            node_id: The node to get neighbors for.
            edge_type: Optional edge type filter.

        Returns:
            List of neighbor node IDs.
        """
        redis = await self._get_redis()
        if edge_type:
            members = await redis.smembers(f"GRAPH:NEIGHBORS:{node_id}:{edge_type}")
            return list(members)
        # Get all edge types
        keys = await redis.keys(f"GRAPH:NEIGHBORS:{node_id}:*")
        neighbors: set[str] = set()
        for key in keys:
            members = await redis.smembers(key)
            neighbors.update(members)
        return list(neighbors)

    async def get_edges(
        self,
        node_id: str,
        edge_type: str | None = None,
    ) -> list[dict]:
        """Get edges with properties for a node.

        Args:
            node_id: The node to get edges for.
            edge_type: Optional edge type filter.

        Returns:
            List of edge dictionaries.
        """
        redis = await self._get_redis()
        edges: list[dict] = []
        neighbors = await self.get_neighbors(node_id, edge_type)

        for neighbor_id in neighbors:
            # Try both directions for edge properties
            edge_found = False
            for from_id, to_id in [(node_id, neighbor_id), (neighbor_id, node_id)]:
                if edge_type:
                    edge_key = f"GRAPH:EDGE:{from_id}:{to_id}:{edge_type}"
                    props = await redis.hgetall(edge_key)
                    if props:
                        edges.append(
                            {
                                "source": node_id,
                                "target": neighbor_id,
                                "edge_type": edge_type,
                                **{
                                    k: self._deserialize_value(v)
                                    for k, v in props.items()
                                },
                            }
                        )
                        edge_found = True
                        break
                else:
                    # Check all edge types
                    keys = await redis.keys(f"GRAPH:EDGE:{from_id}:{to_id}:*")
                    for key in keys:
                        et = key.split(":")[-1]
                        props = await redis.hgetall(key)
                        edges.append(
                            {
                                "source": node_id,
                                "target": neighbor_id,
                                "edge_type": et,
                                **{
                                    k: self._deserialize_value(v)
                                    for k, v in props.items()
                                },
                            }
                        )
                        edge_found = True
                    if edge_found:
                        break

            # If no edge properties found, still add basic edge info
            if not edge_found and edge_type:
                edges.append(
                    {
                        "source": node_id,
                        "target": neighbor_id,
                        "edge_type": edge_type,
                    }
                )

        return edges

    async def get_graph(
        self,
        node_ids: list[str] | None = None,
    ) -> tuple[list[dict], list[dict]]:
        """Get full graph data for visualization.

        Args:
            node_ids: Optional list of node IDs to include.

        Returns:
            Tuple of (nodes, edges).
        """
        redis = await self._get_redis()
        # Get all nodes or filtered
        if node_ids is None:
            node_ids = list(await redis.smembers("GRAPH:ALL_NODES"))

        nodes: list[dict] = []
        for node_id in node_ids:
            props = await redis.hgetall(f"GRAPH:NODE:{node_id}")
            if props:
                nodes.append(
                    {
                        "id": node_id,
                        **{k: self._deserialize_value(v) for k, v in props.items()},
                    }
                )

        # Get all edges between these nodes
        edges: list[dict] = []
        seen_edges: set[str] = set()
        for node_id in node_ids:
            for edge in await self.get_edges(node_id):
                edge_key = f"{edge['source']}:{edge['target']}:{edge['edge_type']}"
                reverse_key = f"{edge['target']}:{edge['source']}:{edge['edge_type']}"
                if edge_key not in seen_edges and reverse_key not in seen_edges:
                    if edge["source"] in node_ids and edge["target"] in node_ids:
                        edges.append(edge)
                        seen_edges.add(edge_key)

        return nodes, edges

    async def delete_node(self, node_id: str) -> None:
        """Delete a node and all its edges.

        Args:
            node_id: The ID of the node to delete.
        """
        redis = await self._get_redis()
        # Get all neighbors to clean up reverse edges
        neighbors = await self.get_neighbors(node_id)
        keys = await redis.keys(f"GRAPH:NEIGHBORS:{node_id}:*")

        for key in keys:
            edge_type = key.split(":")[-1]
            for neighbor in neighbors:
                await redis.srem(f"GRAPH:NEIGHBORS:{neighbor}:{edge_type}", node_id)
            await redis.delete(key)

        # Remove node hash
        await redis.delete(f"GRAPH:NODE:{node_id}")

        # Remove edges involving this node
        edge_keys = await redis.keys(f"GRAPH:EDGE:{node_id}:*")
        reverse_edge_keys = await redis.keys(f"GRAPH:EDGE:*:{node_id}:*")
        for key in edge_keys + reverse_edge_keys:
            await redis.delete(key)

        # Remove from all nodes set
        await redis.srem("GRAPH:ALL_NODES", node_id)


# Global singleton instance
_graph_store: RedisGraphStore | None = None


def get_graph_store() -> RedisGraphStore:
    """Get the global graph store instance.

    Returns:
        RedisGraphStore: The singleton graph store instance.
    """
    global _graph_store
    if _graph_store is None:
        _graph_store = RedisGraphStore()
    return _graph_store
