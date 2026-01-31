# P08-F04: Correlation Engine - User Stories

## Epic Summary

Implement a correlation engine that uses vector similarity and graph-based relationships to find similar, complementary, or duplicate ideas with user review workflow for accept/reject/refine suggestions.

---

## User Stories

### US-01: Find similar ideas

**As a** user viewing an idea,
**I want** to find similar ideas,
**So that** I can discover related concepts and avoid duplicates.

**Acceptance Criteria:**
- [ ] "Find Similar" button is visible on idea detail
- [ ] Click shows panel with similar ideas ranked by similarity
- [ ] Similarity score is displayed (0-100%)
- [ ] Each result shows idea preview and correlation type
- [ ] Results are paginated if many found
- [ ] Empty state when no similar ideas found

**Test Scenarios:**
1. Click "Find Similar" on idea -> Shows similar ideas panel
2. Idea with duplicates -> Shows high-similarity matches first
3. Unique idea -> Shows "No similar ideas found"
4. Click similar idea -> Opens that idea's detail

---

### US-02: View correlation suggestions

**As a** user viewing an idea,
**I want** to see suggested correlations,
**So that** I can review and confirm relationships.

**Acceptance Criteria:**
- [ ] Suggestions panel shows pending correlations
- [ ] Badge shows count of pending suggestions
- [ ] Each suggestion shows target idea and reasoning
- [ ] Suggestions sorted by confidence score
- [ ] Can expand suggestion to see full context

**Test Scenarios:**
1. Idea with 3 suggestions -> Shows 3 pending suggestions
2. Click suggestion -> Expands to show details
3. No suggestions -> Panel hidden or shows "No suggestions"

---

### US-03: Accept correlation suggestion

**As a** user reviewing a correlation,
**I want** to accept the suggestion,
**So that** the relationship is recorded.

**Acceptance Criteria:**
- [ ] "Accept" button on each suggestion
- [ ] Accepting updates status to "accepted"
- [ ] Correlation appears in both ideas' relationships
- [ ] Suggestion is removed from pending list
- [ ] Success confirmation is shown

**Test Scenarios:**
1. Click "Accept" -> Correlation saved as accepted
2. View target idea -> Shows correlation in relationships
3. Accept duplicate -> Both ideas marked as duplicates

---

### US-04: Reject correlation suggestion

**As a** user reviewing a correlation,
**I want** to reject an incorrect suggestion,
**So that** it doesn't appear again.

**Acceptance Criteria:**
- [ ] "Reject" button on each suggestion
- [ ] Rejecting updates status to "rejected"
- [ ] Suggestion is removed from pending list
- [ ] Rejected correlations don't reappear
- [ ] Can optionally add rejection reason

**Test Scenarios:**
1. Click "Reject" -> Suggestion marked as rejected
2. Find similar again -> Rejected idea not suggested
3. Bulk reject -> Multiple rejections processed

---

### US-05: Refine correlation type

**As a** user reviewing a correlation,
**I want** to change the correlation type,
**So that** I can correct the system's inference.

**Acceptance Criteria:**
- [ ] "Refine" option shows correlation type dropdown
- [ ] Types: Similar, Duplicate, Complementary, Contradicts, Related
- [ ] Can add notes explaining the relationship
- [ ] Refinement saves as "refined" status
- [ ] Original suggestion type is preserved

**Test Scenarios:**
1. Change "Similar" to "Complementary" -> Type updated
2. Add notes -> Notes saved with correlation
3. View refined correlation -> Shows refined type and notes

---

### US-06: Create manual correlation

**As a** user,
**I want** to manually link two ideas,
**So that** I can capture relationships the system missed.

**Acceptance Criteria:**
- [ ] "Link to Idea" button on idea detail
- [ ] Search/select target idea
- [ ] Choose correlation type
- [ ] Add optional notes
- [ ] Correlation saved as "accepted"

**Test Scenarios:**
1. Link idea A to idea B -> Correlation created
2. Link already-linked ideas -> Error shown
3. Link to archived idea -> Warning shown

