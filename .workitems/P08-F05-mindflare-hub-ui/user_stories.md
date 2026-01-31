# P08-F05: Mindflare Hub UI - User Stories

## Epic Summary

Implement the Mindflare Hub frontend interface with Twitter-style cards, comprehensive filtering, correlation display, and Ideation Studio "Bake" integration, providing a cohesive user experience for the entire Mindflare Hub feature set.

---

## User Stories

### US-01: View Mindflare Hub homepage

**As a** team member,
**I want** to see the Mindflare Hub with all ideas,
**So that** I can discover and browse product concepts.

**Acceptance Criteria:**
- [ ] Mindflare Hub page loads at /mindflare route
- [ ] Ideas displayed in Twitter-style card format
- [ ] Cards show: content preview, author, timestamp, labels
- [ ] Default sort is newest first
- [ ] Pagination or infinite scroll for large lists
- [ ] Loading state during fetch

**Test Scenarios:**
1. Navigate to /mindflare -> Page loads with ideas
2. 100 ideas exist -> First 20 shown, pagination available
3. Network slow -> Loading skeleton shown
4. No ideas -> Empty state with "Create first idea" CTA

---

### US-02: Create new idea from Mindflare Hub

**As a** user,
**I want** to create an idea from the Mindflare Hub,
**So that** I can quickly capture a concept.

**Acceptance Criteria:**
- [ ] "+ New Idea" button prominently displayed
- [ ] Click opens idea creation form
- [ ] Form shows word count (144 limit)
- [ ] Can add labels during creation
- [ ] Submit creates idea and shows in list
- [ ] Cancel returns to list without changes

**Test Scenarios:**
1. Click "+ New Idea" -> Form opens
2. Enter 100 words, submit -> Idea created
3. Enter 145 words -> Submit disabled
4. Cancel during edit -> Form closes, no idea created

---

### US-03: View idea detail

**As a** user,
**I want** to view full details of an idea,
**So that** I can understand it completely.

**Acceptance Criteria:**
- [ ] Click idea card opens detail panel
- [ ] Full content displayed (not truncated)
- [ ] All labels shown
- [ ] Classification and confidence displayed
- [ ] Author and timestamp visible
- [ ] Source badge (Manual/Slack)
- [ ] Close button returns to list

**Test Scenarios:**
1. Click idea -> Detail panel opens
2. View 144-word idea -> All content visible
3. Close detail -> Returns to list
4. Click different idea -> Detail updates

---

### US-04: Search ideas

**As a** user,
**I want** to search ideas by keyword,
**So that** I can find specific concepts.

**Acceptance Criteria:**
- [ ] Search input prominently placed
- [ ] Search filters as user types (debounced)
- [ ] Results update immediately
- [ ] Search highlights matching text
- [ ] Clear button resets search
- [ ] "No results" state when no matches

**Test Scenarios:**
1. Type "authentication" -> Shows matching ideas
2. Clear search -> Shows all ideas
3. Search gibberish -> Shows "No results found"
4. Type fast -> Debounced, single request

---

### US-05: Filter ideas

**As a** user,
**I want** to filter ideas by various criteria,
**So that** I can focus on relevant concepts.

**Acceptance Criteria:**
- [ ] Filter by classification (Functional/Non-functional)
- [ ] Filter by labels (multi-select)
- [ ] Filter by status (Active/Baking/Archived)
- [ ] Filter by source (Manual/Slack)
- [ ] Active filters shown as pills
- [ ] Clear all filters button

**Test Scenarios:**
1. Filter by "Functional" -> Only functional ideas shown
2. Filter by 2 labels -> Ideas with either label shown
3. Apply multiple filters -> Intersection of filters
4. Clear all -> Full list restored

---

### US-06: Bake idea in Ideation Studio

**As a** user,
**I want** to "bake" an idea in Ideation Studio,
**So that** I can develop it into a full PRD.

**Acceptance Criteria:**
- [ ] "Bake in Studio" button on each idea card
- [ ] Click opens Ideation Studio with idea context
- [ ] Idea content becomes initial prompt
- [ ] Idea status changes to "Baking"
- [ ] Link back to original idea preserved

**Test Scenarios:**
1. Click "Bake" -> Opens Ideation Studio
2. Studio shows idea content -> Visible in chat
3. Return to Mindflare Hub -> Idea shows "Baking" status
4. Studio session links back -> Can navigate to idea

---

### US-07: View correlation suggestions

**As a** user viewing an idea,
**I want** to see correlation suggestions,
**So that** I can find related concepts.

