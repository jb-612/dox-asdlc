"""GraphStore infrastructure for graph storage backends.

Provides a protocol for graph storage and Redis-based implementation
for storing correlation graphs in the Brainflare Hub.
"""

from src.infrastructure.graph_store.protocol import GraphStore
from src.infrastructure.graph_store.redis_store import RedisGraphStore, get_graph_store

__all__ = ["GraphStore", "RedisGraphStore", "get_graph_store"]
