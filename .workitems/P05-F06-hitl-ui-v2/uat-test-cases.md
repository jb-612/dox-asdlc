# P05-F06 HITL UI v2 - UAT Test Cases

## Overview

This document contains User Acceptance Test cases for the HITL UI v2 feature. These test cases are designed for browser DOM automation tools (e.g., Google Antigravity, Playwright, Cypress).

**Base URL:** `http://localhost:5173` (development) or `https://hitl.staging.example.com` (staging)

---

## Test Environment Setup

### Prerequisites
- Application running and accessible
- Mock data enabled (`VITE_USE_MOCKS=true`) or backend API available
- Browser with JavaScript enabled
- Screen resolution: minimum 1280x720

### Test Data
The application uses mock data by default. No additional test data setup required.

---

## TC-001: Navigation - Sidebar Menu

**Objective:** Verify all navigation links work correctly

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to base URL | - | Dashboard loads |
| 2 | Click "Gates" in sidebar | `[data-testid="nav-gates"]` or `a[href="/"]` | Gates page displays with pending gates list |
| 3 | Click "Agent Cockpit" in sidebar | `[data-testid="nav-cockpit"]` or `a[href="/cockpit"]` | Cockpit page displays with KPI header |
| 4 | Click "Discovery Studio" in sidebar | `[data-testid="nav-studio"]` or `a[href="/studio"]` | Studio page displays with chat interface |
| 5 | Click "Artifacts" in sidebar | `[data-testid="nav-artifacts"]` or `a[href="/artifacts"]` | Artifacts page displays with explorer table |
| 6 | Click "Documentation" in sidebar | `[data-testid="nav-docs"]` or `a[href="/docs"]` | Docs page displays with blueprint map |

### Pass Criteria
- All pages load without errors
- No console errors
- Page content matches expected components

---

## TC-002: Gates Page - View Pending Gates

**Objective:** Verify gates list displays and filtering works

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/` | - | Gates page loads |
| 2 | Verify gates list visible | `[data-testid="gates-list"]` or `.gates-table` | Table with gate rows displayed |
| 3 | Click status filter dropdown | `[data-testid="filter-status"]` or `select[name="status"]` | Dropdown opens with options |
| 4 | Select "Pending" filter | `option[value="pending"]` | List filters to pending gates only |
| 5 | Click on first gate row | `[data-testid="gate-row"]:first-child` or `tbody tr:first-child` | Gate detail page opens |

### Pass Criteria
- Gates list displays with columns: ID, Type, Epic, Status, Created
- Filter changes list content
- Clicking row navigates to detail

---

## TC-003: Gate Detail - Approve Gate

**Objective:** Verify gate approval workflow with feedback

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to a pending gate | `/gates/:id` | Gate detail page loads |
| 2 | Verify evidence section | `[data-testid="evidence-bundle"]` | Evidence tabs visible (Diffs, Tests, Reports) |
| 3 | Click "Diffs" tab | `[data-testid="tab-diffs"]` or `button:contains("Diffs")` | Diff content displays |
| 4 | Scroll to decision panel | `[data-testid="decision-panel"]` | Decision buttons visible |
| 5 | Select feedback tag | `[data-testid="feedback-tag-quality"]` or `input[value="quality"]` | Tag selected (highlighted) |
| 6 | Enter feedback comment | `[data-testid="feedback-comment"]` or `textarea[name="comment"]` | Text entered |
| 7 | Click "Approve" button | `[data-testid="btn-approve"]` or `button:contains("Approve")` | Confirmation modal appears |
| 8 | Confirm approval | `[data-testid="btn-confirm"]` or `.modal button:contains("Confirm")` | Success toast, redirect to gates list |

### Pass Criteria
- Evidence displays correctly
- Feedback form captures input
- Approval succeeds with toast notification
- Gate status changes to "approved"

---

## TC-004: Gate Detail - Reject Gate

**Objective:** Verify gate rejection workflow with required feedback

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to a pending gate | `/gates/:id` | Gate detail page loads |
| 2 | Click "Reject" button without feedback | `[data-testid="btn-reject"]` | Validation error shown |
| 3 | Select severity "Major" | `[data-testid="severity-major"]` or `input[value="major"]` | Severity selected |
| 4 | Enter rejection reason | `[data-testid="feedback-comment"]` | Text entered |
| 5 | Click "Reject" button | `[data-testid="btn-reject"]` | Confirmation modal appears |
| 6 | Confirm rejection | `[data-testid="btn-confirm"]` | Success toast, redirect to gates list |

### Pass Criteria
- Rejection requires feedback (validation)
- Severity selection works
- Rejection succeeds
- Gate status changes to "rejected"

---

## TC-005: Agent Cockpit - KPI Dashboard

**Objective:** Verify KPI metrics display and interaction

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/cockpit` | - | Cockpit page loads |
| 2 | Verify KPI header | `[data-testid="kpi-header"]` | 5 KPI cards displayed |
| 3 | Check "Active Runs" KPI | `[data-testid="kpi-active-runs"]` | Number displayed with color coding |
| 4 | Check "Success Rate" KPI | `[data-testid="kpi-success-rate"]` | Percentage displayed |
| 5 | Check "Pending Gates" KPI | `[data-testid="kpi-pending-gates"]` | Count displayed |
| 6 | Click on "Pending Gates" KPI | `[data-testid="kpi-pending-gates"]` | Runs table filters to pending |
| 7 | Verify worker panel | `[data-testid="worker-panel"]` | Worker list with status indicators |