**Acceptance Criteria:**
- [ ] "Suggestions" tab shows pending correlations
- [ ] Badge shows count of pending items
- [ ] Each suggestion shows target idea preview
- [ ] Similarity score visible
- [ ] Reasoning explains the suggestion

**Test Scenarios:**
1. Idea with 3 suggestions -> Badge shows "3"
2. Click suggestion -> Expands to show details
3. No suggestions -> Tab shows "No suggestions"

---

### US-08: Accept/reject/refine correlations

**As a** user reviewing suggestions,
**I want** to accept, reject, or refine them,
**So that** I can curate accurate relationships.

**Acceptance Criteria:**
- [ ] Accept button saves correlation as accepted
- [ ] Reject button marks as rejected
- [ ] Refine opens type dropdown
- [ ] Can add notes when refining
- [ ] Action removes from pending list
- [ ] Confirmation for destructive actions

**Test Scenarios:**
1. Click Accept -> Correlation saved, removed from pending
2. Click Reject -> Correlation rejected, removed
3. Refine to "Complementary" -> Type updated
4. Add notes -> Notes saved with correlation

---

### US-09: Find similar ideas

**As a** user viewing an idea,
**I want** to find similar ideas,
**So that** I can discover related concepts.

**Acceptance Criteria:**
- [ ] "Find Similar" button on idea detail
- [ ] Click shows similar ideas panel
- [ ] Results ranked by similarity
- [ ] Each result shows similarity percentage
- [ ] Can create correlation from result

**Test Scenarios:**
1. Click "Find Similar" -> Panel shows similar ideas
2. Most similar first -> Ranked by score
3. Click result -> Opens that idea
4. Link idea -> Creates correlation

---

### US-10: View idea correlations

**As a** user,
**I want** to view all correlations for an idea,
**So that** I can see how it relates to others.

**Acceptance Criteria:**
- [ ] "Correlations" tab shows all relationships
- [ ] Grouped by type (Similar, Complementary, etc.)
- [ ] Each shows target idea preview
- [ ] Can remove correlations
- [ ] Empty state when no correlations

**Test Scenarios:**
1. View idea with 5 correlations -> All shown
2. Click correlation -> Opens target idea
3. Remove correlation -> Confirmation, then removed
4. No correlations -> Empty state message

---

### US-11: View ideas graph

**As a** product manager,
**I want** to visualize the ideas graph,
**So that** I can see clusters and relationships.

**Acceptance Criteria:**
- [ ] "Graph View" link in navigation
- [ ] Graph shows ideas as nodes
- [ ] Edges show correlations
- [ ] Can zoom and pan
- [ ] Click node opens idea detail
- [ ] Filter graph by label

**Test Scenarios:**
1. Open graph -> Shows connected ideas
2. Zoom in -> Details visible
3. Click node -> Opens idea
4. Filter by label -> Only related shown

---

### US-12: Responsive mobile experience

**As a** mobile user,
**I want** to use Mindflare Hub on my phone,
**So that** I can capture ideas anywhere.

**Acceptance Criteria:**
- [ ] Layout adapts to mobile screen
- [ ] Single column card layout
- [ ] Detail opens as full-screen modal
- [ ] Touch-friendly buttons and interactions
- [ ] Filters accessible via bottom sheet
- [ ] Swipe gestures for navigation

**Test Scenarios:**
1. View on mobile -> Single column layout
2. Click idea -> Full-screen detail
3. Swipe left on card -> Quick actions revealed
4. Open filters -> Bottom sheet slides up

---

## Acceptance Test Summary

| Story | Test Count | Critical Path |
|-------|------------|---------------|
| US-01 | 4 | Yes |
| US-02 | 4 | Yes |
| US-03 | 4 | Yes |
| US-04 | 4 | Yes |
| US-05 | 4 | No |
| US-06 | 4 | Yes |
| US-07 | 3 | Yes |
| US-08 | 4 | Yes |
| US-09 | 4 | No |
| US-10 | 4 | No |
| US-11 | 4 | No |
| US-12 | 4 | No |

**Total Tests:** 47
**Critical Path Tests:** 27

---

## Definition of Done

- [ ] All acceptance criteria met for each story
- [ ] Unit tests pass with 80%+ coverage
- [ ] Integration tests pass
- [ ] Responsive design verified on mobile/tablet/desktop
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Performance: LCP < 2s, FID < 100ms
- [ ] Code review completed
- [ ] No critical or high security vulnerabilities
