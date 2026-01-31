# P08-F04: Correlation Engine - Technical Design

## Overview

Implement a correlation engine that uses vector similarity and graph-based relationships to find similar, complementary, or duplicate ideas. The engine enables fast extraction of related ideas and provides suggestions that users can accept, reject, or refine.

### Problem Statement

As the Ideas Repository grows, several challenges emerge:
- Duplicate ideas are submitted without awareness of existing similar ones
- Related ideas that could be combined remain disconnected
- Discovering complementary ideas requires manual search
- No way to visualize idea clusters or relationships

### Solution

A correlation engine that:
1. Uses vector similarity to find semantically similar ideas
2. Maintains a graph of explicit relationships between ideas
3. Suggests correlations for user review
4. Supports accept/reject/refine workflow for suggestions
5. Enables graph visualization of idea clusters
6. Provides fast extraction via pre-computed similarity caches

## Dependencies

### Internal Dependencies

| Feature | Purpose | Status |
|---------|---------|--------|
| P08-F01 | Ideas Repository Core (embeddings, storage) | Required |
| P01-F03 | KnowledgeStore (vector search) | Complete |
| P02-F04 | Elasticsearch with kNN | Complete |

### External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| elasticsearch | ^8.11.0 | Vector similarity search |
| redis | ^5.0.0 | Relationship cache, graph adjacency (default backend) |
| networkx | ^3.2.0 | Graph algorithms (optional, for clustering) |
| neo4j | ^5.x | Graph database (optional alternative backend) |

### Neo4j Community Edition (Optional)

Neo4j Community Edition can be used as an alternative to Redis-based graph storage for correlation data.

**Why Neo4j for Correlations:**

| Aspect | Redis Adjacency Lists | Neo4j |
|--------|----------------------|-------|
| Multi-hop queries | Requires multiple round trips | Native traversal, single query |
| Query language | Custom code | Cypher (graph-native DSL) |
| Graph algorithms | Requires networkx | Built-in GDS library |
| Visual exploration | Requires custom UI | Browser at port 7474 |
| Complexity | Simple, no extra container | Additional container |
| Use case | Small graphs, simple queries | Large graphs, complex traversals |

**Neo4j Community Edition Facts:**
- Docker image: `neo4j:2025-community`
- Ports: 7474 (HTTP/browser), 7687 (Bolt protocol)
- License: GPLv3 (compatible with project)
- Limitations: Single user, 4 CPU cores for GDS algorithms
- Auth: Can disable for dev with `NEO4J_AUTH=none`

## Interfaces

### Provided Interfaces

#### Correlation Models

```python
# src/orchestrator/api/models/correlation.py

class CorrelationType(str, Enum):
    """Type of correlation between ideas."""
    SIMILAR = "similar"           # Semantically similar content
    DUPLICATE = "duplicate"       # Essentially the same idea
    COMPLEMENTARY = "complementary"  # Different but related/builds on
    CONTRADICTS = "contradicts"   # Opposing ideas
    RELATED = "related"           # General relation

class CorrelationStatus(str, Enum):
    """Status of a correlation suggestion."""
    SUGGESTED = "suggested"       # System suggested, not reviewed
    ACCEPTED = "accepted"         # User accepted
    REJECTED = "rejected"         # User rejected
    REFINED = "refined"          # User modified the correlation

class IdeaCorrelation(BaseModel):
    """Correlation between two ideas."""
    id: str                       # Correlation ID
    source_idea_id: str           # First idea
    target_idea_id: str           # Second idea
    correlation_type: CorrelationType
    similarity_score: float       # 0.0 - 1.0 (vector similarity)
    status: CorrelationStatus
    confidence: float             # System confidence in suggestion
    created_at: str
    updated_at: str
    created_by: str               # "system" or user_id
    notes: str | None             # User notes on correlation

class CorrelationSuggestion(BaseModel):
    """Suggested correlation for user review."""
    correlation: IdeaCorrelation
    source_idea: Idea             # Full idea object
    target_idea: Idea             # Full idea object
    reasoning: str                # Why this was suggested

class IdeaCluster(BaseModel):
    """Cluster of related ideas."""
    id: str
    name: str                     # Auto-generated or user-set
    idea_ids: list[str]
    centroid_idea_id: str | None  # Most representative idea
    created_at: str
```

