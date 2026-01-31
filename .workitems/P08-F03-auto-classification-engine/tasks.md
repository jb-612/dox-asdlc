# P08-F03: Auto-Classification Engine - Tasks

## Progress

- Started: Not started
- Tasks Complete: 0/18
- Percentage: 0%
- Status: PLANNED
- Blockers: P08-F01 (Ideas Repository Core)

---

## Phase 1: Data Models & Taxonomy

### T01: Create classification Pydantic models

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/api/models/test_classification.py`
- [ ] Dependencies: P08-F01
- [ ] Agent: backend

**File:** `src/orchestrator/api/models/classification.py`

**Implement:**
- `ClassificationResult` model
- `ClassificationRequest`, `BatchClassificationRequest` models
- `LabelTaxonomy` model
- `LabelDefinition` model
- `ClassificationJob` model (for batch processing)

---

### T02: Create LabelTaxonomyService

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/orchestrator/services/test_label_taxonomy_service.py`
- [ ] Dependencies: T01
- [ ] Agent: backend

**File:** `src/orchestrator/services/label_taxonomy_service.py`

**Implement:**
- `LabelTaxonomyService` class
- `get_taxonomy()` - load current taxonomy
- `update_taxonomy()` - save updated taxonomy
- `add_label()` - add new label to taxonomy
- `update_label()` - update existing label
- `delete_label()` - remove label from taxonomy
- `get_label()` - get single label by ID
- `to_prompt_format()` - format for LLM prompt
- Default taxonomy initialization

---

### T03: Create classification TypeScript types

- [ ] Estimate: 30min
- [ ] Tests: N/A (types only)
- [ ] Dependencies: T01
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/types/classification.ts`

**Implement:**
- `ClassificationResult` interface
- `LabelTaxonomy`, `LabelDefinition` interfaces
- `ClassificationStatus` type
- Update `Idea` interface with classification fields

---

## Phase 2: Classification Service

### T04: Create ClassificationService core

- [ ] Estimate: 2hr
- [ ] Tests: `tests/unit/orchestrator/services/test_classification_service.py`
- [ ] Dependencies: T01, T02
- [ ] Agent: backend

**File:** `src/orchestrator/services/classification_service.py`

**Implement:**
- `ClassificationService` class
- `classify_idea()` - classify single idea
- `build_classification_prompt()` - construct LLM prompt
- `parse_classification_response()` - parse LLM JSON response
- `validate_labels()` - validate against taxonomy
- `store_classification_result()` - save result
- `get_classification_result()` - retrieve result

---

### T05: Integrate with LLM factory

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/services/test_classification_service.py`
- [ ] Dependencies: T04
- [ ] Agent: backend

**File:** `src/orchestrator/services/classification_service.py` (addition)

**Implement:**
- Integration with `LLMClientFactory`
- Use `AgentRole.DISCOVERY` for classification
- Handle LLM errors with retry logic
- Configure temperature (0.3) for consistency
- Fallback to rule-based classification if LLM fails

---

### T06: Create classification prompts

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/services/test_classification_service.py`
- [ ] Dependencies: T04
- [ ] Agent: backend

**File:** `src/orchestrator/services/classification_prompts.py`

**Implement:**
- `CLASSIFICATION_PROMPT` template
- `build_taxonomy_context()` - format taxonomy for prompt
- `FUNCTIONAL_EXAMPLES` - few-shot examples
- `NON_FUNCTIONAL_EXAMPLES` - few-shot examples
- Prompt versioning for tracking

---

## Phase 3: Async Processing

### T07: Create classification worker

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/workers/test_classification_worker.py`
- [ ] Dependencies: T04
- [ ] Agent: backend

**File:** `src/workers/classification_worker.py`

**Implement:**
- `ClassificationWorker` class
- Redis queue integration
- `enqueue()` - add job to queue
- `process_queue()` - main processing loop
- Job status tracking (queued, processing, complete, failed)
- Retry logic with exponential backoff
- Graceful shutdown handling

---

### T08: Create batch classification endpoint

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/routes/test_classification_api.py`
- [ ] Dependencies: T07
- [ ] Agent: backend

**File:** `src/orchestrator/routes/classification_api.py`

**Endpoints:**
- `POST /api/ideas/classify/batch` - queue batch job
- `GET /api/ideas/classify/job/{job_id}` - check job status

**Implement:**
- Batch job creation
- Status polling endpoint
- Job result aggregation

---

### T09: Auto-trigger classification on idea creation

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/services/test_ideas_service.py`
- [ ] Dependencies: T07, P08-F01
- [ ] Agent: backend

**File:** `src/orchestrator/services/ideas_service.py` (addition)

**Implement:**
- Hook in `create_idea()` to enqueue classification
- Non-blocking async queue operation
- Set initial classification to "undetermined"
- Handle queue failures gracefully

---

## Phase 4: API Endpoints

### T10: Create classification API router

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/orchestrator/routes/test_classification_api.py`
- [ ] Dependencies: T04, T07
- [ ] Agent: backend

**File:** `src/orchestrator/routes/classification_api.py`

**Endpoints:**
- `POST /api/ideas/{idea_id}/classify` - classify single idea
- `POST /api/ideas/{idea_id}/labels` - add labels
- `DELETE /api/ideas/{idea_id}/labels/{label}` - remove label

**Implement:**
- Input validation
- Authorization checks
- Error handling

---

### T11: Create taxonomy admin API

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/routes/test_classification_api.py`
- [ ] Dependencies: T02
- [ ] Agent: backend

