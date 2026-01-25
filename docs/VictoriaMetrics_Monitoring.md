# VictoriaMetrics Monitoring Stack

**Version:** 1.0  
**Date:** January 25, 2026  
**Status:** Implemented  
**Work Items:** P06-F06, P02-F07, P05-F10

## Overview

The aSDLC platform includes a comprehensive monitoring stack built on VictoriaMetrics, providing real-time observability into system health, resource utilization, and request performance across all microservices.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HITL-UI (MetricsPage)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐  │
│  │ CPU Chart   │ │Memory Chart │ │Request Rate │ │Latency Chart  │  │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └───────┬───────┘  │
│         └───────────────┴───────────────┴────────────────┘          │
│                                  │                                   │
│                    ┌─────────────▼─────────────┐                    │
│                    │  Backend Selector Toggle  │                    │
│                    │   [Mock] [VictoriaMetrics]│                    │
│                    └─────────────┬─────────────┘                    │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   Backend Proxy Endpoints   │
                    │  /api/metrics/cpu           │
                    │  /api/metrics/memory        │
                    │  /api/metrics/requests      │
                    │  /api/metrics/latency       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      VictoriaMetrics        │
                    │       (StatefulSet)         │
                    │    victoriametrics:8428     │
                    └──────────────┬──────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
┌────────▼────────┐   ┌────────────▼────────────┐   ┌───────▼────────┐
│   vmagent       │   │       Orchestrator       │   │   Workers      │
│  (DaemonSet)    │   │    /metrics:8081         │   │ /metrics:8082  │
│ Scrapes targets │   │ asdlc_* metrics          │   │ asdlc_* metrics│
└─────────────────┘   └──────────────────────────┘   └────────────────┘
```

## Components

### 1. VictoriaMetrics Server (P06-F06)

**Deployment:** StatefulSet with PersistentVolumeClaim

| Property | Value |
|----------|-------|
| Image | `victoriametrics/victoria-metrics:v1.96.0` |
| Port | 8428 |
| Storage | 10Gi PVC |
| Retention | 30 days |
| Resources | 256Mi-512Mi memory, 100m-500m CPU |

**Configuration:**
```yaml
# docker/victoriametrics/victoria.yml
scrape_configs:
  - job_name: 'orchestrator'
    static_configs:
      - targets: ['orchestrator:8081']
  - job_name: 'workers'
    static_configs:
      - targets: ['worker-pool:8082']
```

### 2. vmagent (P06-F06)

Lightweight agent for scraping Prometheus-format metrics from services.

| Property | Value |
|----------|-------|
| Image | `victoriametrics/vmagent:v1.96.0` |
| Scrape Interval | 15s |
| Remote Write | `http://victoriametrics:8428/api/v1/write` |

### 3. Metrics Module (P02-F07)

Python module for exposing Prometheus-format metrics from backend services.

**Location:** `src/workers/metrics/`

**Exposed Metrics:**

| Metric | Type | Description |
|--------|------|-------------|
| `asdlc_process_cpu_seconds_total` | Counter | Total CPU time |
| `asdlc_process_memory_bytes` | Gauge | Current memory usage |
| `asdlc_http_requests_total` | Counter | Total HTTP requests |
| `asdlc_http_request_duration_seconds` | Histogram | Request latency (p50, p95, p99) |
| `asdlc_active_tasks` | Gauge | Currently active tasks |
| `asdlc_active_workers` | Gauge | Currently active workers |
| `asdlc_task_duration_seconds` | Histogram | Task execution duration |

**Endpoints:**
- Orchestrator: `http://orchestrator:8081/metrics`
- Workers: `http://worker-pool:8082/metrics`

### 4. Metrics Dashboard (P05-F10)

React-based dashboard in HITL-UI for visualizing metrics.

**Location:** `docker/hitl-ui/src/pages/MetricsPage.tsx`

**Features:**
- Service selector (filter by orchestrator, workers, all)
- Time range selector (15m, 1h, 6h, 24h, 7d)
- Auto-refresh toggle (30s interval)
- Backend selector (Mock / VictoriaMetrics)
- Health indicator (green/red/yellow dot)

**Charts:**
- CPU Usage (area chart)
- Memory Usage (area chart)
- Request Rate (line chart)
- Latency Percentiles (multi-line: p50, p95, p99)
- Active Tasks Gauge (radial gauge)

## API Endpoints

### Backend Proxy (P02-F07)