#### API Endpoints

```python
# GET /api/ideas/{idea_id}/similar
# Find similar ideas
class FindSimilarRequest(BaseModel):
    threshold: float = 0.7        # Minimum similarity score
    limit: int = 10               # Max results
    exclude_duplicates: bool = True
    include_rejected: bool = False

class FindSimilarResponse(BaseModel):
    idea_id: str
    similar_ideas: list[CorrelationSuggestion]
    total_found: int

# GET /api/ideas/{idea_id}/correlations
# Get all correlations for an idea
class GetCorrelationsResponse(BaseModel):
    idea_id: str
    correlations: list[IdeaCorrelation]
    suggestions_pending: int      # Unreviewed suggestions

# POST /api/ideas/{idea_id}/correlations
# Create manual correlation
class CreateCorrelationRequest(BaseModel):
    target_idea_id: str
    correlation_type: CorrelationType
    notes: str | None = None

# PUT /api/correlations/{correlation_id}
# Accept, reject, or refine a correlation
class UpdateCorrelationRequest(BaseModel):
    status: CorrelationStatus
    correlation_type: CorrelationType | None = None  # For refinement
    notes: str | None = None

# POST /api/ideas/correlations/batch
# Generate correlations for multiple ideas
class BatchCorrelationRequest(BaseModel):
    idea_ids: list[str] | None = None  # None = all ideas
    threshold: float = 0.75

# GET /api/ideas/clusters
# Get idea clusters
class GetClustersResponse(BaseModel):
    clusters: list[IdeaCluster]

# GET /api/ideas/graph
# Get correlation graph for visualization
class GetGraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]

class GraphNode(BaseModel):
    id: str
    idea_id: str
    label: str                    # Truncated idea content
    classification: str
    labels: list[str]

class GraphEdge(BaseModel):
    source: str
    target: str
    correlation_type: CorrelationType
    weight: float                 # Similarity score
    status: CorrelationStatus
```

### Required Interfaces

#### Elasticsearch kNN Query

```python
# Vector similarity search
knn_query = {
    "field": "embedding",
    "query_vector": idea_embedding,
    "k": 20,
    "num_candidates": 100,
    "filter": {
        "bool": {
            "must_not": [
                {"term": {"id": source_idea_id}},  # Exclude self
                {"term": {"status": "archived"}}   # Exclude archived
            ]
        }
    }
}
```

## Technical Approach

### Architecture

```
+------------------------------------------------------------------+
|                      Correlation Engine                           |
+------------------------------------------------------------------+
|                                                                   |
|  Triggers                                                         |
|  +------------------------------------------------------------+  |
|  | New Idea Created | "Find Similar" Button | Batch Job        |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  +------------------------------------------------------------+  |
|  | CorrelationService                                          |  |
|  | - find_similar_ideas()                                      |  |
|  | - create_correlation()                                      |  |
|  | - update_correlation()                                      |  |
|  | - build_clusters()                                          |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  +---------------------------+----------------------------------+  |
|  | Vector Similarity        | GraphStore Protocol               |  |
|  | (Elasticsearch kNN)      | +------------------------------+  |  |
|  |                          | | RedisGraphStore (default)    |  |  |
|  |                          | | Neo4jGraphStore (optional)   |  |  |
|  |                          | +------------------------------+  |  |
|  +---------------------------+----------------------------------+  |
|                              |                                    |
|  +------------------------------------------------------------+  |
|  | CorrelationCache (Redis)                                    |  |
|  | - Pre-computed similarity for fast lookup                   |  |
|  | - TTL-based invalidation on idea updates                    |  |
|  +------------------------------------------------------------+  |
|                                                                   |
+------------------------------------------------------------------+
```

