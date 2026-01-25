# P05-F10 Metrics Dashboard - User Stories

## Epic Summary

As a **platform operator**, I want to visualize time series metrics from VictoriaMetrics in the HITL-UI so that I can monitor system health, identify performance issues, and ensure reliable service operation.

---

## User Stories

### US-1: View CPU and Memory Metrics

**As a** platform operator
**I want** to see CPU and memory usage over time for aSDLC services
**So that** I can identify resource constraints before they cause issues

**Acceptance Criteria:**

1. Given I navigate to the Metrics page, I see a CPU usage chart
2. Given I navigate to the Metrics page, I see a Memory usage chart
3. Given metrics data is available, both charts display line graphs with time on X-axis
4. Given metrics data is available, the Y-axis shows percentage (0-100%)
5. Given I hover over a data point, I see a tooltip with exact value and timestamp
6. Given no metrics data is available, I see an appropriate empty state message

**Test Cases:**

```gherkin
Scenario: CPU chart displays with data
  Given VictoriaMetrics returns CPU metrics
  When I view the Metrics page
  Then I see a line chart titled "CPU Usage"
  And the chart shows data points over time
  And the Y-axis ranges from 0% to 100%

Scenario: Memory chart displays with data
  Given VictoriaMetrics returns memory metrics
  When I view the Metrics page
  Then I see a line chart titled "Memory Usage"
  And the chart shows data points over time

Scenario: Empty state when no data
  Given VictoriaMetrics returns empty results
  When I view the Metrics page
  Then I see "No metrics data available" message
```

---

### US-2: Filter Metrics by Service

**As a** platform operator
**I want** to filter metrics by specific service (orchestrator, workers, hitl-ui)
**So that** I can focus on the service I am investigating

**Acceptance Criteria:**

1. Given I am on the Metrics page, I see a service selector dropdown
2. Given the dropdown is open, I see options for all available services plus "All Services"
3. Given I select a specific service, all charts update to show only that service's metrics
4. Given I select "All Services", charts show aggregated metrics across all services
5. Given a service is unhealthy, its name shows with a warning indicator in the dropdown

**Test Cases:**

```gherkin
Scenario: Service selector shows available services
  Given the Metrics page is loaded
  When I click the service selector
  Then I see "All Services" option
  And I see "orchestrator" option
  And I see "worker-pool" option
  And I see "hitl-ui" option

Scenario: Selecting a service filters charts
  Given I am viewing All Services metrics
  When I select "orchestrator" from the service selector
  Then all charts update to show only orchestrator metrics
  And the URL updates to include service=orchestrator

Scenario: Service health indicator
  Given "worker-pool" service is unhealthy
  When I open the service selector
  Then "worker-pool" shows with a yellow warning indicator
```

---

### US-3: Select Time Range

**As a** platform operator
**I want** to choose different time ranges (15m, 1h, 6h, 24h, 7d)
**So that** I can view both recent activity and historical trends

**Acceptance Criteria:**

1. Given I am on the Metrics page, I see a time range selector with options: 15m, 1h, 6h, 24h, 7d
2. Given I click a time range option, that option becomes visually selected
3. Given I select a time range, all charts update to show data for that period
4. Given the default page load, the 1h time range is selected
5. Given I change the time range, the data resolution adjusts appropriately

**Test Cases:**

```gherkin
Scenario: Time range selector displays options
  Given the Metrics page is loaded
  Then I see buttons for 15m, 1h, 6h, 24h, 7d
  And the 1h button is highlighted as active

Scenario: Changing time range updates charts
  Given I am viewing the 1h time range
  When I click the "24h" button
  Then the 24h button becomes active
  And all charts update to show 24 hours of data
  And the X-axis labels adjust to show appropriate time intervals

Scenario: Time range affects data resolution
  Given I select the "15m" time range
  Then charts show data points every ~15 seconds
  Given I select the "7d" time range
  Then charts show data points every ~1 hour
```

---

### US-4: View Request Rate Metrics

**As a** platform operator
**I want** to see request rate (requests per second) over time
**So that** I can understand traffic patterns and detect anomalies

**Acceptance Criteria:**

1. Given I am on the Metrics page, I see a Request Rate chart
2. Given metrics data is available, the chart displays an area graph
3. Given I hover over the chart, I see requests/sec value at that time
4. Given the Y-axis label shows "req/s"
5. Given traffic spike occurs, the chart clearly shows the spike

**Test Cases:**

```gherkin
Scenario: Request rate chart displays
  Given VictoriaMetrics returns request rate metrics
  When I view the Metrics page
  Then I see an area chart titled "Request Rate"
  And the Y-axis shows "req/s"

Scenario: Tooltip shows rate value
  Given the Request Rate chart has data
  When I hover over a data point
  Then I see a tooltip showing "X.X req/s"
  And the tooltip shows the timestamp
```

---

### US-5: View Latency Percentiles

**As a** platform operator
**I want** to see request latency percentiles (p50, p95, p99)
**So that** I can understand response time distribution and identify slow requests

**Acceptance Criteria:**

1. Given I am on the Metrics page, I see a Latency chart
2. Given the chart displays, I see three lines: p50 (median), p95, and p99
3. Given the legend shows, each percentile has a distinct color and label
4. Given I hover over the chart, I see all three percentile values for that time
5. Given the Y-axis shows latency in appropriate units (ms or s)

**Test Cases:**

