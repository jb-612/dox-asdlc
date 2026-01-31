# P08-F01: Ideas Repository Core - User Stories

## Epic Summary

Create the foundational Ideas Repository that enables users to capture, store, and manage short-form product ideas with a 144-word limit, supporting the Mindflare Hub feature set.

---

## User Stories

### US-01: Create a new idea

**As a** product stakeholder,
**I want** to submit a short idea (up to 144 words),
**So that** I can quickly capture product concepts before they are lost.

**Acceptance Criteria:**
- [ ] User can enter idea text up to 144 words
- [ ] Word count is displayed in real-time during entry
- [ ] Submission is blocked if word count exceeds 144
- [ ] Idea is saved with timestamp, author info, and unique ID
- [ ] Success confirmation is displayed after creation
- [ ] New idea appears in the ideas list

**Test Scenarios:**
1. Submit idea with 100 words -> Success
2. Submit idea with 144 words -> Success
3. Submit idea with 145 words -> Blocked with error message
4. Submit empty idea -> Blocked with validation error
5. Submit idea with special characters -> Success

---

### US-02: View all ideas

**As a** team member,
**I want** to see a list of all submitted ideas,
**So that** I can browse and discover product concepts.

**Acceptance Criteria:**
- [ ] Ideas are displayed in a paginated list
- [ ] Each idea shows: content preview, author, timestamp, labels
- [ ] Default sort is by newest first
- [ ] Loading state is shown while fetching
- [ ] Empty state is shown when no ideas exist
- [ ] Pagination controls allow navigation through results

**Test Scenarios:**
1. View list with 50 ideas -> First page shows 20 ideas
2. Navigate to page 2 -> Shows ideas 21-40
3. View empty repository -> Shows "No ideas yet" message
4. Slow network -> Shows loading spinner

---

### US-03: View single idea details

**As a** team member,
**I want** to see the full details of a single idea,
**So that** I can understand its complete context.

**Acceptance Criteria:**
- [ ] Click on idea opens detail view
- [ ] Full content is displayed (not truncated)
- [ ] All labels are shown
- [ ] Source information is displayed (manual, Slack, etc.)
- [ ] Created and updated timestamps are shown
- [ ] Author name and avatar are displayed
- [ ] Status badge shows current lifecycle state

**Test Scenarios:**
1. Click idea in list -> Opens detail panel
2. View idea with 144 words -> All content visible
3. View idea from Slack -> Shows Slack source badge

---

### US-04: Edit an idea

**As the** idea author,
**I want** to edit my idea's content and labels,
**So that** I can refine the concept over time.

**Acceptance Criteria:**
- [ ] Only the author can edit their ideas
- [ ] Content can be modified (144 word limit enforced)
- [ ] Labels can be added or removed
- [ ] Updated timestamp is refreshed on save
- [ ] Cancel reverts to original content
- [ ] Save shows success confirmation

**Test Scenarios:**
1. Author edits own idea -> Success
2. Non-author attempts edit -> Edit button not shown
3. Edit to 150 words -> Save blocked with error
4. Cancel during edit -> Changes discarded

---

### US-05: Delete an idea

**As the** idea author,
**I want** to delete my idea,
**So that** I can remove concepts that are no longer relevant.

**Acceptance Criteria:**
- [ ] Only the author can delete their ideas
- [ ] Confirmation dialog is shown before deletion
- [ ] Deleted ideas are archived (soft delete)
- [ ] Deleted ideas are removed from active list
- [ ] Success message is shown after deletion

**Test Scenarios:**
1. Author deletes own idea -> Idea archived
2. Non-author attempts delete -> Delete button not shown
3. Confirm deletion -> Idea removed from list
4. Cancel deletion -> Idea remains

---

### US-06: Search ideas

**As a** team member,
**I want** to search ideas by keyword,
**So that** I can find relevant concepts quickly.