### GraphStore Protocol Abstraction

The graph storage layer is abstracted behind a protocol to allow switching between Redis and Neo4j backends.

```python
# src/infrastructure/graph_store/protocol.py

from typing import Protocol

class GraphStore(Protocol):
    """Protocol for graph storage backends."""

    async def add_node(self, node_id: str, properties: dict) -> None:
        """Add or update a node."""
        ...

    async def add_edge(
        self,
        from_id: str,
        to_id: str,
        edge_type: str,
        properties: dict | None = None
    ) -> None:
        """Add an edge between nodes."""
        ...

    async def get_neighbors(
        self,
        node_id: str,
        edge_type: str | None = None,
        max_depth: int = 1
    ) -> list[str]:
        """Get connected nodes up to max_depth hops away."""
        ...

    async def find_clusters(self) -> list[list[str]]:
        """Find connected components/clusters."""
        ...

    async def get_path(self, from_id: str, to_id: str) -> list[str] | None:
        """Find shortest path between nodes."""
        ...

    async def delete_node(self, node_id: str) -> None:
        """Delete a node and its edges."""
        ...

    async def delete_edge(self, from_id: str, to_id: str, edge_type: str) -> None:
        """Delete a specific edge."""
        ...

    async def get_graph(
        self,
        node_ids: list[str] | None = None,
        edge_types: list[str] | None = None,
    ) -> tuple[list[dict], list[dict]]:
        """Get graph for visualization (nodes, edges)."""
        ...
```

### GraphStore Factory

```python
# src/infrastructure/graph_store/factory.py

import os
from .protocol import GraphStore
from .redis_store import RedisGraphStore
from .neo4j_store import Neo4jGraphStore

def get_graph_store(backend: str | None = None) -> GraphStore:
    """Factory to create graph store based on configuration.

    Args:
        backend: "redis" or "neo4j". If None, reads from GRAPH_STORE_BACKEND env var.
                 Defaults to "redis" if not specified.

    Returns:
        GraphStore implementation.
    """
    if backend is None:
        backend = os.environ.get("GRAPH_STORE_BACKEND", "redis")

    if backend == "neo4j":
        return Neo4jGraphStore(
            uri=os.environ.get("NEO4J_URI", "bolt://localhost:7687"),
            user=os.environ.get("NEO4J_USER", ""),
            password=os.environ.get("NEO4J_PASSWORD", ""),
        )
    else:
        return RedisGraphStore(
            redis_url=os.environ.get("REDIS_URL", "redis://localhost:6379")
        )
```

### Vector Similarity Search

