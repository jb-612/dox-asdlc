# P02-F04: User Stories

## Epic Summary

Replace ChromaDB with Elasticsearch as the KnowledgeStore backend, providing production-grade vector search capabilities while maintaining the existing protocol interface. This enables enterprise deployment patterns and improved search performance.

---

## US-01: Elasticsearch Document Indexing

**As a** system component
**I want to** index documents with embeddings into Elasticsearch
**So that** documents are stored for semantic search retrieval

### Acceptance Criteria

- [ ] Documents are indexed with doc_id, content, embedding, and metadata
- [ ] Embeddings are generated automatically if not provided
- [ ] Existing documents are updated (upsert behavior)
- [ ] Index is created with proper mapping on first indexing
- [ ] IndexingError is raised with details on failure
- [ ] Operation completes within 500ms for single document

### Test Cases

```python
def test_index_document_creates_with_embedding():
    """Document without embedding gets embedding generated and indexed."""

def test_index_document_uses_provided_embedding():
    """Document with embedding uses provided vector."""

def test_index_document_upserts_existing():
    """Re-indexing same doc_id updates the document."""

def test_index_document_creates_index_if_missing():
    """First indexing operation creates the index with mapping."""

def test_index_document_raises_on_connection_error():
    """IndexingError raised when Elasticsearch unreachable."""
```

---

## US-02: kNN Semantic Search

**As an** agent requiring context enrichment
**I want to** search for semantically similar documents
**So that** I can retrieve relevant context for my task

### Acceptance Criteria

- [ ] Search returns documents ranked by cosine similarity
- [ ] Query text is converted to embedding for vector search
- [ ] top_k parameter limits result count
- [ ] num_candidates is configurable for recall/latency tradeoff
- [ ] Results include doc_id, content, metadata, and score
- [ ] Empty result set returned when no matches found
- [ ] Search completes within 200ms for typical queries

### Test Cases

```python
def test_search_returns_ranked_results():
    """Search returns documents ordered by similarity score."""

def test_search_respects_top_k():
    """Search returns at most top_k results."""

def test_search_includes_score():
    """Results include similarity score from Elasticsearch."""

def test_search_handles_empty_index():
    """Search on empty index returns empty list."""

def test_search_uses_num_candidates():
    """num_candidates parameter controls HNSW recall."""
```

---

## US-03: Metadata Filtering

**As an** agent with specific context needs
**I want to** filter search results by metadata
**So that** I only retrieve documents matching my criteria

### Acceptance Criteria

- [ ] Filters are combined with kNN search
- [ ] Exact match filters work for keyword fields
- [ ] Range filters work for numeric fields
- [ ] Multiple filters are ANDed together
- [ ] Invalid filter fields raise SearchError
- [ ] Filters do not impact ranking order

### Test Cases

```python
def test_search_with_metadata_filter():
    """Search with filter returns only matching documents."""

def test_search_with_multiple_filters():
    """Multiple filters are applied together (AND)."""

def test_search_filter_on_unknown_field():
    """Filter on non-existent field returns empty results."""

def test_search_filter_preserves_ranking():
    """Filtered results maintain similarity ranking."""
```

---

## US-04: Document Retrieval by ID

**As a** system component
**I want to** retrieve a specific document by its ID
**So that** I can access document content directly without search

### Acceptance Criteria

- [ ] Document retrieved by exact doc_id match
- [ ] Returns Document object with all fields
- [ ] Returns None when document not found
- [ ] Includes embedding in returned document if stored
- [ ] BackendConnectionError raised on Elasticsearch failure

### Test Cases

```python
def test_get_by_id_returns_document():
    """get_by_id retrieves indexed document."""

def test_get_by_id_returns_none_for_missing():
    """get_by_id returns None for non-existent doc_id."""

def test_get_by_id_includes_embedding():
    """Retrieved document includes stored embedding."""

def test_get_by_id_includes_metadata():
    """Retrieved document includes all metadata fields."""
```

---

## US-05: Document Deletion

**As a** system component
**I want to** delete documents from the store
**So that** obsolete or incorrect documents are removed

### Acceptance Criteria

- [ ] Document deleted by doc_id
- [ ] Returns True when document was deleted
- [ ] Returns False when document not found
- [ ] Deleted documents no longer appear in search
- [ ] BackendConnectionError raised on Elasticsearch failure

### Test Cases

```python
def test_delete_removes_document():
    """delete removes document from index."""

def test_delete_returns_false_for_missing():
    """delete returns False for non-existent doc_id."""

def test_deleted_document_not_in_search():
    """Deleted documents do not appear in search results."""
```

---

## US-06: Multi-Tenant Index Isolation

