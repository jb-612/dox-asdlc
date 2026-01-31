# P08-F04: Correlation Engine - Tasks

## Progress

- Started: 2026-01-31
- Tasks Complete: 5/24
- Percentage: 21%
- Status: IN_PROGRESS
- Blockers: None (Phase 2 backend complete)

---

## Phase 1: Data Models & Storage

### T00: Create GraphStore protocol and factory

- [x] Estimate: 1hr
- [x] Tests: `tests/unit/infrastructure/graph_store/test_redis_store.py`
- [x] Dependencies: None
- [x] Agent: backend

**Files:**
- `src/infrastructure/graph_store/__init__.py`
- `src/infrastructure/graph_store/protocol.py`
- `src/infrastructure/graph_store/redis_store.py`

**Implement:**
- `GraphStore` protocol with methods:
  - `add_node(node_id, properties)`
  - `add_edge(from_id, to_id, edge_type, properties)`
  - `get_neighbors(node_id, edge_type)`
  - `remove_edge(from_id, to_id, edge_type)`
  - `get_edges(node_id, edge_type)`
  - `delete_node(node_id)`
  - `get_graph(node_ids)`
- `get_graph_store()` factory function
- Environment variable support (`CORRELATION_MOCK_MODE`)

---

### T01: Create correlation Pydantic models

- [x] Estimate: 1hr
- [x] Tests: `tests/unit/orchestrator/routes/test_correlation_api.py`
- [x] Dependencies: P08-F01
- [x] Agent: backend

**File:** `src/orchestrator/api/models/correlation.py`

**Implement:**
- `CorrelationType` enum (similar, related, contradicts)
- `IdeaCorrelation` model
- `CreateCorrelationRequest` model
- `GraphNode`, `GraphEdge` models
- `GraphResponse` model

---

### T02: Create correlation TypeScript types

- [ ] Estimate: 30min
- [ ] Tests: N/A (types only)
- [ ] Dependencies: T01
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/types/correlation.ts`

**Implement:**
- Mirror all Python models in TypeScript
- `CorrelationType`, `CorrelationStatus` types
- `IdeaCorrelation`, `CorrelationSuggestion` interfaces
- `IdeaCluster` interface
- `GraphNode`, `GraphEdge` interfaces

---

### T03a: Create RedisGraphStore implementation

- [x] Estimate: 2hr
- [x] Tests: `tests/unit/infrastructure/graph_store/test_redis_store.py` (21 tests)
- [x] Dependencies: T00
- [x] Agent: backend

**File:** `src/infrastructure/graph_store/redis_store.py`

**Implement:**
- `RedisGraphStore` class implementing `GraphStore` protocol
- Redis key patterns:
  - `GRAPH:NEIGHBORS:{id}:{edge_type}` -> Set of connected IDs
  - `GRAPH:NODE:{id}` -> Hash with node properties
  - `GRAPH:EDGE:{from}:{to}:{type}` -> Hash with edge properties
  - `GRAPH:ALL_NODES` -> Set of all node IDs
- Bidirectional edge handling
- Graph extraction for visualization

---

### T03b: Create Neo4jGraphStore implementation (optional)

- [ ] Estimate: 2hr
- [ ] Tests: `tests/unit/infrastructure/graph_store/test_neo4j_store.py`
- [ ] Dependencies: T00
- [ ] Agent: backend

**File:** `src/infrastructure/graph_store/neo4j_store.py`

**Implement:**
- `Neo4jGraphStore` class implementing `GraphStore` protocol
- Async Neo4j driver connection management
- Cypher queries for all protocol methods
- GDS library integration for clustering (weakly connected components)
- Native shortestPath for `get_path()`

**Note:** This task is optional. The feature works with Redis-only if Neo4j is not needed.

---

### T03c: Update docker-compose with Neo4j service

- [ ] Estimate: 30min
- [ ] Tests: Manual verification
- [ ] Dependencies: None
- [ ] Agent: devops

**File:** `docker/docker-compose.yml`

**Implement:**
- Add `neo4j` service with `profiles: ["neo4j"]`
- Image: `neo4j:2025-community`
- Ports: 7474 (HTTP), 7687 (Bolt)
- Environment: `NEO4J_AUTH=none`, GDS plugin enabled
- Volumes: `neo4j_data`, `neo4j_logs`
- Health check
- Add to `dox-network`

---

### T04: Create CorrelationCache

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/services/test_correlation_cache.py`
- [ ] Dependencies: T01
- [ ] Agent: backend