```python
async def find_similar_ideas(
    idea_id: str,
    threshold: float = 0.7,
    limit: int = 10,
    exclude_ids: list[str] | None = None,
) -> list[CorrelationSuggestion]:
    """Find ideas similar to the given idea using vector search."""

    # 1. Get source idea embedding
    idea = await ideas_service.get_idea(idea_id)
    if not idea:
        raise IdeaNotFoundError(idea_id)

    # Retrieve embedding from Elasticsearch
    es_doc = await es_client.get(
        index=get_ideas_index(),
        id=idea_id,
        source=["embedding"]
    )
    embedding = es_doc["_source"]["embedding"]

    # 2. Build exclusion filter
    exclude = [idea_id]
    if exclude_ids:
        exclude.extend(exclude_ids)

    # 3. Execute kNN search
    response = await es_client.search(
        index=get_ideas_index(),
        knn={
            "field": "embedding",
            "query_vector": embedding,
            "k": limit * 2,  # Over-fetch to allow filtering
            "num_candidates": 200,
            "filter": {
                "bool": {
                    "must_not": [
                        {"terms": {"id": exclude}},
                        {"term": {"status": "archived"}}
                    ]
                }
            }
        },
        source=["id", "content", "author_name", "classification", "labels", "created_at"]
    )

    # 4. Filter by threshold and build suggestions
    suggestions = []
    for hit in response["hits"]["hits"]:
        score = hit["_score"]
        if score < threshold:
            continue

        target_idea = Idea(**hit["_source"])
        correlation_type = infer_correlation_type(score)

        suggestions.append(CorrelationSuggestion(
            correlation=IdeaCorrelation(
                id=f"corr-{uuid.uuid4().hex[:8]}",
                source_idea_id=idea_id,
                target_idea_id=target_idea.id,
                correlation_type=correlation_type,
                similarity_score=score,
                status=CorrelationStatus.SUGGESTED,
                confidence=score,
                created_at=datetime.now(UTC).isoformat(),
                updated_at=datetime.now(UTC).isoformat(),
                created_by="system",
                notes=None,
            ),
            source_idea=idea,
            target_idea=target_idea,
            reasoning=generate_reasoning(score, correlation_type),
        ))

    return suggestions[:limit]

def infer_correlation_type(score: float) -> CorrelationType:
    """Infer correlation type from similarity score."""
    if score >= 0.95:
        return CorrelationType.DUPLICATE
    elif score >= 0.8:
        return CorrelationType.SIMILAR
    else:
        return CorrelationType.RELATED
```

### Graph-Based Storage

#### Option A: RedisGraphStore (Default)

Uses Redis sorted sets and hashes for graph storage. Simple, no extra container required.

```python
# src/infrastructure/graph_store/redis_store.py

# Redis keys for graph storage:
# IDEA:{idea_id}:NEIGHBORS:{edge_type} -> Set of connected node IDs
# GRAPH:NODE:{node_id} -> Hash with node properties
# GRAPH:EDGE:{from_id}:{to_id}:{edge_type} -> Hash with edge properties

class RedisGraphStore:
    """Store and query correlation graph in Redis."""

    def __init__(self, redis_url: str):
        self._redis_url = redis_url
        self._redis: Redis | None = None

    async def _get_redis(self) -> Redis:
        if self._redis is None:
            self._redis = await aioredis.from_url(self._redis_url)
        return self._redis

    async def add_node(self, node_id: str, properties: dict) -> None:
        """Add or update a node."""
        redis = await self._get_redis()
        await redis.hset(f"GRAPH:NODE:{node_id}", mapping=properties)

    async def add_edge(
        self,
        from_id: str,
        to_id: str,
        edge_type: str,
        properties: dict | None = None
    ) -> None:
        """Add an edge between nodes."""
        redis = await self._get_redis()
        # Add to adjacency sets (bidirectional)
        await redis.sadd(f"IDEA:{from_id}:NEIGHBORS:{edge_type}", to_id)
        await redis.sadd(f"IDEA:{to_id}:NEIGHBORS:{edge_type}", from_id)
        # Store edge properties
        if properties:
            await redis.hset(
                f"GRAPH:EDGE:{from_id}:{to_id}:{edge_type}",
                mapping=properties
            )

    async def get_neighbors(
        self,
        node_id: str,
        edge_type: str | None = None,
        max_depth: int = 1
    ) -> list[str]:
        """Get connected nodes (multi-hop requires iteration)."""
        redis = await self._get_redis()
        if max_depth == 1:
            if edge_type:
                return list(await redis.smembers(
                    f"IDEA:{node_id}:NEIGHBORS:{edge_type}"
                ))
            # Get all edge types
            keys = await redis.keys(f"IDEA:{node_id}:NEIGHBORS:*")
            neighbors = set()
            for key in keys:
                neighbors.update(await redis.smembers(key))
            return list(neighbors)

        # Multi-hop: BFS traversal
        visited = {node_id}
        frontier = [node_id]
        for _ in range(max_depth):
            next_frontier = []
            for nid in frontier:
                for neighbor in await self.get_neighbors(nid, edge_type, 1):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        next_frontier.append(neighbor)
            frontier = next_frontier
        visited.remove(node_id)
        return list(visited)

    async def find_clusters(self) -> list[list[str]]:
        """Find connected components using BFS."""
        redis = await self._get_redis()
        all_nodes = set()
        for key in await redis.keys("GRAPH:NODE:*"):
            node_id = key.decode().split(":")[-1]
            all_nodes.add(node_id)

        clusters = []
        visited = set()
        for node_id in all_nodes:
            if node_id in visited:
                continue
            # BFS to find component
            component = []
            queue = [node_id]
            while queue:
                current = queue.pop(0)
                if current in visited:
                    continue
                visited.add(current)
                component.append(current)
                neighbors = await self.get_neighbors(current, max_depth=1)
                queue.extend(n for n in neighbors if n not in visited)
            clusters.append(component)
        return clusters
```