```gherkin
Scenario: Latency chart shows all percentiles
  Given VictoriaMetrics returns latency metrics
  When I view the Metrics page
  Then I see a line chart titled "Request Latency"
  And I see a blue line labeled "p50"
  And I see an orange line labeled "p95"
  And I see a red line labeled "p99"

Scenario: Latency tooltip shows all values
  Given the Latency chart has data
  When I hover over a point at time T
  Then the tooltip shows "p50: Xms"
  And the tooltip shows "p95: Xms"
  And the tooltip shows "p99: Xms"
```

---

### US-6: View Active Tasks Gauge

**As a** platform operator
**I want** to see the current number of active tasks
**So that** I can understand system load at a glance

**Acceptance Criteria:**

1. Given I am on the Metrics page, I see an Active Tasks gauge
2. Given the gauge displays, it shows the current count as a large number
3. Given the gauge displays, it shows comparison to a historical average or max
4. Given the count changes, the gauge updates during auto-refresh

**Test Cases:**

```gherkin
Scenario: Active tasks gauge displays current count
  Given there are 15 active tasks
  When I view the Metrics page
  Then I see a gauge showing "15"
  And I see the label "Active Tasks"

Scenario: Gauge shows context
  Given the historical max is 50 active tasks
  When I view the Metrics page
  Then the gauge shows "15 / 50 max"
  Or the gauge shows a progress indicator
```

---

### US-7: Enable Auto-Refresh

**As a** platform operator
**I want** to toggle auto-refresh for real-time monitoring
**So that** charts update without manual intervention

**Acceptance Criteria:**

1. Given I am on the Metrics page, I see an auto-refresh toggle button
2. Given auto-refresh is enabled, the button shows "Auto-refresh: On"
3. Given auto-refresh is enabled, all charts refresh every 30 seconds
4. Given I click the toggle, auto-refresh switches off/on
5. Given auto-refresh is disabled, charts only update on manual refresh

**Test Cases:**

```gherkin
Scenario: Auto-refresh toggle exists
  Given the Metrics page is loaded
  Then I see an auto-refresh toggle button
  And the button shows current state (on/off)

Scenario: Enabling auto-refresh
  Given auto-refresh is off
  When I click the auto-refresh toggle
  Then auto-refresh becomes on
  And charts begin refreshing every 30 seconds

Scenario: Disabling auto-refresh
  Given auto-refresh is on
  When I click the auto-refresh toggle
  Then auto-refresh becomes off
  And charts stop automatic updates
```

---

### US-8: Manual Refresh

**As a** platform operator
**I want** to manually refresh all metrics
**So that** I can get the latest data immediately without waiting for auto-refresh

**Acceptance Criteria:**

1. Given I am on the Metrics page, I see a refresh button
2. Given I click the refresh button, all charts reload data
3. Given a refresh is in progress, the button shows a loading indicator
4. Given the refresh completes, the button returns to normal state

**Test Cases:**

```gherkin
Scenario: Manual refresh button
  Given the Metrics page is loaded
  When I click the refresh button
  Then all chart data reloads from the API
  And I see a loading indicator during fetch

Scenario: Refresh while auto-refresh is on
  Given auto-refresh is enabled
  When I click the refresh button
  Then charts refresh immediately
  And the auto-refresh timer resets
```

---

### US-9: Navigate to Metrics from Sidebar

**As a** platform operator
**I want** the Metrics page accessible from the sidebar navigation
**So that** I can easily find the metrics dashboard

**Acceptance Criteria:**

1. Given I am in the HITL-UI, I see "Metrics" in the sidebar navigation
2. Given I click "Metrics" in the sidebar, I navigate to /metrics
3. Given I am on the Metrics page, the Metrics nav item is highlighted

**Test Cases:**

```gherkin
Scenario: Metrics in sidebar
  Given I am on any page in HITL-UI
  Then I see "Metrics" in the sidebar under Workflow section
  And it has a chart icon

Scenario: Navigate to Metrics page
  Given I am on the Dashboard
  When I click "Metrics" in the sidebar
  Then I navigate to /metrics
  And the Metrics page loads
```

---

### US-10: Handle Loading and Error States

**As a** platform operator
**I want** clear feedback when metrics are loading or unavailable
**So that** I understand the system state and can troubleshoot issues

**Acceptance Criteria:**

1. Given metrics are loading, I see skeleton loaders for each chart
2. Given a chart fails to load, I see an error message with retry option
3. Given VictoriaMetrics is unreachable, I see a banner indicating the issue
4. Given partial data is available, available charts render while failed ones show errors

**Test Cases:**

```gherkin
Scenario: Loading state
  Given the Metrics page is loading
  Then I see animated skeleton placeholders for charts
  And I do not see error messages

Scenario: Error state for single chart
  Given CPU metrics fail to load
  And memory metrics load successfully
  Then the CPU chart shows "Failed to load CPU metrics" with Retry button
  And the Memory chart displays normally

Scenario: Global error
  Given VictoriaMetrics is unreachable
  When I view the Metrics page
  Then I see a banner "Unable to connect to metrics service"
  And I see a Retry button
```

---

## Story Dependencies

```
US-9 (Navigation) --> US-1 (CPU/Memory) --> US-2 (Service Filter)
                  --> US-4 (Request Rate)    --> US-3 (Time Range)
                  --> US-5 (Latency)         --> US-7 (Auto-refresh)
                  --> US-6 (Active Tasks)    --> US-8 (Manual Refresh)
                                              --> US-10 (Error States)
```

## Out of Scope

- Alerting configuration (separate feature)
- Custom dashboard creation
- Metric exploration/ad-hoc queries
- Export/download functionality
- Comparison across time periods (e.g., this week vs last week)