---

### US-07: View all correlations for an idea

**As a** user viewing an idea,
**I want** to see all its correlations,
**So that** I understand how it relates to other ideas.

**Acceptance Criteria:**
- [ ] Correlations tab shows all relationships
- [ ] Grouped by type (Similar, Duplicate, etc.)
- [ ] Each shows target idea preview
- [ ] Status indicator (accepted, refined)
- [ ] Can remove/edit correlations

**Test Scenarios:**
1. View idea with 5 correlations -> All shown grouped
2. Click correlation -> Opens target idea
3. Remove correlation -> Confirmation then deleted

---

### US-08: View correlation graph

**As a** product manager,
**I want** to visualize the correlation graph,
**So that** I can see idea clusters and relationships.

**Acceptance Criteria:**
- [ ] Graph view button opens visualization
- [ ] Nodes represent ideas (colored by classification)
- [ ] Edges show correlations (styled by type)
- [ ] Can zoom and pan
- [ ] Click node to view idea detail
- [ ] Filter by label or classification

**Test Scenarios:**
1. Open graph view -> Shows connected ideas
2. Zoom in on cluster -> Details visible
3. Click node -> Opens idea detail
4. Filter by "Performance" -> Only related ideas shown

---

### US-09: View idea clusters

**As a** product manager,
**I want** to see clusters of related ideas,
**So that** I can identify common themes.

**Acceptance Criteria:**
- [ ] Clusters page shows identified groups
- [ ] Each cluster shows name and idea count
- [ ] Expand cluster to see member ideas
- [ ] Can rename clusters
- [ ] Can merge clusters manually

**Test Scenarios:**
1. View clusters -> Shows 3 clusters
2. Expand cluster -> Shows 5 ideas
3. Rename cluster -> Name updated
4. Merge two clusters -> Combined into one

---

### US-10: Auto-suggest correlations on idea creation

**As a** user creating an idea,
**I want** to be warned about potential duplicates,
**So that** I can avoid creating duplicate ideas.

**Acceptance Criteria:**
- [ ] During creation, similar ideas are shown
- [ ] Warning if high-similarity idea exists
- [ ] Can proceed anyway or view existing idea
- [ ] After creation, correlations queued for review

**Test Scenarios:**
1. Create idea similar to existing -> Warning shown
2. Click "View Existing" -> Opens similar idea
3. Click "Create Anyway" -> Idea created with pending correlation

---

### US-11: Batch generate correlations

**As an** administrator,
**I want** to generate correlations for all ideas,
**So that** I can establish baseline relationships.

**Acceptance Criteria:**
- [ ] "Generate Correlations" button in admin
- [ ] Progress indicator during processing
- [ ] Configurable similarity threshold
- [ ] Results summary (new correlations found)
- [ ] Can cancel mid-process

**Test Scenarios:**
1. Run batch on 100 ideas -> Correlations generated
2. Set threshold 0.9 -> Fewer correlations found
3. Cancel at 50% -> Processed correlations kept

---

## Acceptance Test Summary

| Story | Test Count | Critical Path |
|-------|------------|---------------|
| US-01 | 4 | Yes |
| US-02 | 3 | Yes |
| US-03 | 3 | Yes |
| US-04 | 3 | Yes |
| US-05 | 3 | No |
| US-06 | 3 | No |
| US-07 | 3 | Yes |
| US-08 | 4 | No |
| US-09 | 4 | No |
| US-10 | 3 | Yes |
| US-11 | 3 | No |

**Total Tests:** 36
**Critical Path Tests:** 16

---

## Definition of Done

- [ ] All acceptance criteria met for each story
- [ ] Unit tests pass with 80%+ coverage
- [ ] Vector similarity search returns in < 500ms
- [ ] Graph visualization renders smoothly
- [ ] Accept/reject workflow complete
- [ ] Integration with Ideas Repository verified
- [ ] No critical or high security vulnerabilities