#### Option B: Neo4jGraphStore (Optional)

Uses Neo4j via the `neo4j` Python driver. Better for complex multi-hop queries and built-in graph algorithms.

```python
# src/infrastructure/graph_store/neo4j_store.py

from neo4j import AsyncGraphDatabase

class Neo4jGraphStore:
    """Store and query correlation graph in Neo4j."""

    def __init__(self, uri: str, user: str, password: str):
        auth = (user, password) if user and password else None
        self._driver = AsyncGraphDatabase.driver(uri, auth=auth)

    async def add_node(self, node_id: str, properties: dict) -> None:
        """Add or update a node."""
        async with self._driver.session() as session:
            await session.run(
                """
                MERGE (n:Idea {id: $node_id})
                SET n += $properties
                """,
                node_id=node_id,
                properties=properties
            )

    async def add_edge(
        self,
        from_id: str,
        to_id: str,
        edge_type: str,
        properties: dict | None = None
    ) -> None:
        """Add an edge between nodes."""
        props = properties or {}
        async with self._driver.session() as session:
            # Dynamic relationship type via APOC or string interpolation
            await session.run(
                f"""
                MATCH (a:Idea {{id: $from_id}})
                MATCH (b:Idea {{id: $to_id}})
                MERGE (a)-[r:{edge_type.upper()}]->(b)
                SET r += $properties
                """,
                from_id=from_id,
                to_id=to_id,
                properties=props
            )

    async def get_neighbors(
        self,
        node_id: str,
        edge_type: str | None = None,
        max_depth: int = 1
    ) -> list[str]:
        """Get connected nodes with native graph traversal."""
        async with self._driver.session() as session:
            if edge_type:
                result = await session.run(
                    f"""
                    MATCH (n:Idea {{id: $node_id}})-[:{edge_type.upper()}*1..{max_depth}]-(neighbor:Idea)
                    RETURN DISTINCT neighbor.id AS id
                    """,
                    node_id=node_id
                )
            else:
                result = await session.run(
                    f"""
                    MATCH (n:Idea {{id: $node_id}})-[*1..{max_depth}]-(neighbor:Idea)
                    RETURN DISTINCT neighbor.id AS id
                    """,
                    node_id=node_id
                )
            return [record["id"] async for record in result]

    async def find_clusters(self) -> list[list[str]]:
        """Find connected components using GDS library."""
        async with self._driver.session() as session:
            # Create in-memory graph projection
            await session.run(
                """
                CALL gds.graph.project(
                    'ideaGraph',
                    'Idea',
                    {SIMILAR: {orientation: 'UNDIRECTED'}, RELATED: {orientation: 'UNDIRECTED'}}
                )
                """
            )
            # Run weakly connected components
            result = await session.run(
                """
                CALL gds.wcc.stream('ideaGraph')
                YIELD nodeId, componentId
                RETURN gds.util.asNode(nodeId).id AS ideaId, componentId
                ORDER BY componentId
                """
            )
            # Group by component
            components: dict[int, list[str]] = {}
            async for record in result:
                comp_id = record["componentId"]
                if comp_id not in components:
                    components[comp_id] = []
                components[comp_id].append(record["ideaId"])
            # Cleanup
            await session.run("CALL gds.graph.drop('ideaGraph')")
            return list(components.values())

    async def get_path(self, from_id: str, to_id: str) -> list[str] | None:
        """Find shortest path between nodes."""
        async with self._driver.session() as session:
            result = await session.run(
                """
                MATCH path = shortestPath(
                    (a:Idea {id: $from_id})-[*]-(b:Idea {id: $to_id})
                )
                RETURN [n IN nodes(path) | n.id] AS path
                """,
                from_id=from_id,
                to_id=to_id
            )
            record = await result.single()
            return record["path"] if record else None
```

