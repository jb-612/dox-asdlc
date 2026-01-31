# P08-F01: Ideas Repository Core - Technical Design

## Overview

Implement the foundational Ideas Repository that enables users to capture, store, and retrieve short-form ideas (up to 144 words) with full-text search, vector embeddings for semantic similarity, and integration with the existing KnowledgeStore infrastructure.

### Problem Statement

Currently, product ideas are scattered across various tools (Slack, email, documents) without a centralized repository. This leads to:
- Lost ideas that never get captured formally
- Difficulty finding related or duplicate ideas
- No connection between raw ideas and the PRD Ideation Studio
- No structured way to track idea lifecycle and maturity

### Solution

A centralized Ideas Repository that:
1. Captures ideas with Twitter-style brevity (144 words max)
2. Stores ideas in Elasticsearch with vector embeddings for semantic search
3. Provides CRUD API endpoints following existing orchestrator patterns
4. Integrates with the frontend Mindflare Hub for display and management
5. Supports multiple idea sources (manual entry, Slack, future integrations)

## Dependencies

### Internal Dependencies

| Feature | Purpose | Status |
|---------|---------|--------|
| P01-F03 | KnowledgeStore interface (ElasticsearchStore) | Complete |
| P02-F04 | Elasticsearch integration in K8s | Complete |
| P05-F01 | HITL UI Foundation | Complete |
| P05-F11 | Ideation Studio (integration target for "Bake" action) | Complete |

### External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| FastAPI | ^0.104.0 | API framework |
| Pydantic | ^2.5.0 | Request/response validation |
| elasticsearch | ^8.11.0 | Vector storage and search |
| Redis | ^5.0.0 | Session storage (for drafts) |
| Zustand | ^4.4.0 | Frontend state management |

## Interfaces

### Provided Interfaces

#### Idea Data Model

```python
# src/orchestrator/api/models/idea.py

class IdeaSource(str, Enum):
    """Source of the idea."""
    MANUAL = "manual"
    SLACK = "slack"
    IMPORT = "import"

class IdeaStatus(str, Enum):
    """Lifecycle status of an idea."""
    DRAFT = "draft"
    ACTIVE = "active"
    BAKING = "baking"  # Being developed in Ideation Studio
    ARCHIVED = "archived"

class IdeaClassification(str, Enum):
    """Auto-classified requirement type."""
    FUNCTIONAL = "functional"
    NON_FUNCTIONAL = "non_functional"
    UNDETERMINED = "undetermined"

class Idea(BaseModel):
    """Core idea entity."""
    id: str                           # UUID
    content: str                      # Max 144 words
    author_id: str                    # User identifier
    author_name: str                  # Display name
    source: IdeaSource                # Where idea came from
    source_ref: str | None            # External reference (e.g., Slack message ID)
    status: IdeaStatus
    classification: IdeaClassification
    labels: list[str]                 # Auto-assigned and manual labels
    created_at: str                   # ISO 8601
    updated_at: str                   # ISO 8601
    word_count: int                   # Pre-calculated
    bake_session_id: str | None       # Link to Ideation Studio session

    model_config = {"populate_by_name": True}
```

#### API Endpoints

```python
# POST /api/ideas
# Create a new idea
class CreateIdeaRequest(BaseModel):
    content: str                      # Required, max 144 words
    source: IdeaSource = IdeaSource.MANUAL
    source_ref: str | None = None
    labels: list[str] = []

class CreateIdeaResponse(BaseModel):
    idea: Idea
    classification: IdeaClassification  # Auto-assigned
    suggested_labels: list[str]         # Auto-suggested

# GET /api/ideas
# List ideas with filtering and pagination
class ListIdeasRequest(BaseModel):
    page: int = 1
    page_size: int = 20
    status: IdeaStatus | None = None
    classification: IdeaClassification | None = None
    labels: list[str] | None = None
    source: IdeaSource | None = None
    search: str | None = None         # Full-text search
    sort_by: str = "created_at"
    sort_order: str = "desc"

class ListIdeasResponse(BaseModel):
    ideas: list[Idea]
    total: int
    page: int
    page_size: int
    has_more: bool

# GET /api/ideas/{idea_id}
# Get single idea by ID

# PUT /api/ideas/{idea_id}
# Update idea (content, labels, status)

# DELETE /api/ideas/{idea_id}
# Soft delete (set status to archived)

# POST /api/ideas/{idea_id}/bake
# Start baking in Ideation Studio
class BakeIdeaRequest(BaseModel):
    project_name: str | None = None   # Override derived name

class BakeIdeaResponse(BaseModel):
    session_id: str                   # Ideation Studio session ID
    redirect_url: str                 # URL to Ideation Studio
```

### Required Interfaces

#### Elasticsearch Index Mapping

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "content": {
        "type": "text",
        "analyzer": "english"
      },
      "embedding": {
        "type": "dense_vector",
        "dims": 384,
        "index": true,
        "similarity": "cosine"
      },
      "author_id": { "type": "keyword" },
      "author_name": { "type": "text" },
      "source": { "type": "keyword" },
      "source_ref": { "type": "keyword" },
      "status": { "type": "keyword" },
      "classification": { "type": "keyword" },
      "labels": { "type": "keyword" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "word_count": { "type": "integer" },
      "bake_session_id": { "type": "keyword" },
      "tenant_id": { "type": "keyword" }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}
