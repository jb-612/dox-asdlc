# P06-F06: VictoriaMetrics Infrastructure - Tasks

**Version:** 1.0
**Date:** January 25, 2026
**Status:** Complete

## Task Summary

| Task | Description | Estimate | Status |
|------|-------------|----------|--------|
| T1 | Create Chart.yaml and values.yaml | 30 min | Complete |
| T2 | Create _helpers.tpl template | 30 min | Complete |
| T3 | Create StatefulSet template | 45 min | Complete |
| T4 | Create Service template | 20 min | Complete |
| T5 | Create ConfigMap template | 30 min | Complete |
| T6 | Create RBAC templates | 30 min | Complete |
| T7 | Create DaemonSet template for vmagent | 45 min | Complete |
| T8 | Update parent Chart.yaml | 15 min | Complete |
| T9 | Update parent values.yaml | 20 min | Complete |
| T10 | Add docker-compose service | 30 min | Complete |
| T11 | Add docker-compose volume | 10 min | Complete |
| T12 | Template rendering tests | 45 min | Complete |
| T13 | Integration smoke test | 30 min | Complete |

**Total Estimate:** 6 hours 20 minutes

---

## Task Details

### T1: Create Chart.yaml and values.yaml

**Estimate:** 30 minutes
**Depends on:** None
**User Story:** US-3

Create the base chart metadata and default configuration values.

**Files to create:**
- `helm/dox-asdlc/charts/victoriametrics/Chart.yaml`
- `helm/dox-asdlc/charts/victoriametrics/values.yaml`

**Acceptance criteria:**
- [x] Chart.yaml follows project conventions (see elasticsearch/Chart.yaml)
- [x] Chart.yaml has apiVersion: v2, name: victoriametrics
- [x] Chart.yaml has version: 0.1.0, appVersion: "v1.96.0"
- [x] Chart.yaml includes relevant keywords
- [x] values.yaml has enabled toggle
- [x] values.yaml has server configuration section
- [x] values.yaml has vmagent configuration section
- [x] values.yaml has persistence configuration
- [x] values.yaml has resource limits/requests
- [x] values.yaml has probe configuration
- [x] values.yaml has scrape configuration

```
[x] T1 Complete
```

---

### T2: Create _helpers.tpl template

**Estimate:** 30 minutes
**Depends on:** T1
**User Story:** US-3

Create template helper functions following elasticsearch pattern.

**Files to create:**
- `helm/dox-asdlc/charts/victoriametrics/templates/_helpers.tpl`

**Acceptance criteria:**
- [x] victoriametrics.name helper defined
- [x] victoriametrics.fullname helper defined
- [x] victoriametrics.serviceName helper defined (for "metrics-store" abstraction)
- [x] victoriametrics.chart helper defined
- [x] victoriametrics.labels helper defined
- [x] victoriametrics.selectorLabels helper defined
- [x] victoriametrics.vmagent.fullname helper defined
- [x] All helpers handle truncation to 63 chars

```
[x] T2 Complete
```

---

### T3: Create StatefulSet template

**Estimate:** 45 minutes
**Depends on:** T2
**User Story:** US-1

Create the VictoriaMetrics server StatefulSet.

**Files to create:**
- `helm/dox-asdlc/charts/victoriametrics/templates/statefulset.yaml`

**Acceptance criteria:**
- [x] StatefulSet uses {{ include "victoriametrics.fullname" . }}
- [x] Conditional on {{ if .Values.enabled }}
- [x] Uses victoriametrics/victoria-metrics image
- [x] Configures -storageDataPath and -retentionPeriod
- [x] Exposes port 8428 named http
- [x] Includes liveness probe on /health
- [x] Includes readiness probe on /health
- [x] Mounts PVC for data persistence
- [x] volumeClaimTemplates provision storage
- [x] Supports nodeSelector, tolerations, affinity
- [x] Resources section templated from values

```
[x] T3 Complete
```

---

### T4: Create Service template

**Estimate:** 20 minutes
**Depends on:** T2
**User Story:** US-5

Create ClusterIP service for VictoriaMetrics.

**Files to create:**
- `helm/dox-asdlc/charts/victoriametrics/templates/service.yaml`