### Cypher Query Examples

Common correlation operations in Cypher:

```cypher
-- Find all ideas related to a specific idea (2 hops)
MATCH (i:Idea {id: 'idea-123'})-[:SIMILAR|RELATED*1..2]-(related:Idea)
RETURN DISTINCT related.id, related.content

-- Find potential duplicates (high similarity)
MATCH (a:Idea)-[r:SIMILAR]->(b:Idea)
WHERE r.score > 0.95
RETURN a.id, b.id, r.score

-- Find idea clusters using PageRank
CALL gds.pageRank.stream('ideaGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).id AS ideaId, score
ORDER BY score DESC

-- Suggest ideas to merge (same cluster, high similarity)
MATCH (a:Idea)-[:SIMILAR {score: $minScore}]->(b:Idea)
WHERE a.cluster = b.cluster
RETURN a.id, b.id
```

### Correlation Cache for Fast Extraction

```python
class CorrelationCache:
    """Cache for pre-computed correlation suggestions."""

    CACHE_TTL = 3600  # 1 hour
    CACHE_KEY_PREFIX = "correlation_cache"

    async def get_cached_similar(
        self,
        idea_id: str,
    ) -> list[CorrelationSuggestion] | None:
        """Get cached similar ideas."""
        key = f"{self.CACHE_KEY_PREFIX}:{idea_id}"
        data = await self._redis.get(key)
        if data:
            return [CorrelationSuggestion(**s) for s in json.loads(data)]
        return None

    async def set_cached_similar(
        self,
        idea_id: str,
        suggestions: list[CorrelationSuggestion],
    ) -> None:
        """Cache similar ideas."""
        key = f"{self.CACHE_KEY_PREFIX}:{idea_id}"
        await self._redis.setex(
            key,
            self.CACHE_TTL,
            json.dumps([s.dict() for s in suggestions])
        )

    async def invalidate(self, idea_id: str) -> None:
        """Invalidate cache when idea is updated."""
        key = f"{self.CACHE_KEY_PREFIX}:{idea_id}"
        await self._redis.delete(key)

        # Also invalidate cached results that include this idea
        # (This is handled by TTL in practice)
```

### Clustering Algorithm

```python
async def build_clusters(
    min_cluster_size: int = 3,
    similarity_threshold: float = 0.75,
) -> list[IdeaCluster]:
    """Build clusters of related ideas using graph connectivity."""

    # Get all accepted correlations
    all_correlations = await get_all_correlations(
        status=[CorrelationStatus.ACCEPTED],
        threshold=similarity_threshold
    )

    # Build adjacency graph
    graph = nx.Graph()
    for corr in all_correlations:
        graph.add_edge(
            corr.source_idea_id,
            corr.target_idea_id,
            weight=corr.similarity_score,
            type=corr.correlation_type
        )

    # Find connected components
    components = list(nx.connected_components(graph))

    # Filter by minimum size and build clusters
    clusters = []
    for component in components:
        if len(component) < min_cluster_size:
            continue

        idea_ids = list(component)

        # Find centroid (highest connectivity)
        subgraph = graph.subgraph(component)
        centralities = nx.degree_centrality(subgraph)
        centroid_id = max(centralities, key=centralities.get)

        cluster = IdeaCluster(
            id=f"cluster-{uuid.uuid4().hex[:8]}",
            name=await generate_cluster_name(idea_ids),
            idea_ids=idea_ids,
            centroid_idea_id=centroid_id,
            created_at=datetime.now(UTC).isoformat(),
        )
        clusters.append(cluster)

    return clusters
```