### Pass Criteria
- All 5 KPIs display values
- Color coding matches thresholds (green/yellow/red)
- KPI click filters runs table
- Worker utilization shows percentage

---

## TC-006: Agent Cockpit - Runs Table

**Objective:** Verify runs table filtering and sorting

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/cockpit` | - | Cockpit page loads |
| 2 | Locate runs table | `[data-testid="runs-table"]` | Table visible with columns |
| 3 | Click "Status" column header | `th:contains("Status")` or `[data-testid="col-status"]` | Table sorts by status |
| 4 | Click again | Same | Sort direction reverses |
| 5 | Enter search term | `[data-testid="search-runs"]` or `input[placeholder*="Search"]` | Table filters by search |
| 6 | Select cluster filter | `[data-testid="filter-cluster"]` | Filter dropdown opens |
| 7 | Select "Discovery" | `option[value="discovery"]` | Table shows Discovery runs only |
| 8 | Click on a run row | `tbody tr:first-child` | Run detail page opens |

### Pass Criteria
- Sorting works on all columns
- Search filters by run ID and epic
- Cluster filter works
- Row click navigates to detail

---

## TC-007: Run Detail - Timeline and Tabs

**Objective:** Verify run detail page tabs and RLM viewer

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/cockpit/runs/:id` | - | Run detail page loads |
| 2 | Verify timeline tab active | `[data-testid="tab-timeline"]` | Timeline events displayed |
| 3 | Expand a timeline event | `[data-testid="timeline-event"]:first-child` | Event details expand |
| 4 | Click "Inputs" tab | `[data-testid="tab-inputs"]` | Input artifacts displayed |
| 5 | Click "Outputs" tab | `[data-testid="tab-outputs"]` | Output artifacts displayed |
| 6 | Click "Evidence" tab | `[data-testid="tab-evidence"]` | Evidence bundle viewer shown |
| 7 | If RLM run, verify trajectory | `[data-testid="rlm-trajectory"]` | Hierarchical tree displayed |
| 8 | Expand trajectory node | `[data-testid="trajectory-node"]:first-child` | Child nodes revealed |

### Pass Criteria
- All 4 tabs work
- Timeline shows chronological events
- RLM trajectory displays for RLM runs
- Expand/collapse works

---

## TC-008: Discovery Studio - Chat Workflow

