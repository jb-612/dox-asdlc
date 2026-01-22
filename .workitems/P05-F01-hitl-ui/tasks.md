# P05-F01: HITL Web UI - Task Breakdown

## Progress

- Started: 2026-01-22
- Tasks Complete: 22/22
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

---

## Phase 1: Foundation (Tasks 1-5)

### Task 1: Initialize Vite + React + TypeScript Project
**Status:** [x] Complete

**Description:** Set up the base Vite project with React 18 and TypeScript strict mode.

**Subtasks:**
- [x] Update package.json with all dependencies
- [x] Create vite.config.ts with path aliases and proxy config
- [x] Create tsconfig.json with strict mode enabled
- [x] Create index.html entry point

**Artifacts:**
- `docker/hitl-ui/package.json`
- `docker/hitl-ui/vite.config.ts`
- `docker/hitl-ui/tsconfig.json`
- `docker/hitl-ui/index.html`

---

### Task 2: Configure Tailwind CSS with Dark Theme
**Status:** [x] Complete

**Description:** Set up Tailwind CSS with the custom dark theme color palette.

**Subtasks:**
- [x] Create tailwind.config.js with custom colors
- [x] Create postcss.config.js
- [x] Create src/index.css with Tailwind imports and CSS variables
- [x] Add custom component classes (card, btn-primary, etc.)

**Artifacts:**
- `docker/hitl-ui/tailwind.config.js`
- `docker/hitl-ui/postcss.config.js`
- `docker/hitl-ui/src/index.css`

---

### Task 3: Set Up Project Structure and Routing
**Status:** [x] Complete

**Description:** Create the folder structure and configure React Router.

**Subtasks:**
- [x] Create folder structure as per design
- [x] Create main.tsx entry point with QueryClient
- [x] Create App.tsx with React Router setup
- [x] Create placeholder pages for routing

**Artifacts:**
- `docker/hitl-ui/src/main.tsx`
- `docker/hitl-ui/src/App.tsx`

---

### Task 4: Create Base Layout Components
**Status:** [x] Complete

**Description:** Build the Sidebar, Header, and Layout wrapper components.

**Subtasks:**
- [x] Create Layout.tsx with sidebar + content structure
- [x] Create Sidebar.tsx with navigation links
- [x] Create Header.tsx with tenant selector and user menu
- [x] Style with Tailwind dark theme

**Artifacts:**
- `docker/hitl-ui/src/components/layout/Layout.tsx`
- `docker/hitl-ui/src/components/layout/Sidebar.tsx`
- `docker/hitl-ui/src/components/layout/Header.tsx`

---

### Task 5: Implement Common Components
**Status:** [x] Complete

**Description:** Build reusable Card, Button, Badge, Spinner, EmptyState components.

**Subtasks:**
- [x] Create Card.tsx with hover variant
- [x] Create Button.tsx with variants (primary, secondary, danger, success)
- [x] Create Badge.tsx with gate type variants
- [x] Create Spinner.tsx and LoadingOverlay
- [x] Create EmptyState.tsx with type-specific messages
- [x] Create StatsCard.tsx for dashboard metrics

**Artifacts:**
- `docker/hitl-ui/src/components/common/Card.tsx`
- `docker/hitl-ui/src/components/common/Button.tsx`
- `docker/hitl-ui/src/components/common/Badge.tsx`
- `docker/hitl-ui/src/components/common/Spinner.tsx`
- `docker/hitl-ui/src/components/common/EmptyState.tsx`
- `docker/hitl-ui/src/components/common/StatsCard.tsx`

---

## Phase 2: API Layer (Tasks 6-9)

### Task 6: Create TypeScript Types from API Contract
**Status:** [x] Complete

**Description:** Define TypeScript interfaces matching hitl_api.json contract.

**Subtasks:**
- [x] Create types for GateStatus, GateType enums
- [x] Create GateRequest, Artifact, GateDecision interfaces
- [x] Create WorkerPoolStatus, AgentStatus interfaces
- [x] Create SessionSummary interface
- [x] Add helper type mappings for UI labels

**Artifacts:**
- `docker/hitl-ui/src/api/types.ts`

---

