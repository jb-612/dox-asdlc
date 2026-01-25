# P05-F09: Kubernetes Visibility Dashboard - Task Breakdown

## Progress

- Started: 2026-01-25
- Tasks Complete: 18/36
- Percentage: 50%
- Status: IN_PROGRESS
- Blockers: None
- Last Updated: 2026-01-25 (TASK-009b, TASK-009c, TASK-010a, TASK-010b, TASK-010c, TASK-014 completed; TypeScript errors fixed in NetworkingPanel)

---

## Phase 1: Foundation & API (6 tasks)

### TASK-001: Create K8s TypeScript interfaces
- [ ] Create `src/api/types/kubernetes.ts` with all K8s interfaces
- [ ] Define ClusterHealth, K8sNode, K8sPod, K8sService, K8sIngress interfaces
- [ ] Define MetricsDataPoint, MetricsTimeSeries interfaces
- [ ] Define CommandRequest, CommandResponse interfaces
- [ ] Define HealthCheckType, HealthCheckResult types
- [ ] Define K8sEvent, K8sEventObject interfaces
- [ ] Export all types from main types barrel
- **Estimate:** 45min
- **Tests:** TypeScript compilation succeeds
- **Depends on:** None

### TASK-002: Create K8s API client module
- [ ] Create `src/api/kubernetes.ts` with API functions
- [ ] Implement getClusterHealth() function
- [ ] Implement getNodes(), getNode(name) functions
- [ ] Implement getPods(namespace?), getPod(namespace, name) functions
- [ ] Implement getPodLogs(namespace, name, container?) function
- [ ] Implement getServices(), getIngresses() functions
- [ ] Implement getMetricsHistory(interval) function
- [ ] Implement executeCommand(request) function
- [ ] Implement runHealthCheck(type) function
- [ ] Add TanStack Query hooks for all endpoints
- [ ] Write unit tests for all API functions
- **Estimate:** 1.5h
- **Tests:** All API functions tested with mocked axios
- **Depends on:** TASK-001

### TASK-003: Create K8s mock data layer
- [ ] Create `src/api/mocks/kubernetes.ts`
- [ ] Create mock ClusterHealth data
- [ ] Create mock nodes (3 nodes: 2 Ready, 1 NotReady)
- [ ] Create mock pods (20 pods across 3 namespaces, various statuses)
- [ ] Create mock services and ingresses
- [ ] Create mock metrics time series (24h of data points)
- [ ] Create mock command responses
- [ ] Create mock health check results
- [ ] Export `useMocks()` integration
- [ ] Add mock to `api/mocks/index.ts` exports
- **Estimate:** 1.5h
- **Tests:** Mock data matches interface contracts
- **Depends on:** TASK-001

### TASK-004: Create k8sStore Zustand store
- [ ] Create `src/stores/k8sStore.ts`
- [ ] Implement selectedNamespace state
- [ ] Implement selectedPod, selectedNode state
- [ ] Implement terminalHistory, terminalOutput state
- [ ] Implement drawerOpen state
- [ ] Implement metricsInterval state
- [ ] Implement all setter actions
- [ ] Implement addTerminalCommand, clearTerminal actions
- [ ] Write unit tests for all store actions
- **Estimate:** 45min
- **Tests:** Store actions update state correctly
- **Depends on:** TASK-001

### TASK-005: Add K8s WebSocket event types
- [ ] Extend `src/api/websocket.ts` EventTypes with K8s events
- [ ] Add K8S_POD_ADDED, K8S_POD_MODIFIED, K8S_POD_DELETED
- [ ] Add K8S_NODE_STATUS_CHANGED
- [ ] Add K8S_EVENT event type
- [ ] Create subscribeToK8sEvents() wrapper function
- [ ] Write unit tests for K8s event subscriptions
- **Estimate:** 30min
- **Tests:** Event subscriptions work with mock WebSocket
- **Depends on:** None

### TASK-006: Add K8s route and navigation
- [ ] Add /k8s route to App.tsx with lazy loading
- [ ] Create K8sPage.tsx placeholder component
- [ ] Add navigation item under 'Workflow' section, after 'Agent Cockpit' entry
- [ ] Use ServerIcon from Heroicons
- [ ] Add k8s to feature flags if feature flags enabled
- [ ] Write navigation test
- **Estimate:** 30min
- **Tests:** Route loads, navigation works
- **Depends on:** None

---

## Phase 2: Core Components (8 tasks)

