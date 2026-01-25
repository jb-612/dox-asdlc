# P05-F09: Kubernetes Visibility Dashboard - User Stories

## Epic Summary

As an aSDLC operator, I need a Kubernetes visibility dashboard in the HITL UI so that I can monitor cluster health, diagnose issues, and understand resource utilization without switching to external tools.

**Value Proposition:**
- Single pane of glass for aSDLC cluster monitoring
- Reduced context switching during operations
- Faster issue diagnosis with integrated command terminal
- Visual understanding of resource relationships and dependencies

---

## User Stories

### US-01: View Cluster Health Overview

**As an** operator,
**I want to** see an at-a-glance cluster health summary,
**So that** I can quickly determine if the cluster is healthy or needs attention.

**Acceptance Criteria:**
- [ ] Display cluster health status indicator (healthy/degraded/critical)
- [ ] Show node readiness count (X/Y nodes ready)
- [ ] Show pod status summary (running, pending, failed counts)
- [ ] Show aggregate CPU utilization percentage
- [ ] Show aggregate memory utilization percentage
- [ ] Auto-refresh every 10 seconds
- [ ] Click on any metric navigates to detailed view

**Technical Notes:**
- Use KPI card pattern from CockpitPage
- Color coding: green (<70%), yellow (70-85%), red (>85%)

---

### US-02: View Node Status and Capacity

**As an** operator,
**I want to** see the status and capacity of all cluster nodes,
**So that** I can identify node issues and capacity constraints.

**Acceptance Criteria:**
- [ ] Display node cards with name, status, and roles
- [ ] Show node conditions (Ready, DiskPressure, MemoryPressure, etc.)
- [ ] Display capacity metrics (CPU, Memory, Pods)
- [ ] Show current utilization as progress bars
- [ ] Color-code node status (Ready=green, NotReady=red)
- [ ] Show node age and Kubernetes version
- [ ] Filter nodes by status
- [ ] Click node for detailed view

**Technical Notes:**
- Expandable cards similar to WorkerUtilizationPanel
- Progress bars for utilization

---

### US-03: View and Filter Pod Listing

**As an** operator,
**I want to** view all pods with filtering and search,
**So that** I can find and inspect specific pods quickly.

**Acceptance Criteria:**
- [ ] Display sortable table with: Name, Namespace, Status, Node, Age, Restarts
- [ ] Filter by namespace (dropdown with multi-select)
- [ ] Filter by status (Running, Pending, Failed, Succeeded)
- [ ] Filter by node name
- [ ] Search by pod name (debounced input)
- [ ] Color-coded status badges
- [ ] Show container count per pod
- [ ] Pagination (50 pods per page)
- [ ] Click row opens pod detail drawer

**Technical Notes:**
- Reuse table patterns from RunsTable
- Virtual scrolling for 100+ pods

---

### US-04: View Pod Details and Logs

**As an** operator,
**I want to** view detailed information and logs for a specific pod,
**So that** I can diagnose issues with specific workloads.

**Acceptance Criteria:**
- [ ] Display pod metadata (name, namespace, labels, annotations)
- [ ] Show owner reference (Deployment, StatefulSet, etc.)
- [ ] List all containers with status
- [ ] Show container restart history with reasons
- [ ] Display pod events
- [ ] View container logs (last 1000 lines)
- [ ] Logs auto-scroll with pause on scroll up
- [ ] Filter logs by container (if multi-container)
- [ ] Copy logs button
- [ ] Download logs button
- [ ] Drawer can be expanded/collapsed

**Technical Notes:**
- Right-side drawer pattern matching RightPanel
- Tabbed interface: Info | Containers | Events | Logs

---

### US-05: Visualize Network Topology

**As an** operator,
**I want to** visualize services, ingresses, and network policies,
**So that** I can understand network traffic flow.

