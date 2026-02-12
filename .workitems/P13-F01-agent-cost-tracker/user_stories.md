# P13-F01: Agent Cost Tracker - User Stories

**Version:** 1.0
**Date:** 2026-02-10
**Epic:** Observability & Analytics - Agent Cost Tracking

## Epic Summary

As a project operator, I want to understand how much each agent session costs in API token usage, so that I can optimize agent configurations, identify expensive operations, and forecast ongoing costs.

## User Stories

### US-01: View total cost summary

**As a** project operator
**I want to** see a summary of total costs across all agents and sessions
**So that** I understand my overall API spend at a glance

**Acceptance Criteria:**
- [ ] Dashboard page at `/costs` displays summary cards
- [ ] Total cumulative cost in USD is visible
- [ ] Cost rate (USD per hour based on recent activity) is displayed
- [ ] The highest-spending agent is identified with its cost
- [ ] Total input and output token counts are shown
- [ ] Summary updates when time range filter changes

**Acceptance Tests:**
- Given the cost dashboard page loads, when cost data is available, then the total spend card shows a formatted USD amount
- Given no cost records exist, when the page loads, then summary cards show $0.00 values
- Given the time range is set to "24h", when the summary loads, then only costs from the last 24 hours are included

### US-02: View cost breakdown by agent

**As a** project operator
**I want to** see a breakdown of costs by agent (pm, backend, frontend, orchestrator, devops)
**So that** I can identify which agents are most expensive and optimize accordingly

**Acceptance Criteria:**
- [ ] Bar chart shows cost per agent
- [ ] Each agent bar is labeled with agent name and total cost
- [ ] Chart respects the current time range filter
- [ ] Hovering or clicking a bar shows detailed token counts
- [ ] Zero-cost agents are either hidden or shown with zero-height bars

**Acceptance Tests:**
- Given cost records exist for agents "pm" and "backend", when the breakdown chart renders, then both agents appear with proportional bar heights
- Given agent "pm" has $5.00 in costs and "backend" has $2.00, when viewing the chart, then "pm" bar is visually larger
- Given time range is set to "1h" and no costs exist in that range, when the chart renders, then an empty state message is shown

### US-03: View cost breakdown by model

**As a** project operator
**I want to** see a breakdown of costs by model (Opus, Sonnet, Haiku)
**So that** I can assess whether model selection is cost-efficient

**Acceptance Criteria:**
- [ ] Pie or donut chart shows cost proportion by model
- [ ] Each segment is labeled with model name and percentage
- [ ] Absolute cost values are visible on hover or in a legend
- [ ] Chart respects the current time range filter

**Acceptance Tests:**
- Given costs split across claude-opus-4-6 ($10) and claude-sonnet-4-5 ($2), when the pie chart renders, then Opus shows approximately 83% and Sonnet shows approximately 17%
- Given all costs are from one model, when the chart renders, then a single full circle with model name is shown

### US-04: View per-session cost details

**As a** project operator
**I want to** see a sortable table of sessions with their associated costs
**So that** I can identify expensive sessions and understand cost patterns

**Acceptance Criteria:**
- [ ] Table displays: session_id, agent_id, model, total tokens, total cost, timestamp
- [ ] Table is sortable by any column (default: most recent first)
- [ ] Table supports pagination (50 rows per page)
- [ ] Clicking a session row shows expanded detail with model and tool breakdowns
- [ ] Table respects the current time range filter

**Acceptance Tests:**
- Given 100 cost records across 5 sessions, when the table loads, then sessions are grouped and totals are correct
- Given the table is sorted by cost descending, then the most expensive session appears first
- Given a session row is clicked, then the expanded view shows per-model and per-tool cost breakdowns

### US-05: Filter costs by time range

**As a** project operator
**I want to** filter cost data by time range (1 hour, 24 hours, 7 days, 30 days, all time)
**So that** I can focus on recent costs or see historical trends

**Acceptance Criteria:**
- [ ] Time range selector with options: 1h, 24h, 7d, 30d, All
- [ ] Changing time range updates all cards, charts, and table
- [ ] Selected time range is persisted in local state (Zustand store)
- [ ] Default time range is "24h"

**Acceptance Tests:**
- Given the time range is "7d", when cost data loads, then only records from the last 7 days are shown
- Given the user switches from "24h" to "1h", then all components re-fetch with the new time range
- Given the page is refreshed, then the previously selected time range is restored from the store

### US-06: Capture cost data from hook telemetry

**As a** system administrator
**I want** token usage to be automatically captured from hook telemetry events
**So that** cost data accumulates without manual intervention

**Acceptance Criteria:**
- [ ] PostToolUse hook events trigger cost record creation
- [ ] Token counts (input_tokens, output_tokens) are extracted from hook payload
- [ ] Model name is extracted from hook payload or session metadata
- [ ] Estimated USD cost is calculated using the pricing table
- [ ] Cost records are written to the cost_records table in telemetry.db
- [ ] Cost capture never blocks or fails the hook pipeline (fail-silent)

**Acceptance Tests:**
- Given a PostToolUse hook fires with payload containing usage.input_tokens=1000 and usage.output_tokens=500, when the cost collector runs, then a cost_record is created with those token counts
- Given a hook payload does not contain token counts, when the cost collector runs, then no cost_record is created (graceful skip)
- Given SQLite write fails, when the cost collector runs, then the hook pipeline continues without error

### US-07: View current model pricing

**As a** project operator
**I want to** see the current model pricing table
**So that** I understand how costs are calculated

**Acceptance Criteria:**
- [ ] A pricing section or tooltip shows per-model input/output rates
- [ ] Pricing is displayed as USD per 1M tokens
- [ ] Pricing is fetched from the backend API (not hardcoded in frontend)

**Acceptance Tests:**
- Given the pricing endpoint returns 3 models, when the pricing section renders, then all 3 models with their rates are shown
- Given the pricing endpoint is unavailable, when the page loads, then the pricing section shows a fallback message

### US-08: Navigate to cost dashboard from main navigation

**As a** HITL UI user
**I want** a navigation link to the cost dashboard
**So that** I can easily find the cost tracking feature

**Acceptance Criteria:**
- [ ] A "Costs" link appears in the sidebar/navigation of the HITL UI
- [ ] Clicking the link navigates to `/costs`
- [ ] The page loads with lazy loading (code splitting)
- [ ] The active navigation item is highlighted when on `/costs`

**Acceptance Tests:**
- Given the user is on any page, when they click "Costs" in the navigation, then they are routed to `/costs`
- Given the user is on `/costs`, then the "Costs" navigation item is highlighted as active

## Story Dependencies

```
US-06 (Backend: cost capture)
    |
    v
US-07 (Backend: pricing API) ---+
    |                            |
    v                            v
US-01 (Summary cards) ------> US-05 (Time range filter)
US-02 (Agent breakdown)          |
US-03 (Model breakdown)          |
US-04 (Session table) -----------+
    |
    v
US-08 (Navigation integration)
```

US-06 must be completed first as it populates the data. US-07 can be done in parallel with US-06. Frontend stories (US-01 through US-05) can proceed using mock data before the backend is complete. US-08 is the final integration step.