**Acceptance Criteria:**
- [ ] Search input is prominently placed
- [ ] Search is performed on content text
- [ ] Results are highlighted with matching terms
- [ ] Search is case-insensitive
- [ ] Empty search returns all ideas
- [ ] No results shows helpful message

**Test Scenarios:**
1. Search "authentication" -> Returns ideas containing that word
2. Search "AUTH" -> Returns same results (case-insensitive)
3. Search "xyzabc123" -> Shows "No ideas found"
4. Clear search -> Shows all ideas

---

### US-07: Filter ideas by status

**As a** product manager,
**I want** to filter ideas by their lifecycle status,
**So that** I can focus on ideas in a specific stage.

**Acceptance Criteria:**
- [ ] Filter dropdown shows: All, Draft, Active, Baking, Archived
- [ ] Selecting a filter updates the list immediately
- [ ] Filter state is preserved during pagination
- [ ] Multiple filters can be applied together
- [ ] Clear filters button resets all filters

**Test Scenarios:**
1. Filter by "Active" -> Shows only active ideas
2. Filter by "Baking" -> Shows ideas being developed
3. Apply status + label filters -> Intersection of both
4. Clear filters -> Shows all ideas

---

### US-08: Filter ideas by labels

**As a** team member,
**I want** to filter ideas by their assigned labels,
**So that** I can find ideas related to specific areas.

**Acceptance Criteria:**
- [ ] Label filter shows all used labels
- [ ] Clicking a label filters the list
- [ ] Multiple labels can be selected (OR logic)
- [ ] Selected labels are visually highlighted
- [ ] Count of ideas per label is shown

**Test Scenarios:**
1. Filter by "performance" label -> Shows matching ideas
2. Filter by "performance" + "security" -> Shows ideas with either label
3. Filter by unused label -> Shows empty results

---

### US-09: Start baking an idea in Ideation Studio

**As a** product stakeholder,
**I want** to "bake" an idea in the Ideation Studio,
**So that** I can develop it into a full PRD.

**Acceptance Criteria:**
- [ ] "Bake in Studio" button is visible on idea cards
- [ ] Clicking opens Ideation Studio with idea as initial context
- [ ] Idea status changes to "Baking"
- [ ] Link back to original idea is preserved
- [ ] User can optionally set a project name

**Test Scenarios:**
1. Click "Bake" on active idea -> Opens Ideation Studio
2. Ideation Studio shows idea content as starting point
3. Idea status updates to "Baking"
4. Navigate back -> Idea shows "Baking" status

---

### US-10: View idea source information

**As a** team member,
**I want** to see where an idea came from,
**So that** I can understand its origin and context.

**Acceptance Criteria:**
- [ ] Source badge shows: Manual, Slack, Import
- [ ] Slack ideas show channel name
- [ ] Link to original source (if available)
- [ ] Import source shows batch ID

**Test Scenarios:**
1. View manual idea -> Shows "Manual" badge
2. View Slack idea -> Shows Slack icon and channel name
3. Click Slack source -> Opens Slack message (if URL available)

---

## Acceptance Test Summary

| Story | Test Count | Critical Path |
|-------|------------|---------------|
| US-01 | 5 | Yes |
| US-02 | 4 | Yes |
| US-03 | 3 | Yes |
| US-04 | 4 | No |
| US-05 | 4 | No |
| US-06 | 4 | Yes |
| US-07 | 4 | No |
| US-08 | 3 | No |
| US-09 | 4 | Yes |
| US-10 | 3 | No |

**Total Tests:** 38
**Critical Path Tests:** 16

---

## Definition of Done

- [ ] All acceptance criteria met for each story
- [ ] Unit tests pass with 80%+ coverage
- [ ] Integration tests pass
- [ ] API documentation updated (OpenAPI spec)
- [ ] Frontend components have test coverage
- [ ] Code review completed
- [ ] No critical or high security vulnerabilities