**File:** `src/orchestrator/services/correlation_cache.py`

**Implement:**
- `CorrelationCache` class
- `get_cached_similar()` - retrieve cached results
- `set_cached_similar()` - store with TTL
- `invalidate()` - clear on idea update
- `invalidate_all()` - clear all cache
- Configurable TTL (default 1 hour)

---

### T04: Create CorrelationCache

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/services/test_correlation_cache.py`
- [ ] Dependencies: T01
- [ ] Agent: backend

**File:** `src/orchestrator/services/correlation_cache.py`

**Implement:**
- `CorrelationCache` class
- `get_cached_similar()` - retrieve cached results
- `set_cached_similar()` - store with TTL
- `invalidate()` - clear on idea update
- `invalidate_all()` - clear all cache
- Configurable TTL (default 1 hour)

---

## Phase 2: Correlation Service

### T05: Create CorrelationService core

- [ ] Estimate: 2hr
- [ ] Tests: `tests/unit/orchestrator/services/test_correlation_service.py`
- [ ] Dependencies: T01, T03, T04
- [ ] Agent: backend

**File:** `src/orchestrator/services/correlation_service.py`

**Implement:**
- `CorrelationService` class
- `find_similar_ideas()` - vector similarity search
- `create_correlation()` - create new correlation
- `update_correlation()` - update status/type
- `delete_correlation()` - remove correlation
- `get_correlations_for_idea()` - list all

---

### T06: Implement vector similarity search

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/orchestrator/services/test_correlation_service.py`
- [ ] Dependencies: T05, P08-F01
- [ ] Agent: backend

**File:** `src/orchestrator/services/correlation_service.py` (addition)

**Implement:**
- Elasticsearch kNN query builder
- Threshold filtering
- Exclusion of self and rejected correlations
- Score normalization
- `infer_correlation_type()` from score

---

### T07: Implement correlation type inference

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/services/test_correlation_service.py`
- [ ] Dependencies: T05
- [ ] Agent: backend

**File:** `src/orchestrator/services/correlation_service.py` (addition)

**Implement:**
- Score-based type inference (>0.95 = duplicate, etc.)
- `generate_reasoning()` for suggestions
- Consider label overlap in inference
- Consider classification match

---

### T08: Implement clustering algorithm

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/orchestrator/services/test_correlation_service.py`
- [ ] Dependencies: T05, T03
- [ ] Agent: backend

**File:** `src/orchestrator/services/correlation_service.py` (addition)

**Implement:**
- `build_clusters()` using networkx
- Connected components algorithm
- Centroid identification
- `generate_cluster_name()` from common labels
- Minimum cluster size filter

---

## Phase 3: API Endpoints

### T09: Create correlation API router

- [x] Estimate: 2hr
- [x] Tests: `tests/unit/orchestrator/routes/test_correlation_api.py` (15 tests)
- [x] Dependencies: T05
- [x] Agent: backend

**File:** `src/orchestrator/routes/correlation_api.py`

**Endpoints:**
- `POST /api/brainflare/correlations` - create correlation
- `GET /api/brainflare/ideas/{idea_id}/correlations` - get correlations
- `DELETE /api/brainflare/correlations/{id}` - delete correlation
- `GET /api/brainflare/graph` - get graph for visualization

---