**As a** multi-tenant deployment
**I want to** isolate documents by tenant
**So that** tenants cannot access each other's documents

### Acceptance Criteria

- [ ] Index names include tenant prefix in multi-tenant mode
- [ ] Each tenant has separate Elasticsearch index
- [ ] Documents include tenant_id field
- [ ] Search only returns current tenant's documents
- [ ] Single-tenant mode uses default index name
- [ ] Tenant context propagated from TenantContext

### Test Cases

```python
def test_index_name_includes_tenant_prefix():
    """Index name is tenant_{tenant_id}_{prefix}_documents."""

def test_tenants_have_separate_indexes():
    """Different tenants index to different indexes."""

def test_search_isolated_by_tenant():
    """Tenant A cannot see Tenant B's documents."""

def test_single_tenant_mode_uses_default():
    """Single-tenant mode uses {prefix}_documents."""
```

---

## US-07: Health Check

**As an** operator
**I want to** check Elasticsearch health
**So that** I can monitor the knowledge store status

### Acceptance Criteria

- [ ] Health check returns cluster status (green/yellow/red)
- [ ] Includes backend name "elasticsearch"
- [ ] Includes connection URL
- [ ] Includes index name for current tenant
- [ ] Returns "unhealthy" status on connection failure
- [ ] Does not expose sensitive credentials

### Test Cases

```python
def test_health_check_returns_healthy():
    """health_check returns healthy status for connected cluster."""

def test_health_check_includes_cluster_status():
    """health_check includes Elasticsearch cluster status."""

def test_health_check_handles_connection_error():
    """health_check returns unhealthy on connection failure."""

def test_health_check_excludes_credentials():
    """health_check does not expose API key."""
```

---

## US-08: Factory Backend Selection

**As a** system deployer
**I want to** select Elasticsearch via configuration
**So that** I can switch backends without code changes

### Acceptance Criteria

- [ ] `KNOWLEDGE_STORE_BACKEND=elasticsearch` creates ElasticsearchStore
- [ ] Elasticsearch is the new default backend
- [ ] ChromaDB selection logs deprecation warning
- [ ] Factory returns singleton instance
- [ ] reset_knowledge_store() clears singleton

### Test Cases

```python
def test_factory_creates_elasticsearch_store():
    """get_knowledge_store with backend=elasticsearch returns ElasticsearchStore."""

def test_factory_default_is_elasticsearch():
    """get_knowledge_store without backend config returns ElasticsearchStore."""

def test_factory_chromadb_logs_deprecation():
    """get_knowledge_store with backend=chromadb logs warning."""

def test_factory_returns_singleton():
    """Repeated calls return same instance."""
```

---

## US-09: ChromaDB Deprecation

**As a** migration planner
**I want** ChromaDB to remain available with warnings
**So that** users have time to migrate to Elasticsearch

### Acceptance Criteria

- [ ] ChromaDB backend still functional
- [ ] Deprecation warning logged on ChromaDB instantiation
- [ ] Warning includes migration guidance
- [ ] Deprecation period is 30 days
- [ ] Documentation notes ChromaDB deprecation

### Test Cases

```python
def test_chromadb_still_functional():
    """ChromaDB backend continues to work during deprecation."""

def test_chromadb_logs_deprecation_warning():
    """ChromaDB instantiation logs deprecation warning."""

def test_deprecation_warning_includes_guidance():
    """Warning message includes migration instructions."""
```

---

## US-10: Docker Compose Deployment

**As a** developer
**I want** Elasticsearch in docker-compose.yml
**So that** I can run the full stack locally

### Acceptance Criteria

- [ ] chromadb service replaced with elasticsearch
- [ ] Elasticsearch accessible on port 9200
- [ ] Health check configured for cluster health
- [ ] Persistent volume for data
- [ ] orchestrator and workers depend on elasticsearch
- [ ] Environment variables updated for ES connection

### Test Cases

```bash
# Manual verification:
docker-compose up -d
curl http://localhost:9200/_cluster/health  # Returns status
docker-compose down -v  # Clean shutdown
```

---

## US-11: Kubernetes Helm Deployment

**As an** operator
**I want** Elasticsearch Helm chart
**So that** I can deploy to Kubernetes

### Acceptance Criteria

- [ ] elasticsearch subchart created under helm/dox-asdlc/charts/
- [ ] StatefulSet with persistent volume claim
- [ ] Service named "knowledge-store" for abstraction
- [ ] ConfigMap for Elasticsearch settings
- [ ] values.yaml configures resources and persistence
- [ ] chromadb subchart disabled by default

### Test Cases

```bash
# Manual verification:
helm template . --set chromadb.enabled=false --set elasticsearch.enabled=true
helm install dox-asdlc . -n dox-asdlc --dry-run
```
