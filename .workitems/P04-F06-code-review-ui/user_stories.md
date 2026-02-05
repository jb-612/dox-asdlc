# P04-F06: Code Review Page UI - User Stories

## Epic Summary

As a developer using the aSDLC platform, I want a web-based interface to trigger parallel code reviews and interact with findings so that I can efficiently identify and address code quality issues across security, performance, and style dimensions.

---

## US-01: Configure Review Target

**As a** developer
**I want** to specify what code to review (repository, PR, branch, or custom path)
**So that** I can focus the review on relevant code

### Acceptance Criteria

1. **AC-01.1**: A text input accepts repository URL, PR number, or branch name
2. **AC-01.2**: Input validates format and shows error message for invalid targets
3. **AC-01.3**: Scope selector offers "Full Repo", "Changed Files Only", "Custom Path" options
4. **AC-01.4**: When "Custom Path" is selected, a secondary input appears for path entry
5. **AC-01.5**: Custom path input validates path format (no leading/trailing slashes, valid characters)

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T01.1 | Enter valid repo URL | Input accepted, no error |
| T01.2 | Enter invalid URL format | Error message displayed |
| T01.3 | Select "Custom Path" scope | Custom path input becomes visible |
| T01.4 | Select "Full Repo" scope | Custom path input hidden |
| T01.5 | Enter path with invalid characters | Validation error shown |

---

## US-02: Select Reviewers

**As a** developer
**I want** to enable or disable specific reviewers (Security, Performance, Style)
**So that** I can customize the review to my needs

### Acceptance Criteria

1. **AC-02.1**: Three toggle switches for Security, Performance, and Style reviewers
2. **AC-02.2**: Each toggle shows reviewer name and brief description
3. **AC-02.3**: All toggles enabled by default
4. **AC-02.4**: At least one reviewer must be enabled to start review
5. **AC-02.5**: Attempting to disable all reviewers shows warning message

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T02.1 | Page loads | All three toggles enabled |
| T02.2 | Disable Security reviewer | Security toggle off, other two remain on |
| T02.3 | Disable all reviewers | Warning shown, Start button disabled |
| T02.4 | Re-enable one reviewer | Warning dismissed, Start button enabled |

---

## US-03: Start Parallel Review

**As a** developer
**I want** to trigger a parallel review swarm with my configuration
**So that** the review begins processing

### Acceptance Criteria

1. **AC-03.1**: "Start Review" button triggers POST /api/swarm/review
2. **AC-03.2**: Button shows loading state during API call
3. **AC-03.3**: On success, UI transitions to progress view
4. **AC-03.4**: On failure, error toast shows with retry option
5. **AC-03.5**: Swarm ID is stored for status polling

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T03.1 | Click Start with valid config | API called, loading shown, progress view displayed |
| T03.2 | API returns error | Toast with error message and retry button |
| T03.3 | Click Start with no reviewers | Button disabled, no API call |
| T03.4 | Network timeout | Error toast with retry option |

---

## US-04: View Parallel Progress

**As a** developer
**I want** to see real-time progress of each reviewer in parallel lanes
**So that** I understand how the review is progressing

### Acceptance Criteria

1. **AC-04.1**: Three-lane view shows Security, Performance, Style reviewers
2. **AC-04.2**: Each lane displays: status indicator, progress bar, files reviewed count
3. **AC-04.3**: Status indicators: pending (gray), in_progress (blue), complete (green), failed (red)
4. **AC-04.4**: Progress bars animate smoothly during updates
5. **AC-04.5**: Polling occurs every 2 seconds while swarm is running

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T04.1 | Swarm starts | All three lanes show pending status |
| T04.2 | Reviewer begins | Lane transitions to in_progress with progress bar |
| T04.3 | Reviewer completes | Lane shows complete status with green indicator |
| T04.4 | Reviewer fails | Lane shows failed status with red indicator |
| T04.5 | All reviewers complete | UI transitions to results view |

---

## US-05: View CLI-Style Output

**As a** developer
**I want** to see terminal-like output showing agent activity
**So that** I can follow the detailed review process

### Acceptance Criteria