**File:** `src/orchestrator/routes/classification_api.py` (addition)

**Endpoints:**
- `GET /api/admin/labels/taxonomy` - get taxonomy
- `PUT /api/admin/labels/taxonomy` - update taxonomy
- `POST /api/admin/labels/taxonomy/labels` - add label
- `PUT /api/admin/labels/taxonomy/labels/{id}` - update label
- `DELETE /api/admin/labels/taxonomy/labels/{id}` - delete label

---

### T12: Register classification routes

- [ ] Estimate: 15min
- [ ] Tests: Manual verification
- [ ] Dependencies: T10, T11
- [ ] Agent: backend

**File:** `src/orchestrator/main.py`

**Implement:**
- Import classification_api router
- Register routes
- Add OpenAPI tags

---

## Phase 5: Frontend Components

### T13: Create ClassificationBadge component

- [ ] Estimate: 1hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/ClassificationBadge.test.tsx`
- [ ] Dependencies: T03
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/ClassificationBadge.tsx`

**Implement:**
- Badge showing functional/non-functional/undetermined
- Color coding (green/blue/gray)
- Confidence percentage display
- Tooltip with reasoning
- "Processing" state animation
- Click handler for details

---

### T14: Create LabelEditor component

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/LabelEditor.test.tsx`
- [ ] Dependencies: T03
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/LabelEditor.tsx`

**Implement:**
- Display current labels as badges
- Add label button with picker dropdown
- Search/filter in picker
- Remove label (x) button
- Auto-assigned vs manual indicator
- Taxonomy-aware suggestions
- Keyboard navigation

---

### T15: Create AdminLabelsPage

- [ ] Estimate: 2hr
- [ ] Tests: `docker/hitl-ui/src/pages/AdminLabelsPage.test.tsx`
- [ ] Dependencies: T03, T11
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/pages/AdminLabelsPage.tsx`

**Implement:**
- List all labels in taxonomy
- Add new label form
- Edit label form (name, description, keywords, color)
- Delete with confirmation
- Color picker
- Preview badge
- Route: `/admin/labels`

---

### T16: Update IdeaCard with classification display

- [ ] Estimate: 1hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/IdeaCard.test.tsx`
- [ ] Dependencies: T13, T14, P08-F01
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/IdeaCard.tsx` (update)

**Implement:**
- Add ClassificationBadge to card
- Display labels row
- Re-classify button
- Handle "processing" state

---

## Phase 6: Testing & Integration

### T17: Integration tests for classification

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/integration/orchestrator/test_classification.py`
- [ ] Dependencies: T10, T07
- [ ] Agent: backend

**Implement:**
- Test full classification flow
- Test batch processing
- Test taxonomy updates
- Test async worker processing
- Test LLM mock responses
- Test error handling

---

### T18: Add classification filter to IdeasFilter

- [ ] Estimate: 1hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/IdeasFilter.test.tsx`
- [ ] Dependencies: T03, P08-F01
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/IdeasFilter.tsx` (update)

**Implement:**
- Classification dropdown filter
- Integration with existing filters
- Clear filter functionality
- Count per classification

---

## Task Dependencies Graph

```
T01 ───┬──► T02 ───┬──► T04 ───┬──► T05
       │           │           │
       │           │           └──► T06
       │           │
       │           └──► T11 ───► T15
       │
       └──► T03 ───┬──► T13 ───┬──► T16
                   │           │
                   ├──► T14 ───┤
                   │           │
                   └──► T18 ───┘

T04 ───► T07 ───► T08 ───► T17
              │
              └──► T09

T10 ───► T12 (depends on T04, T07)
T11 ───► T12
```

---

## Verification Checklist

### Unit Tests
- [ ] `pytest tests/unit/orchestrator/api/models/test_classification.py`
- [ ] `pytest tests/unit/orchestrator/services/test_classification_service.py`
- [ ] `pytest tests/unit/orchestrator/services/test_label_taxonomy_service.py`
- [ ] `pytest tests/unit/orchestrator/routes/test_classification_api.py`
- [ ] `pytest tests/unit/workers/test_classification_worker.py`
- [ ] `npm test -- src/components/ideas/ClassificationBadge`
- [ ] `npm test -- src/components/ideas/LabelEditor`

### Integration Tests
- [ ] `pytest tests/integration/orchestrator/test_classification.py`

### Manual Verification
1. Create idea -> Classification happens within 30s
2. View classification badge -> Shows result and confidence
3. Add/remove labels -> Changes saved
4. Re-classify idea -> New result applied
5. Batch classify 10 ideas -> All processed
6. Configure taxonomy -> New labels appear in picker

---

## Estimates Summary

| Phase | Tasks | Total Estimate |
|-------|-------|----------------|
| Phase 1: Models & Taxonomy | T01-T03 | 3hr |
| Phase 2: Service | T04-T06 | 4hr |
| Phase 3: Async | T07-T09 | 3.5hr |
| Phase 4: API | T10-T12 | 2.75hr |
| Phase 5: Frontend | T13-T16 | 5.5hr |
| Phase 6: Testing | T17-T18 | 2.5hr |

**Total Estimate:** ~21 hours