**Objective:** Verify chat-based PRD creation workflow

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/studio` | - | Studio page loads with 3 columns |
| 2 | Verify chat interface | `[data-testid="chat-interface"]` | Chat panel on left |
| 3 | Verify outline panel | `[data-testid="outline-panel"]` | Working outline in center |
| 4 | Verify output panel | `[data-testid="output-panel"]` | Artifact cards on right |
| 5 | Type message in chat | `[data-testid="chat-input"]` or `textarea[placeholder*="message"]` | Text entered |
| 6 | Click send button | `[data-testid="btn-send"]` or `button[aria-label="Send"]` | Message appears in history |
| 7 | Wait for response | `[data-testid="chat-message"]:last-child` | AI response appears (or mock) |
| 8 | Verify outline updates | `[data-testid="outline-section"]` | Section status changes |
| 9 | Click "Preview PRD" | `[data-testid="btn-preview-prd"]` | PRD preview modal opens |

### Pass Criteria
- 3-column layout displays
- Chat messages send and display
- Typing indicator shows during response
- Outline percentage updates
- Preview shows formatted PRD

---

## TC-009: Discovery Studio - Model Selection

**Objective:** Verify model and RLM mode selection

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/studio` | - | Studio page loads |
| 2 | Locate model selector | `[data-testid="model-selector"]` | Dropdown visible |
| 3 | Click model dropdown | `[data-testid="model-selector"]` | Options appear |
| 4 | Select different model | `option[value="claude-3-opus"]` | Model changes, cost estimate updates |
| 5 | Toggle RLM mode | `[data-testid="rlm-toggle"]` or `input[name="rlm-mode"]` | Warning modal appears |
| 6 | Confirm RLM enable | `[data-testid="btn-confirm-rlm"]` | RLM mode enabled, indicator shows |

### Pass Criteria
- Model selection changes cost estimate
- RLM toggle shows warning
- RLM indicator visible when enabled

---

## TC-010: Artifacts - Explorer Table

**Objective:** Verify artifact browsing and filtering

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/artifacts` | - | Artifacts page loads |
| 2 | Verify explorer tab active | `[data-testid="tab-explorer"]` | Table displayed |
| 3 | Search by filename | `[data-testid="search-artifacts"]` | Table filters |
| 4 | Filter by type "PRD" | `[data-testid="filter-type"]` → `option[value="prd"]` | Only PRDs shown |
| 5 | Filter by status "Approved" | `[data-testid="filter-status"]` → `option[value="approved"]` | Only approved shown |
| 6 | Click "Spec Index" tab | `[data-testid="tab-spec-index"]` | Tree view displayed |
| 7 | Expand "Discovery" folder | `[data-testid="folder-discovery"]` | Artifacts under Discovery shown |
| 8 | Click on an artifact | `[data-testid="artifact-item"]:first-child` | Artifact detail page opens |

### Pass Criteria
- Table displays all columns
- Filters combine correctly
- Spec index tree displays
- Navigation to detail works

---

## TC-011: Artifact Detail - Content and History

**Objective:** Verify artifact content viewing and version history

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/artifacts/:id` | - | Artifact detail loads |
| 2 | Verify content tab | `[data-testid="tab-content"]` | Markdown content rendered |
| 3 | Verify table of contents | `[data-testid="toc"]` | TOC sidebar visible |
| 4 | Click TOC item | `[data-testid="toc-item"]:nth-child(2)` | Page scrolls to section |
| 5 | Click copy button | `[data-testid="btn-copy"]` | Content copied, toast shown |
| 6 | Click "History" tab | `[data-testid="tab-history"]` | Version timeline displayed |
| 7 | Click on older version | `[data-testid="version-item"]:nth-child(2)` | Version content loads |
| 8 | Click "Compare" checkbox on 2 versions | `[data-testid="version-compare"]` (×2) | Diff view displayed |

### Pass Criteria
- Markdown renders with syntax highlighting
- TOC navigation works
- Copy shows confirmation
- Version comparison shows diff

---

## TC-012: Artifact Detail - Provenance

**Objective:** Verify artifact provenance tracking

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/artifacts/:id` | - | Artifact detail loads |
| 2 | Click "Provenance" tab | `[data-testid="tab-provenance"]` | Provenance info displayed |
| 3 | Verify producing run | `[data-testid="producing-run"]` | Run ID with link |
| 4 | Verify approving gate | `[data-testid="approving-gate"]` | Gate ID with link |
| 5 | Click run link | `[data-testid="producing-run"] a` | Navigates to run detail |
| 6 | Go back, click gate link | `[data-testid="approving-gate"] a` | Navigates to gate detail |

### Pass Criteria
- Provenance shows complete chain
- Links navigate correctly
- Input artifacts listed

---

## TC-013: Documentation Page - Blueprint Navigation

**Objective:** Verify documentation page components

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/docs` | - | Docs page loads |
| 2 | Verify blueprint map | `[data-testid="blueprint-map"]` | Cluster diagram displayed |
| 3 | Click on "Discovery" cluster | `[data-testid="cluster-discovery"]` | Cluster expands with details |
| 4 | Click methodology stepper | `[data-testid="methodology-stepper"]` | Stepper visible |
| 5 | Click "Next" on stepper | `[data-testid="btn-next"]` | Next stage displayed |
| 6 | Navigate through all 8 stages | `[data-testid="btn-next"]` (×7) | All stages viewable |
| 7 | Open glossary | `[data-testid="glossary"]` | Glossary terms displayed |
| 8 | Search glossary | `[data-testid="glossary-search"]` | Terms filter |
| 9 | Click "Show in system" link | `[data-testid="glossary-link"]` | Navigates to relevant page |