1. **AC-05.1**: CLI mimic view shows scrollable terminal-style output
2. **AC-05.2**: Entries are color-coded by reviewer (Security=purple, Performance=teal, Style=blue)
3. **AC-05.3**: Timestamps shown for each entry
4. **AC-05.4**: Auto-scrolls to latest entry unless user has scrolled up
5. **AC-05.5**: Maximum 500 entries displayed (older entries removed)

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T05.1 | New entry arrives | Entry appended, view auto-scrolls |
| T05.2 | User scrolls up | Auto-scroll pauses |
| T05.3 | User scrolls to bottom | Auto-scroll resumes |
| T05.4 | 600 entries accumulated | Only latest 500 shown |

---

## US-06: View Token and Cost Metrics

**As a** developer
**I want** to see real-time token usage and cost estimates
**So that** I can monitor review resource consumption

### Acceptance Criteria

1. **AC-06.1**: Token counter shows total tokens used across all reviewers
2. **AC-06.2**: Cost estimate displayed in USD with 4 decimal places
3. **AC-06.3**: Metrics update with each status poll
4. **AC-06.4**: Running indicator (spinner) shown while review in progress
5. **AC-06.5**: Final metrics locked when review completes

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T06.1 | Review starts | Counter shows 0, spinner visible |
| T06.2 | Status update received | Token count and cost update |
| T06.3 | Review completes | Spinner hidden, final values locked |

---

## US-07: View Severity Summary

**As a** developer
**I want** to see a traffic light summary of findings by severity
**So that** I can quickly assess overall code health

### Acceptance Criteria

1. **AC-07.1**: Traffic light display with three sections (red, yellow, green)
2. **AC-07.2**: Red shows Critical + High count
3. **AC-07.3**: Yellow shows Medium count
4. **AC-07.4**: Green shows Low + Info count
5. **AC-07.5**: Click on section scrolls to corresponding findings

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T07.1 | 3 critical, 2 high findings | Red section shows "5" |
| T07.2 | 0 medium findings | Yellow section shows "0" |
| T07.3 | Click red section | Page scrolls to critical/high findings |

---

## US-08: View Findings List

**As a** developer
**I want** to see findings grouped by file with expandable details
**So that** I can review issues in context

### Acceptance Criteria

1. **AC-08.1**: Findings grouped by file path
2. **AC-08.2**: Each finding shows: severity badge, title, reviewer attribution
3. **AC-08.3**: Expand finding to see: code snippet, description, recommendation
4. **AC-08.4**: Code snippet shows syntax highlighting with line numbers
5. **AC-08.5**: Scroll to finding highlights the relevant code lines

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T08.1 | Load results with findings | Findings grouped by file |
| T08.2 | Click finding title | Finding expands to show details |
| T08.3 | Click expanded finding | Finding collapses |
| T08.4 | Finding has code snippet | Code displayed with highlighting |
| T08.5 | Finding without code snippet | "No code available" placeholder |

---

## US-09: Create GitHub Issue from Finding

**As a** developer
**I want** to create a GitHub issue directly from a finding
**So that** I can track the issue for resolution

### Acceptance Criteria

1. **AC-09.1**: "Create Issue" button on each finding card
2. **AC-09.2**: Click opens GitHub Issue Modal
3. **AC-09.3**: Modal shows repository picker, label selector, issue preview
4. **AC-09.4**: Issue title and body populated from finding template
5. **AC-09.5**: Submit creates issue and shows success message with link

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T09.1 | Click Create Issue | Modal opens with pre-filled content |
| T09.2 | Select different repository | Issue preview updates |
| T09.3 | Submit issue | Issue created, success toast with link |
| T09.4 | API error | Error message in modal with retry |

---

## US-10: Copy Finding to Clipboard

**As a** developer
**I want** to copy a finding as Markdown to my clipboard
**So that** I can paste it into other tools

### Acceptance Criteria

1. **AC-10.1**: "Copy" button on each finding card
2. **AC-10.2**: Click copies finding as formatted Markdown
3. **AC-10.3**: Toast notification confirms copy success
4. **AC-10.4**: Markdown includes: title, severity, file, code, recommendation

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T10.1 | Click Copy | Finding copied to clipboard |
| T10.2 | Paste in editor | Formatted Markdown appears |
| T10.3 | Clipboard API fails | Error toast shown |