### T10: Create graph and clusters API endpoints

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/routes/test_correlation_api.py`
- [ ] Dependencies: T09
- [ ] Agent: backend

**File:** `src/orchestrator/routes/correlation_api.py` (addition)

**Endpoints:**
- `GET /api/ideas/clusters` - get clusters
- `GET /api/mindflare/graph` - get graph for visualization
- `POST /api/ideas/correlations/batch` - batch generate

---

### T11: Register correlation routes

- [x] Estimate: 15min
- [x] Tests: Manual verification (app creates successfully)
- [x] Dependencies: T09, T10
- [x] Agent: backend

**File:** `src/orchestrator/main.py`

**Implement:**
- Import correlation_api router
- Register routes
- Add logging for correlation API endpoint

---

### T12: Hook correlation on idea creation

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/services/test_ideas_service.py`
- [ ] Dependencies: T05, P08-F01
- [ ] Agent: backend

**File:** `src/orchestrator/services/ideas_service.py` (addition)

**Implement:**
- After idea creation, queue correlation search
- If high-similarity found, auto-create suggestions
- Non-blocking async operation

---

## Phase 4: Frontend Components

### T13: Create SimilarIdeasPanel component

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/SimilarIdeasPanel.test.tsx`
- [ ] Dependencies: T02
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/SimilarIdeasPanel.tsx`

**Implement:**
- List similar ideas with similarity percentage
- Correlation type badge
- Click to view idea
- Loading state
- Empty state
- "Load More" pagination

---

### T14: Create CorrelationsList component

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/CorrelationsList.test.tsx`
- [ ] Dependencies: T02
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/CorrelationsList.tsx`

**Implement:**
- Group correlations by type
- Show target idea preview
- Status badge (accepted, refined)
- Delete button with confirmation
- Edit correlation type

---

### T15: Create CorrelationReview component

- [ ] Estimate: 2hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/CorrelationReview.test.tsx`
- [ ] Dependencies: T02
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/CorrelationReview.tsx`

**Implement:**
- Suggestion card with source and target ideas
- Accept/Reject/Refine buttons
- Refine dropdown with type selection
- Notes input field
- Reasoning display
- Keyboard shortcuts (A=Accept, R=Reject)

---

### T16: Create IdeasGraph component

- [ ] Estimate: 2.5hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/IdeasGraph.test.tsx`
- [ ] Dependencies: T02
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/IdeasGraph.tsx`

**Implement:**
- D3.js force-directed graph
- Nodes colored by classification
- Edges styled by correlation type
- Zoom and pan controls
- Node click handler
- Filter by label
- Responsive container

---

### T17: Create ClustersPanel component

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/ClustersPanel.test.tsx`
- [ ] Dependencies: T02
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/ClustersPanel.tsx`

**Implement:**
- List clusters with name and count
- Expand to see member ideas
- Rename cluster
- Merge clusters button
- View cluster in graph

---

## Phase 5: Integration & Pages

### T18: Update IdeaDetail with correlations

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/IdeaDetail.test.tsx`
- [ ] Dependencies: T13, T14, T15, P08-F01
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/IdeaDetail.tsx` (update)

**Implement:**
- Add "Find Similar" button
- Add correlations tab
- Show pending suggestions badge
- "Link to Idea" action
- Integrate CorrelationsList and SimilarIdeasPanel

---

### T19: Create MindflareGraphPage

- [ ] Estimate: 1hr
- [ ] Tests: `docker/hitl-ui/src/pages/MindflareGraphPage.test.tsx`
- [ ] Dependencies: T16, T17
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/pages/MindflareGraphPage.tsx`

**Layout:**
```
+----------------------------------------------------------+
| Graph Visualization                                       |
| [Filters: Label v] [Classification v]  [Full Screen]     |
+----------------------------------------------------------+
|                                                          |
|                   IdeasGraph                              |
|                                                          |
+----------------------------------------------------------+
| Sidebar: Clusters                                        |
| - Cluster 1 (5)                                          |
| - Cluster 2 (3)                                          |
+----------------------------------------------------------+
```

**Implement:**
- Full-page graph view
- Sidebar with clusters
- Filter controls
- Route: `/mindflare/graph`

---

### T20: Integration tests for correlation engine

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/integration/orchestrator/test_correlation.py`
- [ ] Dependencies: T09, T10, T05
- [ ] Agent: backend

**Implement:**
- Test find similar flow
- Test accept/reject/refine workflow
- Test manual correlation creation
- Test clustering
- Test graph generation
- Test cache invalidation