### Task 7: Set Up Axios Client with Configuration
**Status:** [x] Complete

**Description:** Create configured Axios instance with interceptors.

**Subtasks:**
- [x] Create client.ts with base URL from env
- [x] Add request interceptor for tenant header
- [x] Add response interceptor for error logging
- [x] Export configured client

**Artifacts:**
- `docker/hitl-ui/src/api/client.ts`

---

### Task 8: Implement TanStack Query Hooks for Gates API
**Status:** [x] Complete

**Description:** Create React Query hooks for gates endpoints.

**Subtasks:**
- [x] Create usePendingGates hook with polling
- [x] Create useGateDetail hook
- [x] Create useGateDecision mutation hook
- [x] Create useArtifactContent hook
- [x] Define query keys for cache management

**Artifacts:**
- `docker/hitl-ui/src/api/gates.ts`

---

### Task 9: Add Mock Data for Development
**Status:** [x] Complete

**Description:** Create realistic mock data matching contract schemas.

**Subtasks:**
- [x] Create mock gates with various types
- [x] Create mock worker pool data
- [x] Create mock sessions data
- [x] Add mock mode toggle via environment variable

**Artifacts:**
- `docker/hitl-ui/src/api/mocks.ts`

---

## Phase 3: Gate Management Components (Tasks 10-14)

### Task 10: Build GateList Component
**Status:** [x] Complete

**Description:** Create the component that displays the list of pending gates.

**Subtasks:**
- [x] Create GateList.tsx with grid layout
- [x] Implement filtering by gate type
- [x] Add loading and empty states
- [x] Integrate with usePendingGates hook

**Artifacts:**
- `docker/hitl-ui/src/components/gates/GateList.tsx`

---

### Task 11: Create GateCard Component
**Status:** [x] Complete

**Description:** Build the card component for displaying gate summaries.

**Subtasks:**
- [x] Create GateCard.tsx with type badge
- [x] Show session ID and timestamp
- [x] Display summary preview text
- [x] Add hover state and click handler

**Artifacts:**
- `docker/hitl-ui/src/components/gates/GateCard.tsx`
- `docker/hitl-ui/src/components/gates/GateBadge.tsx`

---

### Task 12: Implement GateDetail Page
**Status:** [x] Complete

**Description:** Build the full gate detail view with all information.

**Subtasks:**
- [x] Create GateDetailPage.tsx with route param
- [x] Show gate metadata (type, status, timestamps)
- [x] Display full summary and context
- [x] Add back navigation link

**Artifacts:**
- `docker/hitl-ui/src/pages/GateDetailPage.tsx`

---

### Task 13: Build ArtifactViewer Component
**Status:** [x] Complete

**Description:** Create components for viewing different artifact types.

**Subtasks:**
- [x] Create ArtifactList.tsx for listing artifacts
- [x] Create ArtifactViewer.tsx with type detection
- [x] Create DiffViewer.tsx for diff rendering
- [x] Handle file, report, and log types

**Artifacts:**
- `docker/hitl-ui/src/components/artifacts/ArtifactList.tsx`
- `docker/hitl-ui/src/components/artifacts/ArtifactViewer.tsx`
- `docker/hitl-ui/src/components/artifacts/DiffViewer.tsx`

---

### Task 14: Create DecisionForm Component
**Status:** [x] Complete

**Description:** Build the form for submitting approve/reject decisions.

**Subtasks:**
- [x] Create DecisionForm.tsx with two actions
- [x] Add feedback textarea (optional for approve, required for reject)
- [x] Integrate with useGateDecision mutation
- [x] Show loading state during submission
- [x] Handle success (redirect) and error states

**Artifacts:**
- `docker/hitl-ui/src/components/gates/DecisionForm.tsx`

---

## Phase 4: Dashboard & Monitoring (Tasks 15-18)

### Task 15: Build Dashboard Page with Stats
**Status:** [x] Complete

**Description:** Create the main dashboard with summary statistics.

**Subtasks:**
- [x] Create Dashboard.tsx page component
- [x] Build StatsCard component for metrics
- [x] Show pending gates count
- [x] Show active sessions count
- [x] Show worker pool utilization