---

## US-11: Ignore Finding

**As a** developer
**I want** to mark a finding as ignored/not actionable
**So that** I can focus on relevant issues

### Acceptance Criteria

1. **AC-11.1**: "Ignore" button on each finding card
2. **AC-11.2**: Ignored findings visually dimmed
3. **AC-11.3**: Toggle to show/hide ignored findings
4. **AC-11.4**: Ignored findings excluded from severity counts
5. **AC-11.5**: Undo ignore restores finding to normal state

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T11.1 | Click Ignore | Finding dimmed, removed from counts |
| T11.2 | Toggle "Show ignored" off | Ignored findings hidden |
| T11.3 | Click Undo on ignored finding | Finding restored |

---

## US-12: Bulk Create GitHub Issues

**As a** developer
**I want** to create GitHub issues for multiple findings at once
**So that** I can efficiently track all issues

### Acceptance Criteria

1. **AC-12.1**: Checkbox on each finding for selection
2. **AC-12.2**: "Select All" / "Clear Selection" buttons in bulk action bar
3. **AC-12.3**: "Create Issues" button enabled when findings selected
4. **AC-12.4**: Bulk modal shows count and preview of issues to create
5. **AC-12.5**: Progress indicator during bulk creation

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T12.1 | Select 5 findings | Bulk bar shows "5 selected" |
| T12.2 | Click Create Issues | Bulk modal opens with 5 previews |
| T12.3 | Submit bulk creation | Progress shown, success toast after |
| T12.4 | One issue fails | Summary shows partial success |

---

## US-13: Download Review Report

**As a** developer
**I want** to download the review results as Markdown or PDF
**So that** I can share or archive the report

### Acceptance Criteria

1. **AC-13.1**: "Download Report" button with format dropdown
2. **AC-13.2**: Markdown format includes all findings with formatting
3. **AC-13.3**: PDF format includes styled document with code blocks
4. **AC-13.4**: Report includes: summary, metrics, all findings
5. **AC-13.5**: Filename follows pattern: `review-{swarm_id}-{date}.{ext}`

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T13.1 | Click Download > Markdown | .md file downloaded |
| T13.2 | Click Download > PDF | .pdf file downloaded |
| T13.3 | Check Markdown content | All findings included |

---

## US-14: Navigate to Code Review Page

**As a** user of the HITL UI
**I want** to access the Code Review page from the sidebar
**So that** I can find the feature easily

### Acceptance Criteria

1. **AC-14.1**: "Code Review" link in sidebar navigation
2. **AC-14.2**: Icon visually represents code review
3. **AC-14.3**: Link navigates to /review route
4. **AC-14.4**: Current page highlighted in sidebar when on Code Review

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T14.1 | Click Code Review in sidebar | Navigates to /review |
| T14.2 | On /review page | Sidebar link highlighted |

---

## US-15: Handle Review Errors Gracefully

**As a** developer
**I want** clear error messages when things go wrong
**So that** I can understand and recover from failures

### Acceptance Criteria

1. **AC-15.1**: API errors show toast with message and retry option
2. **AC-15.2**: Partial failures (some reviewers fail) show partial results
3. **AC-15.3**: Timeout shows message with option to view partial results
4. **AC-15.4**: Network disconnect shows reconnecting indicator
5. **AC-15.5**: Error details available in expandable section

### Test Scenarios

| ID | Scenario | Expected |
|----|----------|----------|
| T15.1 | API returns 500 | Toast with "Review failed" and retry |
| T15.2 | Security reviewer fails, others succeed | Results shown with failure notice |
| T15.3 | Review times out | Timeout message with partial results link |

---

## Dependencies

| Story | Depends On |
|-------|------------|
| US-03 | US-01, US-02 |
| US-04, US-05, US-06 | US-03 |
| US-07, US-08 | US-04 (completion) |
| US-09, US-10, US-11 | US-08 |
| US-12, US-13 | US-08 |
| US-14 | None (parallel) |
| US-15 | All other stories |

## Priority

1. **Must Have**: US-01 through US-08 (core review workflow)
2. **Should Have**: US-09 through US-13 (actions and export)
3. **Nice to Have**: US-14, US-15 (navigation, error handling polish)