The backend exposes proxy endpoints that query VictoriaMetrics and transform results for the frontend.

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/metrics/health` | GET | - | Check VM connectivity |
| `/api/metrics/services` | GET | - | List monitored services |
| `/api/metrics/cpu` | GET | `service`, `range` | CPU time series |
| `/api/metrics/memory` | GET | `service`, `range` | Memory time series |
| `/api/metrics/requests` | GET | `service`, `range` | Request rate time series |
| `/api/metrics/latency` | GET | `service`, `range` | Latency percentiles |
| `/api/metrics/tasks` | GET | - | Current active tasks |

### PromQL Queries

The proxy translates API requests into PromQL queries:

```promql
# CPU Usage
rate(asdlc_process_cpu_seconds_total{service="orchestrator"}[5m]) * 100

# Memory Usage
asdlc_process_memory_bytes{service="orchestrator"}

# Request Rate
rate(asdlc_http_requests_total{service="orchestrator"}[5m])

# Latency Percentiles
histogram_quantile(0.50, rate(asdlc_http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(asdlc_http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(asdlc_http_request_duration_seconds_bucket[5m]))
```

## Frontend State Management

### Metrics Store

**Location:** `docker/hitl-ui/src/stores/metricsStore.ts`

```typescript
interface MetricsState {
  selectedService: string | null;  // Filter by service
  timeRange: TimeRange;            // '15m' | '1h' | '6h' | '24h' | '7d'
  selectedBackend: MetricsBackendMode;  // 'mock' | 'victoriametrics'
  autoRefresh: boolean;
  refreshInterval: number;  // 30000ms default
}
```

**Persistence:** Backend selection persisted to localStorage.

### React Query Integration

All metrics use TanStack Query for data fetching with:
- Automatic caching
- Background refetch
- Stale-while-revalidate
- Error boundary support

## Runtime Backend Switching

The Metrics Dashboard supports switching between Mock and VictoriaMetrics backends at runtime without restarting:

1. **Mock Mode:** Uses synthetic data generated in `api/mocks/metrics.ts`
2. **VictoriaMetrics Mode:** Queries real data via backend proxy

The selection is persisted in localStorage and restored on page load.

## Docker Compose Configuration

```yaml
# docker/docker-compose.yml
services:
  victoriametrics:
    image: victoriametrics/victoria-metrics:v1.96.0
    ports:
      - "8428:8428"
    volumes:
      - vm-data:/victoria-metrics-data
      - ./victoriametrics/victoria.yml:/etc/victoria.yml
    command:
      - -promscrape.config=/etc/victoria.yml
      - -retentionPeriod=30d

  vmagent:
    image: victoriametrics/vmagent:v1.96.0
    volumes:
      - ./victoriametrics/vmagent.yml:/etc/vmagent.yml
    command:
      - -promscrape.config=/etc/vmagent.yml
      - -remoteWrite.url=http://victoriametrics:8428/api/v1/write

volumes:
  vm-data:
```

## Kubernetes Deployment

For production, VictoriaMetrics is deployed as a StatefulSet:

```yaml
# helm/templates/victoriametrics-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: victoriametrics
spec:
  serviceName: victoriametrics
  replicas: 1
  volumeClaimTemplates:
    - metadata:
        name: vm-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

## Usage

### Accessing the Dashboard

1. Navigate to the HITL-UI: `http://localhost:5173`
2. Click "Metrics" in the navigation
3. Select backend mode (Mock for development, VictoriaMetrics for real data)
4. Filter by service and time range as needed

### Direct VictoriaMetrics Access

Query VictoriaMetrics directly via its UI:
```
http://localhost:8428/vmui
```

### Example PromQL Queries

```promql
# Total requests in last hour
increase(asdlc_http_requests_total[1h])

# Average task duration
avg(rate(asdlc_task_duration_seconds_sum[5m]) / rate(asdlc_task_duration_seconds_count[5m]))

# Memory usage by service
asdlc_process_memory_bytes by (service)
```

## Related Documentation

- [Architecture Diagram](diagrams/14-victoriametrics-monitoring.mmd)
- [SPA Information Architecture](SPA_Information_Architecture.md)
- [Container Topology](asdlc_container_topology.md)

## Work Item References

| Work Item | Description |
|-----------|-------------|
| P06-F06 | VictoriaMetrics Infrastructure |
| P02-F07 | Backend Metrics Collection Module |
| P05-F10 | Metrics Dashboard UI |