**Acceptance criteria:**
- [x] Service uses {{ include "victoriametrics.serviceName" . }}
- [x] Conditional on {{ if .Values.enabled }}
- [x] Type: ClusterIP
- [x] Port 8428 targeting http
- [x] Selector matches StatefulSet pods
- [x] Labels follow project conventions

```
[x] T4 Complete
```

---

### T5: Create ConfigMap template

**Estimate:** 30 minutes
**Depends on:** T2
**User Story:** US-5

Create ConfigMap with vmagent scrape configuration.

**Files to create:**
- `helm/dox-asdlc/charts/victoriametrics/templates/configmap.yaml`

**Acceptance criteria:**
- [x] ConfigMap contains vmagent scrape configuration YAML
- [x] Conditional on {{ if and .Values.enabled .Values.vmagent.enabled }}
- [x] Uses kubernetes_sd_configs for pod discovery
- [x] Relabeling filters to prometheus.io/scrape=true pods
- [x] Scrape interval templated from values
- [x] Remote write URL points to VictoriaMetrics service
- [x] Labels follow project conventions

```
[x] T5 Complete
```

---

### T6: Create RBAC templates

**Estimate:** 30 minutes
**Depends on:** T2
**User Story:** US-2

Create ServiceAccount, ClusterRole, and ClusterRoleBinding for vmagent.

**Files to create:**
- `helm/dox-asdlc/charts/victoriametrics/templates/serviceaccount.yaml`
- `helm/dox-asdlc/charts/victoriametrics/templates/clusterrole.yaml`
- `helm/dox-asdlc/charts/victoriametrics/templates/clusterrolebinding.yaml`

**Acceptance criteria:**
- [x] ServiceAccount created for vmagent
- [x] Conditional on {{ if and .Values.enabled .Values.vmagent.enabled }}
- [x] ClusterRole has read access to pods, services, endpoints
- [x] ClusterRole has read access to nodes (for node labels)
- [x] ClusterRoleBinding binds role to ServiceAccount
- [x] Names follow project conventions

```
[x] T6 Complete
```

---

### T7: Create DaemonSet template for vmagent

**Estimate:** 45 minutes
**Depends on:** T5, T6
**User Story:** US-2

Create DaemonSet for vmagent scraping agent.

**Files to create:**
- `helm/dox-asdlc/charts/victoriametrics/templates/daemonset.yaml`

**Acceptance criteria:**
- [x] DaemonSet deploys to all nodes
- [x] Conditional on {{ if and .Values.enabled .Values.vmagent.enabled }}
- [x] Uses victoriametrics/vmagent image
- [x] Mounts ConfigMap with scrape config
- [x] Uses ServiceAccount with RBAC permissions
- [x] Configures remoteWrite to VictoriaMetrics service
- [x] Resources section templated from values
- [x] Includes liveness and readiness probes
- [x] Supports nodeSelector, tolerations

```
[x] T7 Complete
```

---

### T8: Update parent Chart.yaml

**Estimate:** 15 minutes
**Depends on:** T1
**User Story:** US-3

Add VictoriaMetrics as a dependency in the parent chart.

**Files to modify:**
- `helm/dox-asdlc/Chart.yaml`

**Acceptance criteria:**
- [x] victoriametrics added to dependencies list
- [x] version matches subchart version (0.1.0)
- [x] condition set to victoriametrics.enabled
- [x] repository set to file://charts/victoriametrics

```
[x] T8 Complete
```

---

### T9: Update parent values.yaml

**Estimate:** 20 minutes
**Depends on:** T1, T8
**User Story:** US-3

Add VictoriaMetrics configuration to parent values.

**Files to modify:**
- `helm/dox-asdlc/values.yaml`

**Acceptance criteria:**
- [x] victoriametrics section added with enabled: true
- [x] Server defaults: replicas, persistence, resources
- [x] vmagent defaults: enabled, resources
- [x] Scrape defaults: interval, timeout
- [x] sharedEnv updated with VICTORIAMETRICS_URL

```
[x] T9 Complete
```

---

### T10: Add docker-compose service

**Estimate:** 30 minutes
**Depends on:** None
**User Story:** US-4

Add VictoriaMetrics service to docker-compose.yml.

**Files to modify:**
- `docker/docker-compose.yml`