### Pass Criteria
- Blueprint clusters are interactive
- Stepper navigates all 8 stages
- Glossary search works
- Deep links navigate correctly

---

## TC-014: Real-Time Events - WebSocket

**Objective:** Verify real-time event streaming

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to any page | - | Page loads |
| 2 | Open right panel (if collapsed) | `[data-testid="toggle-right-panel"]` | Event feed visible |
| 3 | Verify connection status | `[data-testid="ws-status"]` | "Connected" indicator |
| 4 | Wait for events | `[data-testid="event-feed"]` | Events appear in feed |
| 5 | Click event filter | `[data-testid="event-filter"]` | Filter dropdown opens |
| 6 | Select event type | `option[value="GATE_CREATED"]` | Feed filters to type |
| 7 | Pause auto-scroll | `[data-testid="btn-pause-scroll"]` | Feed stops scrolling |
| 8 | Click event for details | `[data-testid="event-item"]:first-child` | Event details expand |

### Pass Criteria
- Connection indicator shows status
- Events stream in real-time
- Filtering works
- Pause/resume works

---

## TC-015: Feature Flags - Admin Panel

**Objective:** Verify feature flag controls

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/admin` or open settings | `[data-testid="admin-link"]` | Admin page or modal opens |
| 2 | Locate feature flags panel | `[data-testid="feature-flags-panel"]` | Flags list displayed |
| 3 | Toggle "Discovery Studio" off | `[data-testid="flag-studio"]` | Flag disabled |
| 4 | Navigate to `/studio` | - | Redirect or 404/disabled message |
| 5 | Toggle "Discovery Studio" on | `[data-testid="flag-studio"]` | Flag enabled |
| 6 | Navigate to `/studio` | - | Studio page loads normally |

### Pass Criteria
- Feature flags toggle pages on/off
- Disabled features show appropriate message
- Flags persist (localStorage)

---

## TC-016: Error Handling - Network Errors

**Objective:** Verify graceful error handling

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Simulate network offline | DevTools → Network → Offline | - |
| 2 | Navigate to `/cockpit` | - | Error state displayed |
| 3 | Verify error message | `[data-testid="error-message"]` | User-friendly error shown |
| 4 | Verify retry button | `[data-testid="btn-retry"]` | Retry button visible |
| 5 | Go back online | DevTools → Network → Online | - |
| 6 | Click retry | `[data-testid="btn-retry"]` | Page loads successfully |

### Pass Criteria
- Error boundary catches errors
- User-friendly message displayed
- Retry functionality works

---

## TC-017: Responsive Layout - Mobile View

**Objective:** Verify responsive design

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Set viewport to 375px width | DevTools → Device toolbar | Mobile layout activates |
| 2 | Verify sidebar collapsed | `[data-testid="sidebar"]` | Sidebar hidden or hamburger menu |
| 3 | Open mobile menu | `[data-testid="mobile-menu-btn"]` | Navigation menu opens |
| 4 | Navigate to Gates | `[data-testid="nav-gates"]` | Gates page loads |
| 5 | Verify table scrollable | `[data-testid="gates-list"]` | Horizontal scroll enabled |
| 6 | Navigate to Studio | `[data-testid="nav-studio"]` | Studio loads |
| 7 | Verify stacked columns | `[data-testid="studio-layout"]` | Columns stack vertically |

### Pass Criteria
- Navigation accessible on mobile
- Tables have horizontal scroll
- Multi-column layouts stack
- Touch interactions work

---

## TC-018: Keyboard Navigation

**Objective:** Verify keyboard accessibility

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/` | - | Page loads |
| 2 | Press Tab | - | Focus moves to first interactive element |
| 3 | Continue Tab through page | - | All interactive elements receive focus |
| 4 | Press Enter on gate row | - | Gate detail opens |
| 5 | Press Escape on modal | - | Modal closes |
| 6 | Use arrow keys in dropdown | - | Options navigate |
| 7 | Verify focus indicators | - | Visible focus rings |