**Artifacts:**
- `docker/hitl-ui/src/pages/Dashboard.tsx`
- `docker/hitl-ui/src/components/common/StatsCard.tsx`

---

### Task 16: Implement WorkerPool Status Display
**Status:** [x] Complete

**Description:** Build components for worker pool monitoring.

**Subtasks:**
- [x] Create WorkersPage.tsx with pool overview
- [x] Create WorkerCard.tsx for individual workers
- [x] Show utilization chart with Recharts
- [x] Color-code worker status

**Artifacts:**
- `docker/hitl-ui/src/pages/WorkersPage.tsx`
- `docker/hitl-ui/src/components/workers/WorkerPool.tsx`
- `docker/hitl-ui/src/components/workers/WorkerCard.tsx`

---

### Task 17: Create SessionList Component
**Status:** [x] Complete

**Description:** Build components for session monitoring.

**Subtasks:**
- [x] Create SessionsPage.tsx with list
- [x] Create SessionCard.tsx with progress bar
- [x] Add status filter (active, completed, all)
- [x] Link to pending gates from session

**Artifacts:**
- `docker/hitl-ui/src/pages/SessionsPage.tsx`
- `docker/hitl-ui/src/components/sessions/SessionList.tsx`
- `docker/hitl-ui/src/components/sessions/SessionCard.tsx`

---

### Task 18: Add Polling with Loading States
**Status:** [x] Complete

**Description:** Implement proper polling UX across all pages.

**Subtasks:**
- [x] Configure stale times and refetch intervals
- [x] Ensure no layout shift during updates
- [x] Add manual refresh buttons where needed
- [x] Test polling with network tab

**Artifacts:**
- Updates to all hook files

---

## Phase 5: Polish & Integration (Tasks 19-22)

### Task 19: Complete GatesPage Implementation
**Status:** [x] Complete

**Description:** Finalize the gates listing page with all features.

**Subtasks:**
- [x] Create GatesPage.tsx integrating GateList
- [x] Add filter controls in header
- [x] Ensure URL state for filters
- [x] Test navigation flow

**Artifacts:**
- `docker/hitl-ui/src/pages/GatesPage.tsx`

---

### Task 20: Add Utility Functions and Constants
**Status:** [x] Complete

**Description:** Create helper utilities for formatting and constants.

**Subtasks:**
- [x] Create formatters.ts for dates, statuses
- [x] Create constants.ts for gate type mappings
- [x] Add relative time formatting (5 min ago)

**Artifacts:**
- `docker/hitl-ui/src/utils/formatters.ts`
- `docker/hitl-ui/src/utils/constants.ts`

---

### Task 21: Update Dockerfile for Vite Production Build
**Status:** [x] Complete

**Description:** Modify Dockerfile to build and serve the React app.

**Subtasks:**
- [x] Update Dockerfile with multi-stage build
- [x] Build stage: npm run build
- [x] Serve stage: Express for static files
- [x] Preserve /health endpoint via server.js
- [x] Test build locally

**Artifacts:**
- `docker/hitl-ui/Dockerfile`
- `docker/hitl-ui/server.js`

---

### Task 22: Add Zustand Stores and Final Integration
**Status:** [x] Complete

**Description:** Complete Zustand store setup and final integration.

**Subtasks:**
- [x] Verify tenantStore.ts functionality
- [x] Verify uiStore.ts functionality
- [x] Connect stores to components
- [x] Test full application flow
- [x] Verify /health endpoint works
- [x] Add vitest configuration
- [x] Add eslint configuration
- [x] Add .env.example

**Artifacts:**
- `docker/hitl-ui/src/stores/tenantStore.ts`
- `docker/hitl-ui/src/stores/uiStore.ts`
- `docker/hitl-ui/vitest.config.ts`
- `docker/hitl-ui/.eslintrc.cjs`
- `docker/hitl-ui/.env.example`

---

## Verification Checklist

After all tasks complete:

- [x] Dashboard loads with mock data
- [x] Gates page shows pending gates
- [x] Gate detail shows artifacts
- [x] Decision form submits correctly
- [x] Workers page shows pool status
- [x] Sessions page shows session list
- [x] /health endpoint preserved for K8s probes
- [x] Dark theme matches design spec
- [x] Responsive layout implemented
- [x] Dockerfile updated for production build