**Acceptance criteria:**
- [x] victoriametrics service added
- [x] Uses victoriametrics/victoria-metrics:v1.96.0 image
- [x] Port 8428 exposed
- [x] Storage path and retention configured via command
- [x] Health check on /health endpoint
- [x] Part of asdlc-network
- [x] Container name follows asdlc-* pattern
- [x] Hostname set for internal DNS

```
[x] T10 Complete
```

---

### T11: Add docker-compose volume

**Estimate:** 10 minutes
**Depends on:** T10
**User Story:** US-4

Add named volume for VictoriaMetrics data persistence.

**Files to modify:**
- `docker/docker-compose.yml`

**Acceptance criteria:**
- [x] victoriametrics-data volume defined
- [x] Volume name follows asdlc-* pattern
- [x] Volume mounted at /victoria-metrics-data

```
[x] T11 Complete
```

---

### T12: Template rendering tests

**Estimate:** 45 minutes
**Depends on:** T1-T9
**User Story:** US-3

Verify Helm templates render correctly.

**Test commands:**
```bash
cd helm/dox-asdlc
helm dependency update
helm template . --debug
helm template . --set victoriametrics.enabled=false
helm template . --set victoriametrics.vmagent.enabled=false
helm template . --set victoriametrics.persistence.size=50Gi
```

**Acceptance criteria:**
- [x] helm template succeeds without errors
- [x] Disabling victoriametrics removes all resources
- [x] Disabling vmagent removes DaemonSet and RBAC only
- [x] Custom values are reflected in rendered output
- [x] No duplicate resource names

```
[x] T12 Complete
```

---

### T13: Integration smoke test

**Estimate:** 30 minutes
**Depends on:** T10, T11
**User Story:** US-4

Verify VictoriaMetrics works in docker-compose.

**Test commands:**
```bash
cd docker
docker-compose up -d victoriametrics
sleep 10
curl http://localhost:8428/health
curl -d 'test_metric{label="value"} 42' http://localhost:8428/api/v1/import/prometheus
curl 'http://localhost:8428/api/v1/query?query=test_metric'
docker-compose down
docker-compose up -d victoriametrics
curl 'http://localhost:8428/api/v1/query?query=test_metric'
```

**Acceptance criteria:**
- [x] Container starts and becomes healthy
- [x] Health endpoint returns 200
- [x] Write metric via Prometheus import succeeds
- [x] Query returns written metric
- [x] Data persists after restart

```
[x] T13 Complete
```

---

## Progress Tracking

### Completion Status

```
Tasks Complete: 13 / 13
Progress: 100%
```

### Dependency Graph

```
T1 (Chart.yaml, values.yaml)
  |
  +---> T2 (_helpers.tpl)
  |       |
  |       +---> T3 (StatefulSet)
  |       |
  |       +---> T4 (Service)
  |       |
  |       +---> T5 (ConfigMap)
  |       |       |
  |       |       +---> T7 (DaemonSet)
  |       |
  |       +---> T6 (RBAC)
  |               |
  |               +---> T7 (DaemonSet)
  |
  +---> T8 (parent Chart.yaml)
  |
  +---> T9 (parent values.yaml)
          |
          +---> T12 (template tests)

T10 (docker-compose service)
  |
  +---> T11 (docker-compose volume)
          |
          +---> T13 (integration test)
```

### Parallel Execution

The following tasks can be executed in parallel:

**Parallel Group 1:**
- T1 (Chart metadata) - can start immediately
- T10 (docker-compose service) - can start immediately

**Parallel Group 2:** (after T1)
- T2 (_helpers.tpl)
- T8 (parent Chart.yaml)

**Parallel Group 3:** (after T2)
- T3 (StatefulSet)
- T4 (Service)
- T5 (ConfigMap)
- T6 (RBAC)

**Parallel Group 4:** (after T5, T6)
- T7 (DaemonSet)
- T9 (parent values.yaml)

**Sequential Tasks:**
- T11 requires T10
- T12 requires T1-T9
- T13 requires T10-T11

---

## Notes

- All Helm templates should follow existing patterns in elasticsearch and redis subcharts
- Use consistent indentation (2 spaces) in YAML files
- Test with both Minikube and docker-compose
- RBAC permissions should be minimal (read-only for discovery)
- vmagent can be disabled independently for environments that push directly