**Acceptance Criteria:**
- [ ] Display services grouped by namespace
- [ ] Show service type, ports, and selector
- [ ] Display ingress rules with hosts and paths
- [ ] Show which services ingresses route to
- [ ] List network policies with affected pods
- [ ] Filter by namespace
- [ ] Click service shows connected pods
- [ ] Click ingress highlights service

**Technical Notes:**
- Use diagram view with service->pod connections
- Group by namespace with collapsible sections

---

### US-06: View Resource Hierarchy

**As an** operator,
**I want to** see the hierarchical relationship of resources,
**So that** I can understand deployment structure and ownership.

**Acceptance Criteria:**
- [ ] Display D3 tree: Namespace -> Deployment/StatefulSet -> ReplicaSet -> Pods
- [ ] Color-code nodes by status
- [ ] Collapse/expand branches
- [ ] Click node shows details in sidebar
- [ ] Filter by namespace
- [ ] Zoom and pan controls
- [ ] Fit-to-screen button
- [ ] Show resource counts at each level

**Technical Notes:**
- Use react-d3-tree (already installed)
- Similar interaction patterns to WorkflowGraphView

---

### US-07: Execute Diagnostic Commands

**As an** operator,
**I want to** execute kubectl and docker commands from the UI,
**So that** I can diagnose issues without switching to terminal.

**Acceptance Criteria:**
- [ ] Dark terminal-style interface with monospace font
- [ ] Command input with `$ ` prompt
- [ ] Command history (up/down arrows)
- [ ] Output displayed with appropriate formatting
- [ ] Errors displayed in red
- [ ] Loading indicator during execution
- [ ] Timeout after 30 seconds with message
- [ ] Clear terminal button
- [ ] Copy output button
- [ ] Only allow whitelisted read-only commands
- [ ] Display command execution duration

**Allowed Commands:**
- `kubectl get [resource]`
- `kubectl describe [resource] [name]`
- `kubectl logs [pod] [-c container]`
- `kubectl top [nodes|pods]`
- `docker ps`
- `docker logs [container]`
- `docker stats`

**Technical Notes:**
- Dark theme: bg #0d1117, text #c9d1d9
- Monospace font: JetBrains Mono or Fira Code
- Max 100 history entries in Zustand store

---

### US-08: Run Health Checks

**As an** operator,
**I want to** run diagnostic health checks with one click,
**So that** I can quickly verify cluster component health.

**Acceptance Criteria:**
- [ ] Display grid of health check buttons
- [ ] Health check types: DNS, Connectivity, Storage, API Server, etcd, Scheduler, Controller
- [ ] Show status indicator per check (pass/fail/warning/pending)
- [ ] "Run All" button to execute all checks
- [ ] Display last run timestamp per check
- [ ] Show execution duration
- [ ] Expandable result details with messages
- [ ] Loading state during check execution

**Technical Notes:**
- Similar to button grid pattern
- Status colors match cluster health colors

---

### US-09: View CPU and Memory Trends

**As an** operator,
**I want to** view CPU and memory utilization trends over time,
**So that** I can identify patterns and capacity issues.

**Acceptance Criteria:**
- [ ] Line/Area chart showing CPU and Memory over time
- [ ] CPU line in blue, Memory line in purple
- [ ] Time range selector (1h, 6h, 24h, 7d)
- [ ] Interval selector (1m, 5m, 15m, 1h)
- [ ] Hover tooltip with exact values and timestamp
- [ ] Y-axis 0-100%
- [ ] Legend with current values
- [ ] Sparkline variant for compact views
- [ ] Chart for cluster-wide metrics
- [ ] Chart for individual node metrics (on node detail)

**Technical Notes:**
- Use Recharts LineChart/AreaChart
- Polling every 30 seconds
- Colors: CPU #3b82f6, Memory #8b5cf6

---

### US-10: Navigate to K8s Dashboard

**As an** operator,
**I want to** access the K8s dashboard from the main navigation,
**So that** I can easily find cluster monitoring.