### Error Handling

| Error Type | Handling Strategy |
|------------|-------------------|
| Vector search timeout | Use cache, return partial results |
| Redis unavailable | Fall back to direct ES queries |
| Invalid idea reference | Return 404, clean orphaned correlations |
| Circular correlation | Prevent self-correlation, detect cycles |

## File Structure

```
src/
├── infrastructure/
│   └── graph_store/
│       ├── __init__.py               # Package exports
│       ├── protocol.py               # GraphStore protocol
│       ├── factory.py                # Backend factory
│       ├── redis_store.py            # Redis implementation
│       └── neo4j_store.py            # Neo4j implementation (optional)
└── orchestrator/
    ├── api/
    │   └── models/
    │       └── correlation.py        # Pydantic models
    ├── routes/
    │   └── correlation_api.py        # API endpoints
    └── services/
        ├── correlation_service.py    # Main service
        └── correlation_cache.py      # Similarity cache

docker/hitl-ui/src/
├── components/
│   └── ideas/
│       ├── SimilarIdeasPanel.tsx     # Find similar UI
│       ├── CorrelationsList.tsx      # List correlations
│       ├── CorrelationReview.tsx     # Accept/reject UI
│       └── IdeasGraph.tsx            # D3 graph visualization
└── types/
    └── correlation.ts                # TypeScript interfaces

tests/
└── unit/
    ├── infrastructure/
    │   └── graph_store/
    │       ├── test_redis_store.py   # Redis store tests
    │       └── test_neo4j_store.py   # Neo4j store tests
    └── orchestrator/
        └── services/
            └── test_correlation_service.py
```

## Docker Compose Configuration

### Neo4j Service (Optional Profile)

Add to `docker/docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  neo4j:
    image: neo4j:2025-community
    profiles: ["neo4j"]  # Only starts with --profile neo4j
    ports:
      - "7474:7474"  # HTTP (Browser UI)
      - "7687:7687"  # Bolt protocol
    environment:
      - NEO4J_AUTH=none  # Disable auth for local dev
      - NEO4J_PLUGINS=["graph-data-science"]  # Enable GDS for clustering
      - NEO4J_dbms_memory_heap_initial__size=512m
      - NEO4J_dbms_memory_heap_max__size=1G
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:7474"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - dox-network

volumes:
  # ... existing volumes ...
  neo4j_data:
  neo4j_logs:
```

### Usage

```bash
# Default: Redis-based graph storage
docker compose up -d

# With Neo4j enabled
docker compose --profile neo4j up -d

# Access Neo4j browser
open http://localhost:7474
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAPH_STORE_BACKEND` | `redis` | Graph storage backend: `redis` or `neo4j` |
| `NEO4J_URI` | `bolt://localhost:7687` | Neo4j Bolt connection URI |
| `NEO4J_USER` | `` | Neo4j username (empty = no auth) |
| `NEO4J_PASSWORD` | `` | Neo4j password (empty = no auth) |

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Search latency at scale | Medium | Medium | Caching, pagination, async |
| Graph storage size | Medium | Low | Redis cluster, archival policy |
| False positive correlations | Medium | Medium | User review workflow, thresholds |
| Cluster fragmentation | Low | Medium | Regular re-clustering, manual merge |

## Success Metrics

1. **Search Latency**: p95 < 500ms for find similar
2. **Suggestion Quality**: 70%+ of suggestions accepted or refined
3. **Duplicate Detection**: 90%+ of duplicates identified
4. **User Engagement**: 50%+ of suggestions reviewed within 7 days