```

## Technical Approach

### Architecture

```
+------------------------------------------------------------------+
|                        Ideas Repository                           |
+------------------------------------------------------------------+
|                                                                   |
|  Frontend (docker/hitl-ui)                                        |
|  +------------------------------------------------------------+  |
|  |  ideasStore (Zustand)                                       |  |
|  |  - ideas[], selectedIdea, filters, pagination               |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|                    REST API Calls                                 |
|                              |                                    |
|  Backend (src/orchestrator)                                       |
|  +------------------------------------------------------------+  |
|  |  routes/ideas_api.py                                        |  |
|  |  - CRUD endpoints                                           |  |
|  |  - Validation (144 word limit)                              |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  +------------------------------------------------------------+  |
|  |  services/ideas_service.py                                  |  |
|  |  - Business logic                                           |  |
|  |  - Elasticsearch operations                                 |  |
|  |  - Embedding generation                                     |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  Infrastructure                                                   |
|  +---------------------------+  +-----------------------------+  |
|  | ElasticsearchStore        |  | EmbeddingService            |  |
|  | (knowledge_store)         |  | (sentence-transformers)     |  |
|  +---------------------------+  +-----------------------------+  |
|                              |                                    |
+------------------------------------------------------------------+
                               |
                    +----------+----------+
                    |                     |
              Elasticsearch            Redis
              (ideas index)         (session cache)
```

### Word Count Validation

```python
def validate_word_count(content: str, max_words: int = 144) -> int:
    """Validate and return word count."""
    words = content.split()
    word_count = len(words)
    if word_count > max_words:
        raise ValueError(f"Idea exceeds {max_words} word limit ({word_count} words)")
    return word_count
```

### Embedding Generation

Ideas are embedded using the existing EmbeddingService from knowledge_store:

```python
from src.infrastructure.knowledge_store.embedding_service import EmbeddingService

class IdeasService:
    def __init__(self, es_store: ElasticsearchStore):
        self._es = es_store
        self._embedding_service = EmbeddingService("all-MiniLM-L6-v2")

    async def create_idea(self, request: CreateIdeaRequest, user: User) -> Idea:
        # Validate word count
        word_count = validate_word_count(request.content)

        # Generate embedding for semantic search
        embedding = self._embedding_service.embed(request.content)

        # Create idea document
        idea = Idea(
            id=str(uuid.uuid4()),
            content=request.content,
            author_id=user.id,
            author_name=user.display_name,
            source=request.source,
            source_ref=request.source_ref,
            status=IdeaStatus.ACTIVE,
            classification=IdeaClassification.UNDETERMINED,  # Set by classifier
            labels=request.labels,
            created_at=datetime.now(UTC).isoformat(),
            updated_at=datetime.now(UTC).isoformat(),
            word_count=word_count,
            bake_session_id=None,
        )

        # Index in Elasticsearch
        await self._index_idea(idea, embedding)

        return idea
```

### Search Implementation

```python
async def search_ideas(
    self,
    query: str,
    filters: dict | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ListIdeasResponse:
    """Search ideas with full-text and optional semantic search."""

    # Build query
    must_clauses = []
    filter_clauses = []

    if query:
        # Full-text search on content
        must_clauses.append({
            "match": {
                "content": {
                    "query": query,
                    "fuzziness": "AUTO"
                }
            }
        })

    if filters:
        if filters.get("status"):
            filter_clauses.append({"term": {"status": filters["status"]}})
        if filters.get("classification"):
            filter_clauses.append({"term": {"classification": filters["classification"]}})
        if filters.get("labels"):
            filter_clauses.append({"terms": {"labels": filters["labels"]}})
        if filters.get("source"):
            filter_clauses.append({"term": {"source": filters["source"]}})

    # Execute search
    body = {
        "query": {
            "bool": {
                "must": must_clauses or [{"match_all": {}}],
                "filter": filter_clauses
            }
        },
        "from": (page - 1) * page_size,
        "size": page_size,
        "sort": [{"created_at": "desc"}]
    }

    response = await self._es._client.search(
        index=self._get_index_name(),
        body=body
    )

    # Convert to ideas
    ideas = [self._hit_to_idea(hit) for hit in response["hits"]["hits"]]
    total = response["hits"]["total"]["value"]

    return ListIdeasResponse(
        ideas=ideas,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total
    )
```

### Error Handling

| Error Type | HTTP Status | Handling Strategy |
|------------|-------------|-------------------|
| Word count exceeded | 400 | Return validation error with word count |
| Idea not found | 404 | Return not found error |
| Elasticsearch connection | 503 | Retry with backoff, return service unavailable |
| Invalid filter values | 400 | Return validation error with details |
| Duplicate source_ref | 409 | Return conflict error (for Slack dedup) |

## File Structure

```
src/orchestrator/
├── api/
│   └── models/
│       └── idea.py                   # Pydantic models
├── routes/
│   └── ideas_api.py                  # FastAPI router
└── services/
    └── ideas_service.py              # Business logic

docker/hitl-ui/src/
├── api/
│   ├── ideas.ts                      # API client
│   └── mocks/
│       └── ideas.ts                  # Mock data
├── stores/
│   └── ideasStore.ts                 # Zustand store
└── types/
    └── ideas.ts                      # TypeScript interfaces

tests/
└── unit/
    └── orchestrator/
        ├── api/models/
        │   └── test_idea.py
        ├── routes/
        │   └── test_ideas_api.py
        └── services/
            └── test_ideas_service.py
```

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Elasticsearch index grows large | Medium | Medium | Implement archival policy, use ILM |
| Embedding generation latency | Low | Medium | Async processing, caching |
| Word count gaming (short words) | Low | Low | Consider character limit as secondary check |
| Multi-tenancy data isolation | High | Low | Use tenant-prefixed indices (existing pattern) |

## Success Metrics

1. **API Performance**: p95 latency < 200ms for list operations
2. **Storage Efficiency**: Ideas indexed within 500ms of creation
3. **Search Relevance**: Full-text search returns relevant results in top 5
4. **Adoption**: 10+ ideas created within first week of launch