### TASK-007: Implement ClusterOverview component
- [ ] Create `src/components/k8s/ClusterOverview.tsx`
- [ ] Display cluster health status indicator (green/yellow/red)
- [ ] Display 4 KPI cards: Nodes Ready, Pods Running, CPU%, Memory%
- [ ] Use existing KPI card pattern from KPIHeader
- [ ] Add color coding based on thresholds
- [ ] Add refresh button
- [ ] Add click handlers for drill-down
- [ ] Handle loading and error states
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Renders correctly, status colors match thresholds
- **Depends on:** TASK-002

### TASK-008: Implement NodesPanel component
- [ ] Create `src/components/k8s/NodesPanel.tsx`
- [ ] Display node cards in grid layout
- [ ] Show node name, status, roles, version
- [ ] Show capacity and utilization progress bars
- [ ] Color-code by status (Ready=green, NotReady=red)
- [ ] Add status filter buttons
- [ ] Add click handler for node selection
- [ ] Handle empty state
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Nodes display, filter works, colors correct
- **Depends on:** TASK-002

### TASK-009a: PodsTable Basic - table structure with columns and sorting
- [ ] Create `src/components/k8s/PodsTable.tsx`
- [ ] Display sortable table columns (Name, Namespace, Status, Node, Age, Restarts)
- [ ] Add color-coded status badges
- [ ] Add row click handler to open drawer
- [ ] Handle loading and empty states
- [ ] Write Vitest tests for basic table rendering and sorting
- **Estimate:** 1h
- **Tests:** Table renders, sort works, status badges display correctly
- **Depends on:** TASK-002, TASK-004

### TASK-009b: PodsTable Filters - namespace/status/node filters with search
- [x] Implement namespace filter dropdown
- [x] Implement status filter dropdown
- [x] Implement node filter dropdown
- [x] Add search by pod name with debounce (300ms)
- [x] Write Vitest tests for filtering and search
- **Estimate:** 1h
- **Completed:** 2026-01-25
- **Tests:** Filters work, search works with debounce (34 tests passing)
- **Depends on:** TASK-009a

### TASK-009c: PodsTable Performance - virtual scrolling and pagination
- [x] Add pagination (50 per page default, configurable via pageSize prop)
- [x] Add pagination controls (first, prev, page numbers, next, last)
- [x] Add enablePagination prop to disable when not needed
- [x] Write Vitest tests for pagination (14 pagination-specific tests)
- **Estimate:** 1h
- **Completed:** 2026-01-25
- **Tests:** Pagination works, 48 total tests passing
- **Depends on:** TASK-009b
- **Note:** Virtual scrolling deferred - pagination sufficient for current requirements

### TASK-010a: PodDetailDrawer Core - drawer with Info/Containers tabs
- [x] Create `src/components/k8s/PodDetailDrawer.tsx`
- [x] Display pod metadata (name, namespace, labels, annotations)
- [x] Show owner reference with link
- [x] Create tabs: Info | Containers | Events | Logs (using HeadlessUI Tab)
- [x] Implement Info tab with pod details (status, IP, node, created, restarts)
- [x] Implement Containers tab with container list (name, image, status, restarts)
- [x] Handle loading and error states
- [x] Wire to k8sStore.selectedPod and k8sStore.drawerOpen
- [x] Write Vitest tests for drawer and Info/Containers tabs
- **Estimate:** 1.5h
- **Completed:** 2026-01-25
- **Tests:** 40 tests passing for drawer and all tabs
- **Depends on:** TASK-002, TASK-004

### TASK-010b: PodDetailDrawer Events - events tab with filtering
- [x] Implement Events tab with pod events (type, reason, message, timestamp)
- [x] Add event type filtering (All, Normal, Warning)
- [x] Color-code by type (Normal=blue, Warning=yellow)
- [x] Add event timestamp display
- [x] Show event count for repeated events
- [x] Write Vitest tests for Events tab
- **Estimate:** 45min
- **Completed:** 2026-01-25
- **Tests:** Events tab tests included in 40 PodDetailDrawer tests
- **Depends on:** TASK-010a

### TASK-010c: PodDetailDrawer Logs - logs tab with auto-scroll and search
- [x] Implement Logs tab with log viewer (monospace font, dark background)
- [x] Add container selector dropdown (for multi-container pods)
- [x] Add auto-scroll with pause on scroll up (useRef + scroll detection)
- [x] Add copy logs button (navigator.clipboard API)
- [x] Add download logs button (Blob + URL.createObjectURL)
- [x] Add log search/filter input with real-time filtering
- [x] Write Vitest tests for Logs tab
- **Estimate:** 1h
- **Completed:** 2026-01-25
- **Tests:** Logs tab tests included in 40 PodDetailDrawer tests
- **Depends on:** TASK-010a