### Pass Criteria
- All interactive elements focusable
- Tab order is logical
- Keyboard shortcuts work
- Focus indicators visible

---

## TC-019: Status Bar - System Health

**Objective:** Verify status bar information

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to any page | - | Status bar visible at bottom |
| 2 | Verify git info | `[data-testid="status-git"]` | Branch and SHA displayed |
| 3 | Verify worker count | `[data-testid="status-workers"]` | "X workers active" |
| 4 | Verify pending gates | `[data-testid="status-gates"]` | "X pending gates" |
| 5 | Click pending gates | `[data-testid="status-gates"]` | Navigate to gates page |
| 6 | Verify health indicator | `[data-testid="status-health"]` | Green/yellow/red indicator |

### Pass Criteria
- All status items display
- Git info is accurate
- Click actions work
- Health reflects system state

---

## TC-020: End-to-End - Complete Discovery Workflow

**Objective:** Verify full discovery workflow from chat to artifact approval

### Steps
| Step | Action | Selector | Expected Result |
|------|--------|----------|-----------------|
| 1 | Navigate to `/studio` | - | Studio loads |
| 2 | Start new PRD chat | `[data-testid="btn-new-chat"]` | Fresh chat session |
| 3 | Enter project description | `[data-testid="chat-input"]` | Message sent |
| 4 | Wait for AI responses | - | Multiple exchanges occur |
| 5 | Verify outline fills in | `[data-testid="outline-progress"]` | Progress increases |
| 6 | Click "Preview PRD" | `[data-testid="btn-preview-prd"]` | PRD preview shows |
| 7 | Click "Submit for Review" | `[data-testid="btn-submit"]` | Submission confirmation |
| 8 | Navigate to Gates | `/` | New gate appears |
| 9 | Open the PRD gate | `[data-testid="gate-row"]` | Gate detail loads |
| 10 | Review evidence | `[data-testid="evidence-bundle"]` | PRD content visible |
| 11 | Approve with feedback | See TC-003 | Gate approved |
| 12 | Navigate to Artifacts | `/artifacts` | PRD artifact listed |
| 13 | Open artifact | `[data-testid="artifact-item"]` | Artifact detail shows |
| 14 | Verify provenance | `[data-testid="tab-provenance"]` | Shows studio run and gate |

### Pass Criteria
- Complete workflow executes
- Artifact created and approved
- Provenance chain complete
- No errors throughout

---

## Test Execution Notes

### For Google Antigravity / DOM Automation

1. **Wait Strategies:** Use `waitForSelector` or `waitForNetworkIdle` before assertions
2. **Dynamic Content:** Allow time for WebSocket events and API responses
3. **Mock Mode:** Tests assume `VITE_USE_MOCKS=true` for consistent data
4. **Timeouts:** Set 30s timeout for page loads, 10s for element waits
5. **Screenshots:** Capture on failure for debugging

### Selector Priority
1. `data-testid` attributes (preferred)
2. ARIA labels (`[aria-label="..."]`)
3. Role selectors (`[role="button"]`)
4. Semantic HTML (`button`, `a`, `input`)
5. Class selectors (last resort)

### Test Data Reset
- Clear localStorage between test runs
- Mock data resets automatically on page reload

---

## Summary

| Test Case | Priority | Estimated Duration |
|-----------|----------|-------------------|
| TC-001 | High | 2 min |
| TC-002 | High | 2 min |
| TC-003 | Critical | 3 min |
| TC-004 | Critical | 3 min |
| TC-005 | High | 3 min |
| TC-006 | High | 3 min |
| TC-007 | Medium | 4 min |
| TC-008 | Critical | 5 min |
| TC-009 | Medium | 2 min |
| TC-010 | High | 3 min |
| TC-011 | Medium | 4 min |
| TC-012 | Medium | 3 min |
| TC-013 | Medium | 4 min |
| TC-014 | High | 3 min |
| TC-015 | Low | 2 min |
| TC-016 | High | 3 min |
| TC-017 | Medium | 4 min |
| TC-018 | High | 3 min |
| TC-019 | Low | 2 min |
| TC-020 | Critical | 10 min |

**Total: 20 test cases, ~65 minutes estimated execution time**

**Critical Path:** TC-003, TC-004, TC-008, TC-020
