"""GraphStore protocol for graph storage backends.

Defines the interface for graph storage operations that can be implemented
by different backends (Redis, Neo4j, etc.).
"""

from __future__ import annotations

from typing import Protocol


class GraphStore(Protocol):
    """Protocol for graph storage backends.

    This protocol defines the interface for storing and querying
    correlation graphs. Implementations can use Redis (default),
    Neo4j, or other graph storage solutions.

    Key patterns for Redis implementation:
    - GRAPH:NODE:{node_id} -> Hash with node properties
    - GRAPH:EDGE:{from_id}:{to_id}:{edge_type} -> Hash with edge properties
    - GRAPH:NEIGHBORS:{node_id}:{edge_type} -> Set of connected node IDs
    - GRAPH:ALL_NODES -> Set of all node IDs
    """

    async def add_node(self, node_id: str, properties: dict) -> None:
        """Add or update a node.

        Args:
            node_id: Unique identifier for the node.
            properties: Dictionary of node properties to store.
        """
        ...

    async def add_edge(
        self,
        from_id: str,
        to_id: str,
        edge_type: str,
        properties: dict | None = None,
    ) -> None:
        """Add an edge between nodes.

        Creates a bidirectional edge between two nodes. Edge properties
        are stored if provided.

        Args:
            from_id: Source node ID.
            to_id: Target node ID.
            edge_type: Type of edge (e.g., "similar", "related", "contradicts").
            properties: Optional dictionary of edge properties.
        """
        ...

    async def remove_edge(
        self,
        from_id: str,
        to_id: str,
        edge_type: str,
    ) -> bool:
        """Remove an edge.

        Removes the edge in both directions and deletes any associated properties.

        Args:
            from_id: Source node ID.
            to_id: Target node ID.
            edge_type: Type of edge to remove.

        Returns:
            True if the edge existed and was removed, False otherwise.
        """
        ...

    async def get_neighbors(
        self,
        node_id: str,
        edge_type: str | None = None,
    ) -> list[str]:
        """Get directly connected node IDs.

        Args:
            node_id: The node to get neighbors for.
            edge_type: Optional edge type filter. If None, returns
                      neighbors across all edge types.

        Returns:
            List of neighbor node IDs.
        """
        ...

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
            List of edge dictionaries containing source, target,
            edge_type, and any stored properties.
        """
        ...

    async def get_graph(
        self,
        node_ids: list[str] | None = None,
    ) -> tuple[list[dict], list[dict]]:
        """Get full graph data for visualization.

        Args:
            node_ids: Optional list of node IDs to include. If None,
                     returns the entire graph.

        Returns:
            Tuple of (nodes, edges) where:
            - nodes: List of node dicts with id and properties
            - edges: List of edge dicts with source, target, edge_type, and properties
        """
        ...

    async def delete_node(self, node_id: str) -> None:
        """Delete a node and all its edges.

        Removes the node from the graph along with all edges
        connected to it.

        Args:
            node_id: The ID of the node to delete.
        """
        ...
