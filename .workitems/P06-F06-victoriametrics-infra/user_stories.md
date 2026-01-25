# P06-F06: VictoriaMetrics Infrastructure - User Stories

**Version:** 1.0
**Date:** January 25, 2026
**Status:** Draft

## Epic Summary

As a platform engineer, I want VictoriaMetrics deployed as the time series database for aSDLC monitoring, so that microservices can push metrics and operators can query system health.

### Epic Dependencies

| Direction | Feature | Description |
|-----------|---------|-------------|
| Downstream | P02-F07 | Backend metrics instrumentation needs VictoriaMetrics endpoint |
| Downstream | P05-F10 | Metrics dashboard needs VictoriaMetrics query API |

---

## User Stories

### US-1: Deploy VictoriaMetrics StatefulSet

**As a** DevOps engineer
**I want** VictoriaMetrics deployed as a StatefulSet with persistent storage
**So that** metrics data survives pod restarts and cluster upgrades

#### Acceptance Criteria

1. StatefulSet deploys with 1 replica in single-node mode
2. PersistentVolumeClaim provisions 10Gi storage (configurable)
3. Pod becomes Ready within 60 seconds
4. Data persists across pod restarts
5. Retention period configurable (default 30 days)

#### Acceptance Tests

```gherkin
Scenario: VictoriaMetrics pod starts successfully
  Given the Helm chart is installed
  When I check the StatefulSet status
  Then the pod should be Running and Ready
  And the health endpoint /health should return 200

Scenario: Data persists across restart
  Given VictoriaMetrics is running
  And I write a test metric via remote write
  When I delete and recreate the pod
  Then the test metric should still be queryable

Scenario: Retention is applied
  Given retention is set to "7d"
  When I install the chart with custom values
  Then VictoriaMetrics should start with -retentionPeriod=7d
```

---

### US-2: Deploy vmagent DaemonSet

**As a** DevOps engineer
**I want** vmagent deployed as a DaemonSet
**So that** all pods in the cluster have their /metrics endpoints scraped

#### Acceptance Criteria

1. DaemonSet deploys one vmagent pod per node
2. vmagent has RBAC permissions to discover pods and endpoints
3. Scrape configuration targets pods with prometheus.io/scrape annotation
4. Scraped metrics are pushed to VictoriaMetrics via remote write
5. vmagent resource usage is minimal (under 128Mi memory)

#### Acceptance Tests

```gherkin
Scenario: vmagent pod runs on each node
  Given a 3-node Kubernetes cluster
  When I install the chart with vmagent enabled
  Then 3 vmagent pods should be Running

Scenario: vmagent scrapes annotated pods
  Given orchestrator pod has prometheus.io/scrape: "true"
  When vmagent runs for 30 seconds
  Then orchestrator metrics appear in VictoriaMetrics

Scenario: vmagent has minimal resource usage
  Given vmagent is running
  When I check resource consumption
  Then memory usage should be under 128Mi
```

---

### US-3: Create Helm Subchart

**As a** DevOps engineer
**I want** a Helm subchart for VictoriaMetrics following project patterns
**So that** it integrates seamlessly with the dox-asdlc umbrella chart

#### Acceptance Criteria

1. Chart.yaml follows project conventions (version 0.1.0, appVersion matches image tag)
2. values.yaml has all configurable options with sensible defaults
3. _helpers.tpl provides standard label and name helpers
4. templates/ contains statefulset, daemonset, service, configmap, RBAC resources
5. Chart can be disabled via victoriametrics.enabled: false
6. Parent Chart.yaml lists victoriametrics as dependency

#### Acceptance Tests

```gherkin
Scenario: Chart renders without errors
  Given the subchart is defined
  When I run helm template dox-asdlc
  Then no template errors should occur
  And VictoriaMetrics resources should be rendered

Scenario: Chart can be disabled
  Given victoriametrics.enabled is false
  When I render templates
  Then no VictoriaMetrics resources should be rendered

Scenario: Custom values are applied
  Given I set persistence.size to "50Gi"
  When I render templates
  Then the PVC should request 50Gi storage
```

---

### US-4: Add Docker Compose Service

**As a** developer
**I want** VictoriaMetrics in docker-compose.yml
**So that** I can run the full monitoring stack locally

#### Acceptance Criteria

1. victoriametrics service added to docker/docker-compose.yml
2. Service uses official VictoriaMetrics image (victoriametrics/victoria-metrics)
3. Port 8428 is exposed for local access
4. Named volume persists data between restarts
5. Health check validates service readiness
6. Service is on asdlc-network for container communication

#### Acceptance Tests

```gherkin
Scenario: VictoriaMetrics starts in docker-compose
  Given docker-compose.yml includes victoriametrics
  When I run docker-compose up victoriametrics
  Then the container should reach healthy state
  And http://localhost:8428/health should return 200

Scenario: Volume persists data
  Given victoriametrics has been running
  And I wrote a test metric
  When I run docker-compose down && docker-compose up
  Then the test metric should still exist

Scenario: Network connectivity
  Given victoriametrics is running
  When I exec into orchestrator container
  Then I can curl http://victoriametrics:8428/health
```

---

### US-5: Expose Service and Configure Scrape Targets

**As a** DevOps engineer
**I want** VictoriaMetrics exposed via ClusterIP service with scrape configuration
**So that** pods can push metrics and vmagent knows what to scrape

#### Acceptance Criteria

1. ClusterIP service named "metrics-store" exposes port 8428
2. ConfigMap contains vmagent scrape configuration
3. Scrape config uses kubernetes_sd_configs for pod discovery
4. Relabeling keeps only pods with prometheus.io/scrape annotation
5. Default scrape interval is 15s (configurable)

#### Acceptance Tests

```gherkin
Scenario: Service is accessible within cluster
  Given VictoriaMetrics is deployed
  When I exec into any pod in the namespace
  Then I can reach http://metrics-store:8428/health

Scenario: Scrape config discovers pods
  Given pods have prometheus.io/scrape: "true" annotation
  When vmagent reloads configuration
  Then targets should appear in vmagent /targets endpoint

Scenario: Scrape interval is configurable
  Given I set scrape.interval to "30s"
  When I render the ConfigMap
  Then scrape_interval should be 30s
```

---

## Definition of Done

For this feature to be complete:

- [ ] All 5 user stories have passing acceptance tests
- [ ] Helm chart renders without errors
- [ ] Docker Compose service starts and passes health check
- [ ] Integration test confirms write and query works
- [ ] Parent Chart.yaml updated with victoriametrics dependency
- [ ] Parent values.yaml includes victoriametrics configuration
- [ ] All resources follow project naming conventions
- [ ] RBAC permissions are minimal and scoped correctly

## Out of Scope

The following are explicitly out of scope for P06-F06:

- Backend instrumentation code (P02-F07)
- HITL-UI metrics dashboard (P05-F10)
- Alerting rules and AlertManager
- High-availability or clustering
- Authentication/authorization for metrics endpoints
- Grafana deployment