### TASK-011: Implement CommandTerminal component
- [ ] Create `src/components/k8s/CommandTerminal.tsx`
- [ ] Create dark terminal UI with monospace font
- [ ] Implement command input with `$ ` prompt
- [ ] Implement command history (up/down arrows)
- [ ] Implement command whitelist validation
- [ ] Display output with appropriate formatting
- [ ] Display errors in red
- [ ] Add loading indicator during execution
- [ ] Add timeout handling (30s)
- [ ] Add clear button
- [ ] Add copy output button
- [ ] Persist history to k8sStore (max 100)
- [ ] Write Vitest tests
- **Estimate:** 2h
- **Tests:** Commands execute, history works, whitelist enforced
- **Depends on:** TASK-002, TASK-004

### TASK-012: Implement HealthCheckPanel component
- [ ] Create `src/components/k8s/HealthCheckPanel.tsx`
- [ ] Display grid of health check buttons
- [ ] Implement 7 health check types (DNS, Connectivity, Storage, API Server, etcd, Scheduler, Controller)
- [ ] Add status indicator per check (pass/fail/warning/pending)
- [ ] Add "Run All" button
- [ ] Display last run timestamp
- [ ] Display execution duration
- [ ] Add expandable result details
- [ ] Handle loading states per check
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Checks execute, status updates, results display
- **Depends on:** TASK-002