---

## Task Dependencies Graph

```
T00 ───┬──► T03a ──────────────────────────────────────────┐
       │                                                    │
       └──► T03b (optional) ───────────────────────────────┤
                                                           │
T01 ───┬──► T02 ────────────────────────────────────────┐  │
       │                                                │  │
       └──► T04 ────────────────────────────────────────┤  │
                                                        │  │
T03a ──┬──► T05 ───┬──► T06 ───┬──► T09 ───┬──► T11 ───┼──┤
       │           │           │           │           │  │
T04 ───┘           ├──► T07 ───┤           │           │  │
                   │           │           │           │  │
                   └──► T08 ───┤           │           │  │
                               │           │           │  │
                               └──► T10 ───┘           │  │
                                                       │  │
T02 ───┬──► T13 ───────────────────────────────────────┼──┤
       │                                               │  │
       ├──► T14 ───────────────────────────────────────┤  │
       │                                               │  │
       ├──► T15 ───────────────────────────────────────┤  │
       │                                               │  │
       ├──► T16 ───┬──► T19                            │  │
       │           │                                   │  │
       └──► T17 ───┘                                   │  │
                                                       │  │
T03c (optional, parallel) ─────────────────────────────┤  │
                                                       │  │
T18 depends on: T13, T14, T15, P08-F01                 │  │
                                                       │  │
T12 depends on: T05, P08-F01 ─────────────────────────►├──┘
                                                       │
T20 depends on: T09, T10, T05 ────────────────────────►┘
```

**Note:** T03b (Neo4jGraphStore) and T03c (docker-compose) are optional. The feature works with Redis-only (T03a) if Neo4j is not needed.

---

## Verification Checklist

### Unit Tests
- [ ] `pytest tests/unit/infrastructure/graph_store/test_protocol.py`
- [ ] `pytest tests/unit/infrastructure/graph_store/test_redis_store.py`
- [ ] `pytest tests/unit/infrastructure/graph_store/test_neo4j_store.py` (optional)
- [ ] `pytest tests/unit/orchestrator/api/models/test_correlation.py`
- [ ] `pytest tests/unit/orchestrator/services/test_correlation_service.py`
- [ ] `pytest tests/unit/orchestrator/services/test_correlation_cache.py`
- [ ] `pytest tests/unit/orchestrator/routes/test_correlation_api.py`
- [ ] `npm test -- src/components/ideas/SimilarIdeasPanel`
- [ ] `npm test -- src/components/ideas/CorrelationReview`
- [ ] `npm test -- src/components/ideas/IdeasGraph`

### Integration Tests
- [ ] `pytest tests/integration/orchestrator/test_correlation.py`

### Manual Verification
1. Find similar ideas -> Results ranked by similarity
2. Accept suggestion -> Correlation saved
3. Reject suggestion -> Doesn't reappear
4. Refine type -> Updates correctly
5. View graph -> Nodes and edges visible
6. View clusters -> Groups shown
7. Create idea similar to existing -> Warning shown

### Neo4j Verification (Optional)
1. Start with `docker compose --profile neo4j up -d`
2. Set `GRAPH_STORE_BACKEND=neo4j`
3. Access Neo4j browser at http://localhost:7474
4. Verify nodes and relationships created
5. Run Cypher query to verify graph structure

---

## Estimates Summary

| Phase | Tasks | Total Estimate |
|-------|-------|----------------|
| Phase 1: Models & Storage | T00-T04 | 7hr (5.5hr without Neo4j) |
| Phase 2: Service | T05-T08 | 6hr |
| Phase 3: API | T09-T12 | 4.25hr |
| Phase 4: Components | T13-T17 | 9hr |
| Phase 5: Integration | T18-T20 | 4hr |

**Total Estimate:** ~30.25 hours (with Neo4j) / ~28 hours (Redis-only)

### Optional Neo4j Tasks

| Task | Estimate | Description |
|------|----------|-------------|
| T03b | 2hr | Neo4jGraphStore implementation |
| T03c | 30min | Docker Compose Neo4j service |

These tasks can be deferred and added later if Neo4j support is needed.