## Files Created/Modified

### Configuration Files
- `docker/hitl-ui/package.json` - Updated with all dependencies
- `docker/hitl-ui/vite.config.ts` - Vite configuration
- `docker/hitl-ui/tsconfig.json` - TypeScript configuration
- `docker/hitl-ui/tsconfig.node.json` - Node TypeScript configuration
- `docker/hitl-ui/tailwind.config.js` - Tailwind with custom theme
- `docker/hitl-ui/postcss.config.js` - PostCSS configuration
- `docker/hitl-ui/vitest.config.ts` - Vitest test configuration
- `docker/hitl-ui/.eslintrc.cjs` - ESLint configuration
- `docker/hitl-ui/.env.example` - Environment variables example
- `docker/hitl-ui/.gitignore` - Git ignore rules

### Entry Points
- `docker/hitl-ui/index.html` - HTML entry point
- `docker/hitl-ui/src/main.tsx` - React entry point
- `docker/hitl-ui/src/App.tsx` - Root component with routing
- `docker/hitl-ui/src/index.css` - Global styles

### API Layer
- `docker/hitl-ui/src/api/types.ts` - TypeScript types from contract
- `docker/hitl-ui/src/api/client.ts` - Axios client configuration
- `docker/hitl-ui/src/api/gates.ts` - Gates API hooks
- `docker/hitl-ui/src/api/workers.ts` - Workers API hooks
- `docker/hitl-ui/src/api/sessions.ts` - Sessions API hooks
- `docker/hitl-ui/src/api/mocks.ts` - Mock data
- `docker/hitl-ui/src/api/index.ts` - API exports

### Components
- `docker/hitl-ui/src/components/layout/Layout.tsx`
- `docker/hitl-ui/src/components/layout/Sidebar.tsx`
- `docker/hitl-ui/src/components/layout/Header.tsx`
- `docker/hitl-ui/src/components/common/Card.tsx`
- `docker/hitl-ui/src/components/common/Button.tsx`
- `docker/hitl-ui/src/components/common/Badge.tsx`
- `docker/hitl-ui/src/components/common/Spinner.tsx`
- `docker/hitl-ui/src/components/common/EmptyState.tsx`
- `docker/hitl-ui/src/components/common/StatsCard.tsx`
- `docker/hitl-ui/src/components/gates/GateBadge.tsx`
- `docker/hitl-ui/src/components/gates/GateCard.tsx`
- `docker/hitl-ui/src/components/gates/GateList.tsx`
- `docker/hitl-ui/src/components/gates/DecisionForm.tsx`
- `docker/hitl-ui/src/components/artifacts/ArtifactList.tsx`
- `docker/hitl-ui/src/components/artifacts/ArtifactViewer.tsx`
- `docker/hitl-ui/src/components/artifacts/DiffViewer.tsx`
- `docker/hitl-ui/src/components/workers/WorkerCard.tsx`
- `docker/hitl-ui/src/components/workers/WorkerPool.tsx`
- `docker/hitl-ui/src/components/sessions/SessionCard.tsx`
- `docker/hitl-ui/src/components/sessions/SessionList.tsx`

### Pages
- `docker/hitl-ui/src/pages/Dashboard.tsx`
- `docker/hitl-ui/src/pages/GatesPage.tsx`
- `docker/hitl-ui/src/pages/GateDetailPage.tsx`
- `docker/hitl-ui/src/pages/WorkersPage.tsx`
- `docker/hitl-ui/src/pages/SessionsPage.tsx`

### Stores
- `docker/hitl-ui/src/stores/tenantStore.ts`
- `docker/hitl-ui/src/stores/uiStore.ts`

### Utilities
- `docker/hitl-ui/src/utils/formatters.ts`
- `docker/hitl-ui/src/utils/constants.ts`

### Infrastructure
- `docker/hitl-ui/Dockerfile` - Multi-stage production build
- `docker/hitl-ui/server.js` - Express production server
- `docker/hitl-ui/public/favicon.svg` - Favicon