**Acceptance Criteria:**
- [ ] K8s dashboard link in sidebar under "Operations" section
- [ ] Icon: Server/Cloud icon
- [ ] Route: /k8s
- [ ] Dashboard loads with all panels visible
- [ ] Responsive layout (panels stack on mobile)
- [ ] Page title: "Kubernetes Dashboard"
- [ ] Loading skeleton while data fetches

**Technical Notes:**
- Add to Sidebar.tsx navigation
- Lazy load K8sPage component
- Add route to App.tsx

---

### US-11: Real-time Event Updates

**As an** operator,
**I want to** see real-time Kubernetes events,
**So that** I can react quickly to cluster changes.

**Acceptance Criteria:**
- [ ] WebSocket subscription to K8s events
- [ ] Events displayed in pod detail drawer
- [ ] Toast notification for critical events (pod crashed, node unhealthy)
- [ ] Event history (last 50 events)
- [ ] Filter events by type (Warning, Normal)
- [ ] Connection status indicator
- [ ] Automatic reconnection on disconnect

**Technical Notes:**
- Extend existing WebSocket infrastructure
- Add k8s event types to EventTypes constant

---

## Non-Functional Requirements

### Performance
- Dashboard initial load < 2 seconds
- Metrics chart renders < 500ms
- Pod table with 500 pods scrolls smoothly
- Command execution timeout: 30 seconds max

### Accessibility
- All interactive elements keyboard accessible
- ARIA labels on all components
- Color contrast meets WCAG AA
- Screen reader compatible

### Responsiveness
- Desktop: Full dashboard with all panels
- Tablet: 2-column layout, stacked panels
- Mobile: Single column, collapsible panels

---

## Acceptance Test Scenarios

### Scenario 1: Cluster Health Verification
```
Given I am on the K8s dashboard
When the page loads
Then I see the cluster health indicator
And I see nodes ready count
And I see pods running count
And I see CPU/Memory utilization
And the data refreshes every 10 seconds
```

### Scenario 2: Pod Investigation
```
Given I am on the K8s dashboard
When I click on a pod in the pods table
Then the pod detail drawer opens
And I see pod metadata
And I can view container logs
And I can see pod events
And I can close the drawer
```

### Scenario 3: Command Execution
```
Given I am on the K8s dashboard
When I type "kubectl get pods -n dox-asdlc" in the terminal
And I press Enter
Then I see a loading indicator
And the command output is displayed
And the duration is shown
And I can scroll through the output
```

### Scenario 4: Health Check Execution
```
Given I am on the K8s dashboard
When I click the "DNS" health check button
Then the button shows a loading state
And after completion I see pass/fail status
And I can expand to see details
And the last run time is updated
```

### Scenario 5: Metrics Trend Analysis
```
Given I am on the K8s dashboard
When I view the metrics chart
Then I see CPU and Memory trend lines
When I select "24h" time range
Then the chart updates to show 24 hours of data
When I hover over a data point
Then I see the exact values in a tooltip
```

---

## Story Points Estimate

| Story | Complexity | Points |
|-------|------------|--------|
| US-01 | Low | 2 |
| US-02 | Medium | 3 |
| US-03 | Medium | 3 |
| US-04 | High | 5 |
| US-05 | Medium | 3 |
| US-06 | High | 5 |
| US-07 | High | 5 |
| US-08 | Medium | 3 |
| US-09 | Medium | 3 |
| US-10 | Low | 1 |
| US-11 | Medium | 3 |
| **Total** | | **36** |

---

## Dependencies

- US-10 (Navigation) must be completed early to enable testing
- US-01 (Cluster Overview) provides foundation for other panels
- US-03 (Pods Table) required before US-04 (Pod Details)
- US-07 (Command Terminal) is independent and can be parallelized
- US-09 (Metrics Chart) requires backend metrics endpoint

## Out of Scope for MVP

- Multi-cluster support
- Deployments/StatefulSet editing
- kubectl apply/delete commands
- Custom resource definitions (CRDs)
- RBAC configuration
- Cost analysis
- Node cordon/drain actions