### TASK-013: Implement MetricsChart component
- [ ] Create `src/components/k8s/MetricsChart.tsx`
- [ ] Implement Line/Area chart using Recharts
- [ ] Display CPU line (blue #3b82f6) and Memory line (purple #8b5cf6)
- [ ] Add hover tooltip with exact values
- [ ] Add time range selector (1h, 6h, 24h, 7d)
- [ ] Add interval selector (1m, 5m, 15m, 1h)
- [ ] Implement sparkline variant for compact views
- [ ] Add legend with current values
- [ ] Handle empty data state
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Chart renders, tooltip works, selectors work
- **Depends on:** TASK-002

### TASK-014: Implement NetworkingPanel component
- [x] Create `src/components/k8s/NetworkingPanel.tsx`
- [x] Display services grouped by namespace (ServiceCard component)
- [x] Show service type (ClusterIP, NodePort, LoadBalancer), ports, selector
- [x] Display ingress rules with hosts and paths (IngressCard component)
- [x] Show service-ingress connections visually (linked ingresses section)
- [x] Add namespace filter dropdown
- [x] Create collapsible sections per namespace (NamespaceSection component)
- [x] Handle empty states
- [x] Write Vitest tests
- [x] Fixed TypeScript errors to align with K8sService/K8sIngress interfaces
- **Estimate:** 1.5h
- **Completed:** 2026-01-25
- **Tests:** 27 tests passing (aligned with actual interface types)
- **Depends on:** TASK-002

---

## Phase 3: Advanced Components (4 tasks)

### TASK-015: Implement ResourceHierarchy component
- [ ] Create `src/components/k8s/ResourceHierarchy.tsx`
- [ ] Build D3 tree data from K8s resources
- [ ] Implement tree: Namespace -> Deployment -> ReplicaSet -> Pods
- [ ] Color-code nodes by status
- [ ] Implement expand/collapse branches
- [ ] Add click handler for node selection
- [ ] Implement zoom and pan controls
- [ ] Add fit-to-screen button
- [ ] Add namespace filter
- [ ] Handle loading and empty states
- [ ] Write Vitest tests
- **Estimate:** 2h
- **Tests:** Tree renders, interactions work, colors correct
- **Depends on:** TASK-002

### TASK-016: Implement real-time event updates
- [ ] Subscribe to K8s events on dashboard mount
- [ ] Update pod table on pod events
- [ ] Update cluster overview on status changes
- [ ] Show toast notification for critical events
- [ ] Display events in pod detail drawer
- [ ] Implement event filtering by type
- [ ] Add connection status indicator
- [ ] Implement reconnection handling
- [ ] Write integration tests
- **Estimate:** 1.5h
- **Tests:** Events received, UI updates, reconnection works
- **Depends on:** TASK-005, TASK-010

### TASK-017: Create K8sDashboard main component
- [ ] Create `src/components/k8s/K8sDashboard.tsx`
- [ ] Compose all panels in responsive grid layout
- [ ] Add page header with title and refresh button
- [ ] Add auto-refresh toggle
- [ ] Connect to k8sStore for state
- [ ] Handle global loading state
- [ ] Handle global error state with retry
- [ ] Implement responsive breakpoints
- [ ] Write integration tests
- **Estimate:** 1.5h
- **Tests:** All panels render, layout responsive
- **Depends on:** TASK-007 through TASK-015

### TASK-018: Create K8sPage route component
- [ ] Update `src/pages/K8sPage.tsx` from placeholder
- [ ] Import and render K8sDashboard
- [ ] Connect TanStack Query for data fetching
- [ ] Implement polling intervals
- [ ] Add error boundary
- [ ] Add page-level loading skeleton
- [ ] Write route tests
- **Estimate:** 45min
- **Tests:** Page renders, data fetches, errors handled
- **Depends on:** TASK-017

---

## Phase 4: Integration & Polish (8 tasks)

### TASK-019: Add keyboard navigation
- [ ] Add keyboard shortcuts for terminal (Enter, Up, Down, Ctrl+L)
- [ ] Add Escape to close pod drawer
- [ ] Add Tab navigation through dashboard panels
- [ ] Add focus management for modals
- [ ] Document shortcuts in UI
- [ ] Write accessibility tests
- **Estimate:** 1h
- **Tests:** Keyboard navigation works throughout
- **Depends on:** TASK-017

### TASK-020: Add accessibility attributes
- [ ] Add ARIA labels to all interactive elements
- [ ] Add role attributes to panels
- [ ] Ensure color contrast meets WCAG AA
- [ ] Add screen reader descriptions
- [ ] Run accessibility audit (axe)
- [ ] Fix any audit findings
- **Estimate:** 1h
- **Tests:** Accessibility audit score > 90
- **Depends on:** TASK-017

### TASK-021: Add loading and error states
- [ ] Create loading skeleton for each panel
- [ ] Add error states with retry buttons
- [ ] Add toast notifications for errors
- [ ] Add streaming indicator for logs
- [ ] Add connection lost warning
- **Estimate:** 1h
- **Tests:** All states display correctly
- **Depends on:** TASK-017

### TASK-022: Performance optimization
- [ ] Implement virtual scrolling for pods table
- [ ] Add lazy loading for ResourceHierarchy
- [ ] Memoize chart rendering
- [ ] Add polling pause when tab not visible
- [ ] Optimize re-renders with React.memo
- [ ] Run Lighthouse audit
- **Estimate:** 1.5h
- **Tests:** Lighthouse performance score > 80
- **Depends on:** TASK-017

### TASK-023: Write E2E tests
- [ ] E2E test: Navigate to K8s dashboard
- [ ] E2E test: View cluster health
- [ ] E2E test: Filter pods by namespace
- [ ] E2E test: Open pod detail and view logs
- [ ] E2E test: Execute read-only command
- [ ] E2E test: Run health check
- [ ] Use Playwright
- **Estimate:** 2h
- **Tests:** All E2E tests pass
- **Depends on:** TASK-018

### TASK-024: Create component exports and index
- [ ] Create `src/components/k8s/index.ts` with all exports
- [ ] Document public component API
- [ ] Add JSDoc comments to exported components
- [ ] Ensure proper TypeScript exports
- **Estimate:** 30min
- **Tests:** All components importable from index
- **Depends on:** TASK-017

### TASK-025: Update environment variables
- [ ] Add VITE_K8S_METRICS_POLL_INTERVAL to .env.example
- [ ] Add VITE_K8S_HEALTH_POLL_INTERVAL to .env.example
- [ ] Add VITE_K8S_COMMAND_TIMEOUT to .env.example
- [ ] Add VITE_K8S_LOG_LINES_LIMIT to .env.example
- [ ] Add validation in env.ts utility
- [ ] Document env vars in design.md
- **Estimate:** 30min
- **Tests:** App starts with env vars, validation works
- **Depends on:** None

### TASK-026: Add dark mode support
- [ ] Ensure terminal component works in dark mode
- [ ] Verify chart colors in dark mode
- [ ] Check status badge contrast in dark mode
- [ ] Test all components in dark/light modes
- [ ] Fix any contrast issues
- **Estimate:** 45min
- **Tests:** All components render correctly in both modes
- **Depends on:** TASK-017

---

## Phase 5: Documentation & Deployment (6 tasks)

### TASK-027: Write unit test suite
- [ ] Ensure all components have unit tests
- [ ] Ensure all API functions have tests
- [ ] Ensure store has complete test coverage
- [ ] Achieve > 80% code coverage
- [ ] Fix any failing tests
- **Estimate:** 1h
- **Tests:** All unit tests pass, coverage > 80%
- **Depends on:** All component tasks

### TASK-028: Create component documentation
- [ ] Add JSDoc to all components
- [ ] Document props interfaces
- [ ] Add usage examples
- [ ] Create Storybook stories for main components
- **Estimate:** 1h
- **Tests:** Storybook renders stories
- **Depends on:** TASK-024

### TASK-029: Update API contract documentation
- [ ] Document all K8s API endpoints
- [ ] Add request/response examples
- [ ] Document WebSocket events
- [ ] Add to contracts/ if needed
- **Estimate:** 45min
- **Tests:** N/A (documentation)
- **Depends on:** TASK-002

### TASK-030: Integration testing
- [ ] Test with mock backend
- [ ] Test WebSocket reconnection
- [ ] Test error handling flows
- [ ] Test polling behavior
- [ ] Document any issues found
- **Estimate:** 1.5h
- **Tests:** All integration scenarios pass
- **Depends on:** TASK-023

### TASK-031: Build and verify Docker image
- [ ] Build Docker image locally
- [ ] Verify K8s dashboard loads in container
- [ ] Test with mock data
- [ ] Verify no console errors
- **Estimate:** 30min
- **Tests:** Docker container runs, dashboard works
- **Depends on:** TASK-027

### TASK-032: Final review and cleanup
- [ ] Run linter and fix any issues
- [ ] Run TypeScript compiler strict check
- [ ] Remove any console.log statements
- [ ] Review all TODO comments
- [ ] Update tasks.md with completion status
- **Estimate:** 30min
- **Tests:** Lint passes, no TypeScript errors
- **Depends on:** All tasks

---

## Task Dependencies

### Critical Path
1. TASK-001 (Types) -> TASK-002 (API) -> TASK-003 (Mocks)
2. TASK-002 + TASK-004 (Store) -> Component Tasks (TASK-007 to TASK-015)
3. Component Tasks -> TASK-017 (Dashboard) -> TASK-018 (Page)
4. TASK-018 -> Integration Tasks (TASK-019 to TASK-023)
5. All Tasks -> TASK-032 (Final Review)

### Parallel Tracks
- **Track 1 (Core)**: TASK-007 -> TASK-008 -> TASK-009a -> TASK-009b -> TASK-009c -> TASK-010a -> TASK-010b -> TASK-010c
- **Track 2 (Terminal/Health)**: TASK-011 -> TASK-012
- **Track 3 (Charts/Network)**: TASK-013 -> TASK-014
- **Track 4 (Advanced)**: TASK-015 -> TASK-016

Tasks in different tracks can be parallelized after Phase 1 completion.

---

## Estimates Summary

| Phase | Tasks | Total Time |
|-------|-------|------------|
| Phase 1: Foundation | 6 | 5h |
| Phase 2: Core Components | 12 | 14.25h |
| Phase 3: Advanced | 4 | 5.75h |
| Phase 4: Integration | 8 | 8.25h |
| Phase 5: Documentation | 6 | 5.25h |
| **Total** | **36** | **38.5h** |

Estimated duration: 5-6 working days

---

## Definition of Done

- [ ] All 36 tasks marked complete
- [ ] All unit tests pass (> 80% coverage)
- [ ] All E2E tests pass
- [ ] Linter passes with zero errors
- [ ] TypeScript compilation successful
- [ ] Accessibility audit score > 90
- [ ] Lighthouse performance score > 80
- [ ] Docker image builds and runs
- [ ] Documentation complete
- [ ] Code reviewed

---

## Risks

| Risk | Mitigation |
|------|------------|
| Backend K8s endpoints not ready | Mock data layer provides full coverage |
| D3 tree performance with many resources | Limit visible nodes, virtualization |
| WebSocket stability | Polling fallback, reconnection logic |
| Command execution security | Strict whitelist, timeout enforcement |
| Large pod/log datasets | Pagination, virtual scrolling, limits |

---

## Notes

- Each task should take < 2 hours
- Mark task as complete only after tests pass
- Update progress percentage after each task
- If blocked, document blocker and move to next unblocked task
- Run linter after every 5 tasks
- Commit after every complete component
