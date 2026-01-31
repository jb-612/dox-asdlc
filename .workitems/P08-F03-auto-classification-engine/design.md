# P08-F03: Auto-Classification Engine - Technical Design

## Overview

Implement an LLM-powered classification engine that automatically categorizes ideas as functional vs non-functional requirements and assigns system area labels. The engine runs asynchronously after idea creation and can be re-triggered manually for refinement.

### Problem Statement

When ideas are submitted, users must manually classify them, leading to:
- Inconsistent classification across team members
- Time spent on categorization instead of ideation
- Missing labels that would help with discovery
- Difficulty grouping related ideas by system area

### Solution

An automated classification engine that:
1. Uses LLM to classify ideas as functional or non-functional
2. Suggests system area labels based on content analysis
3. Runs asynchronously after idea creation (non-blocking)
4. Supports manual override and refinement
5. Maintains a configurable label taxonomy
6. Learns from user corrections (future enhancement)

## Dependencies

### Internal Dependencies

| Feature | Purpose | Status |
|---------|---------|--------|
| P08-F01 | Ideas Repository Core (idea storage) | Required |
| P05-F13 | LLM Admin Configuration (model selection) | Complete |
| P03-F01 | Worker Pool (async processing) | Complete |

### External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| anthropic | ^0.18.0 | Claude API client |
| openai | ^1.12.0 | OpenAI API client (fallback) |
| redis | ^5.0.0 | Job queue for async processing |

## Interfaces

### Provided Interfaces

#### Classification Models

```python
# src/orchestrator/api/models/classification.py

class ClassificationResult(BaseModel):
    """Result of idea classification."""
    idea_id: str
    classification: IdeaClassification      # functional, non_functional, undetermined
    confidence: float                       # 0.0 - 1.0
    reasoning: str                          # Brief explanation
    suggested_labels: list[str]             # System area labels
    label_scores: dict[str, float]          # Confidence per label
    processed_at: str                       # ISO 8601
    model_used: str                         # Model identifier

class ClassificationRequest(BaseModel):
    """Request to classify an idea."""
    idea_id: str
    force_reclassify: bool = False          # Override existing classification

class BatchClassificationRequest(BaseModel):
    """Request to classify multiple ideas."""
    idea_ids: list[str]
    force_reclassify: bool = False

class LabelTaxonomy(BaseModel):
    """Configurable label taxonomy."""
    id: str
    name: str                               # e.g., "System Areas"
    labels: list[LabelDefinition]
    created_at: str
    updated_at: str

class LabelDefinition(BaseModel):
    """Definition of a label in the taxonomy."""
    id: str
    name: str                               # e.g., "Authentication"
    description: str                        # For LLM context
    keywords: list[str]                     # Matching keywords
    parent_id: str | None = None            # For hierarchical labels
    color: str = "#6B7280"                  # Display color
```

#### API Endpoints

```python
# POST /api/ideas/{idea_id}/classify
# Trigger classification for a single idea
# Returns: ClassificationResult

# POST /api/ideas/classify/batch
# Trigger classification for multiple ideas
# Returns: { "job_id": str, "status": "queued" }

# GET /api/ideas/classify/job/{job_id}
# Check batch classification job status
# Returns: { "status": str, "completed": int, "total": int, "results": list }

# GET /api/admin/labels/taxonomy
# Get the current label taxonomy
# Returns: LabelTaxonomy

# PUT /api/admin/labels/taxonomy
# Update the label taxonomy
# Request: LabelTaxonomy

# POST /api/ideas/{idea_id}/labels
# Manually add labels (override auto-classification)
# Request: { "labels": list[str] }

# DELETE /api/ideas/{idea_id}/labels/{label}
# Remove a label from an idea
```

### Required Interfaces

#### LLM Prompt Contracts

```python
# Classification prompt structure
CLASSIFICATION_PROMPT = """
Analyze the following product idea and classify it.

IDEA:
{idea_content}

INSTRUCTIONS:
1. Classify as "functional" (describes what the system should do) or "non_functional" (describes how the system should perform)
2. Assign relevant system area labels from the taxonomy
3. Provide confidence scores and brief reasoning

LABEL TAXONOMY:
{taxonomy_json}

Respond in JSON format:
{
  "classification": "functional" | "non_functional" | "undetermined",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "labels": ["label1", "label2"],
  "label_scores": {"label1": 0.9, "label2": 0.7}
}
"""
```

## Technical Approach

### Architecture

```
+------------------------------------------------------------------+
|                   Auto-Classification Engine                      |
+------------------------------------------------------------------+
|                                                                   |
|  Trigger Events                                                   |
|  +------------------------------------------------------------+  |
|  |  Idea Created    Manual Request    Batch Processing         |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|                    Classification Queue (Redis)                   |
|                              |                                    |
|  +------------------------------------------------------------+  |
|  |  ClassificationWorker                                       |  |
|  |  - Picks up classification jobs                             |  |
|  |  - Calls LLM for classification                             |  |
|  |  - Updates idea with results                                |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  +------------------------------------------------------------+  |
|  |  ClassificationService                                      |  |
|  |  - Builds prompts with taxonomy                             |  |
|  |  - Calls LLM via factory                                    |  |
|  |  - Parses and validates results                             |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  +---------------------------+----------------------------------+  |
|  | LLMClientFactory         | LabelTaxonomyService             |  |
|  | (from P05-F13)           | - Load taxonomy                  |  |
|  +---------------------------+----------------------------------+  |
|                                                                   |
+------------------------------------------------------------------+
```

### Classification Flow

```python
async def classify_idea(idea_id: str, force: bool = False) -> ClassificationResult:
    """Classify a single idea."""

    # 1. Get the idea
    idea = await ideas_service.get_idea(idea_id)
    if not idea:
        raise IdeaNotFoundError(idea_id)

    # 2. Check if already classified (unless force)
    if not force and idea.classification != IdeaClassification.UNDETERMINED:
        return await get_existing_classification(idea_id)

    # 3. Get label taxonomy
    taxonomy = await label_taxonomy_service.get_taxonomy()

    # 4. Build prompt
    prompt = CLASSIFICATION_PROMPT.format(
        idea_content=idea.content,
        taxonomy_json=taxonomy.to_prompt_format()
    )

    # 5. Call LLM
    llm_client = await llm_factory.get_client(AgentRole.DISCOVERY)
    response = await llm_client.generate(
        prompt=prompt,
        max_tokens=500,
        temperature=0.3,  # Lower temperature for consistency
    )

    # 6. Parse response
    result = parse_classification_response(response.content)

    # 7. Validate labels against taxonomy
    valid_labels = validate_labels(result.labels, taxonomy)

    # 8. Update idea
    await ideas_service.update_idea(idea_id, {
        "classification": result.classification,
        "labels": list(set(idea.labels + valid_labels)),
    })

    # 9. Store classification result
    classification_result = ClassificationResult(
        idea_id=idea_id,
        classification=result.classification,
        confidence=result.confidence,
        reasoning=result.reasoning,
        suggested_labels=valid_labels,
        label_scores=result.label_scores,
        processed_at=datetime.now(UTC).isoformat(),
        model_used=llm_client.model,
    )
    await store_classification_result(classification_result)

    return classification_result
```

### Async Processing with Redis Queue

```python
# Worker for async classification
class ClassificationWorker:
    def __init__(self, redis_client: Redis, service: ClassificationService):
        self._redis = redis_client
        self._service = service
        self._queue_key = "classification:queue"
        self._processing_key = "classification:processing"

    async def enqueue(self, idea_id: str, force: bool = False) -> str:
        """Add idea to classification queue."""
        job_id = str(uuid.uuid4())
        job = {
            "job_id": job_id,
            "idea_id": idea_id,
            "force": force,
            "queued_at": datetime.now(UTC).isoformat(),
        }
        await self._redis.lpush(self._queue_key, json.dumps(job))
        return job_id

    async def process_queue(self):
        """Process classification queue (run in background)."""
        while True:
            # Block until job available
            _, job_data = await self._redis.brpop(self._queue_key)
            job = json.loads(job_data)

            try:
                # Mark as processing
                await self._redis.hset(
                    self._processing_key,
                    job["job_id"],
                    json.dumps({"status": "processing", **job})
                )

                # Classify
                result = await self._service.classify_idea(
                    job["idea_id"],
                    force=job["force"]
                )

                # Mark complete
                await self._redis.hset(
                    self._processing_key,
                    job["job_id"],
                    json.dumps({"status": "complete", "result": result.dict(), **job})
                )

            except Exception as e:
                logger.error(f"Classification failed for {job['idea_id']}: {e}")
                await self._redis.hset(
                    self._processing_key,
                    job["job_id"],
                    json.dumps({"status": "failed", "error": str(e), **job})
                )
```

### Default Label Taxonomy

```python
DEFAULT_TAXONOMY = LabelTaxonomy(
    id="default",
    name="System Areas",
    labels=[
        LabelDefinition(
            id="authentication",
            name="Authentication",
            description="User login, signup, password management, OAuth, SSO",
            keywords=["login", "signup", "password", "auth", "sso", "oauth"],
            color="#EF4444",
        ),
        LabelDefinition(
            id="dashboard",
            name="Dashboard",
            description="Main interface, metrics display, overview screens",
            keywords=["dashboard", "overview", "metrics", "home", "main"],
            color="#3B82F6",
        ),
        LabelDefinition(
            id="api",
            name="API",
            description="REST endpoints, integrations, webhooks, data exchange",
            keywords=["api", "endpoint", "integration", "webhook", "rest"],
            color="#10B981",
        ),
        LabelDefinition(
            id="reporting",
            name="Reporting",
            description="Reports, exports, analytics, charts, data visualization",
            keywords=["report", "export", "analytics", "chart", "csv", "pdf"],
            color="#8B5CF6",
        ),
        LabelDefinition(
            id="notifications",
            name="Notifications",
            description="Alerts, emails, push notifications, reminders",
            keywords=["notification", "alert", "email", "push", "reminder"],
            color="#F59E0B",
        ),
        LabelDefinition(
            id="search",
            name="Search",
            description="Search functionality, filters, discovery, indexing",
            keywords=["search", "filter", "find", "query", "index"],
            color="#EC4899",
        ),
        LabelDefinition(
            id="performance",
            name="Performance",
            description="Speed, latency, caching, optimization",
            keywords=["performance", "speed", "latency", "cache", "fast", "slow"],
            color="#6366F1",
        ),
        LabelDefinition(
            id="security",
            name="Security",
            description="Access control, encryption, audit, compliance",
            keywords=["security", "access", "permission", "encrypt", "audit"],
            color="#DC2626",
        ),
        LabelDefinition(
            id="ux",
            name="User Experience",
            description="UI improvements, usability, accessibility, design",
            keywords=["ux", "ui", "usability", "design", "accessibility", "user experience"],
            color="#06B6D4",
        ),
        LabelDefinition(
            id="data",
            name="Data Management",
            description="Storage, backup, import, export, migration",
            keywords=["data", "storage", "backup", "import", "export", "migrate"],
            color="#84CC16",
        ),
    ],
)
```

### Error Handling

| Error Type | Handling Strategy |
|------------|-------------------|
| LLM timeout | Retry up to 3 times with exponential backoff |
| Invalid JSON response | Log error, mark as undetermined |
| Unknown labels | Filter out, log warning |
| Idea not found | Return 404, remove from queue |
| Rate limit | Delay processing, use backoff |

## File Structure

```
src/orchestrator/
├── api/
│   └── models/
│       └── classification.py          # Pydantic models
├── routes/
│   └── classification_api.py          # API endpoints
└── services/
    ├── classification_service.py      # Classification logic
    └── label_taxonomy_service.py      # Taxonomy management

src/workers/
└── classification_worker.py           # Async queue worker

docker/hitl-ui/src/
├── components/
│   └── ideas/
│       ├── LabelEditor.tsx            # Label editing UI
│       └── ClassificationBadge.tsx    # Display classification
└── pages/
    └── AdminLabelsPage.tsx            # Taxonomy management

tests/
└── unit/
    └── orchestrator/
        └── services/
            └── test_classification_service.py
```

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| LLM inconsistency | Medium | Medium | Use low temperature, validate against taxonomy |
| Cost of LLM calls | Medium | Medium | Cache results, batch processing |
| Taxonomy mismatch | Low | Medium | Allow custom labels, regular taxonomy updates |
| Classification latency | Low | Low | Async processing, don't block creation |

## Success Metrics

1. **Classification Accuracy**: 85%+ match with human review
2. **Processing Time**: p95 < 5 seconds for single classification
3. **Label Coverage**: 90%+ of ideas receive at least one label
4. **User Override Rate**: < 20% of classifications manually changed
