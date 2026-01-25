# P06-F06: VictoriaMetrics Infrastructure

**Version:** 1.0
**Date:** January 25, 2026
**Status:** Draft

## Overview

This feature adds VictoriaMetrics as a time series database (TSDB) for monitoring aSDLC microservices. VictoriaMetrics is Prometheus-compatible, single-binary, and highly efficient for metrics collection and querying.

### Goals

1. Deploy VictoriaMetrics as a StatefulSet with persistent storage for metrics retention
2. Deploy vmagent as a DaemonSet to scrape /metrics endpoints from all aSDLC pods
3. Create a Helm subchart following existing patterns (redis, elasticsearch)
4. Add VictoriaMetrics to docker-compose.yml for local development
5. Expose metrics API on port 8428 for downstream consumers (P05-F10 dashboard, P02-F07 instrumentation)

### Non-Goals

- Backend instrumentation (covered by P02-F07)
- Metrics dashboards in HITL-UI (covered by P05-F10)
- Alerting configuration (future feature)
- High-availability clustering (out of scope for prototype)

## Technical Approach

### Architecture

```
                                  +-------------------+
                                  | VictoriaMetrics   |
                                  | StatefulSet       |
                                  | (port 8428)       |
                                  +--------^----------+
                                           |
                        +------------------+------------------+
                        |                  |                  |
               +--------+------+  +--------+------+  +--------+------+
               | vmagent Pod   |  | vmagent Pod   |  | vmagent Pod   |
               | (DaemonSet)   |  | (DaemonSet)   |  | (DaemonSet)   |
               +--------^------+  +--------^------+  +--------^------+
                        |                  |                  |
               +--------+------+  +--------+------+  +--------+------+
               | orchestrator  |  | workers       |  | hitl-ui       |
               | /metrics      |  | /metrics      |  | /metrics      |
               +---------------+  +---------------+  +---------------+
```

### Component Details

#### VictoriaMetrics Server (StatefulSet)

- **Image:** victoriametrics/victoria-metrics:v1.96.0
- **Deployment:** StatefulSet with 1 replica (single-node mode)
- **Storage:** PVC with configurable size (default 10Gi)
- **Ports:**
  - 8428: HTTP API (query, write, health)
- **Health endpoint:** /health
- **Query endpoint:** /api/v1/query (PromQL-compatible)
- **Write endpoint:** /api/v1/write (Prometheus remote write)

#### vmagent (DaemonSet)

- **Image:** victoriametrics/vmagent:v1.96.0
- **Deployment:** DaemonSet (one pod per node)
- **Purpose:** Lightweight scraping agent
- **Targets:** Auto-discovery via Kubernetes service endpoints
- **Remote write:** Pushes scraped metrics to VictoriaMetrics server

### Helm Chart Structure

```
helm/dox-asdlc/charts/victoriametrics/
  Chart.yaml           # Chart metadata
  values.yaml          # Default configuration
  templates/
    _helpers.tpl       # Template helper functions
    statefulset.yaml   # VictoriaMetrics server
    daemonset.yaml     # vmagent DaemonSet
    service.yaml       # ClusterIP service for server
    configmap.yaml     # Scrape configuration
    serviceaccount.yaml    # RBAC for service discovery
    clusterrole.yaml       # Read pods/services/endpoints
    clusterrolebinding.yaml
```

### Configuration Values

```yaml
# values.yaml key sections
victoriametrics:
  enabled: true

  # Server configuration
  server:
    image:
      repository: victoriametrics/victoria-metrics
      tag: "v1.96.0"
    replicas: 1
    persistence:
      enabled: true
      size: 10Gi
    retention: "30d"
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "512Mi"
        cpu: "500m"

  # vmagent configuration
  vmagent:
    enabled: true
    image:
      repository: victoriametrics/vmagent
      tag: "v1.96.0"
    resources:
      requests:
        memory: "64Mi"
        cpu: "50m"
      limits:
        memory: "128Mi"
        cpu: "100m"

  # Scrape configuration
  scrape:
    interval: "15s"
    timeout: "10s"
```

### Docker Compose Integration

Add to `docker/docker-compose.yml`:

```yaml
victoriametrics:
  image: victoriametrics/victoria-metrics:v1.96.0
  container_name: asdlc-victoriametrics
  hostname: victoriametrics
  ports:
    - "8428:8428"
  command:
    - -storageDataPath=/victoria-metrics-data
    - -retentionPeriod=30d
  volumes:
    - victoriametrics-data:/victoria-metrics-data
  healthcheck:
    test: ["CMD", "wget", "-q", "--spider", "http://localhost:8428/health"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 10s
  networks:
    - asdlc-network

volumes:
  victoriametrics-data:
    name: asdlc-victoriametrics-data
```

Note: For local development (docker-compose), vmagent is not needed. Services can push metrics directly to VictoriaMetrics using the remote write endpoint, or VictoriaMetrics can be configured to scrape directly.

## Interfaces and Dependencies

### Upstream Dependencies

| Dependency | Purpose | Required By |
|------------|---------|-------------|
| Kubernetes cluster | Deployment platform | Helm chart |
| Docker | Container runtime | docker-compose |
| Persistent storage | Data retention | StatefulSet PVC |

### Downstream Consumers

| Consumer | Feature | Interface |
|----------|---------|-----------|
| P02-F07 | Backend metrics instrumentation | Remote write endpoint |
| P05-F10 | Metrics dashboard | Query API |

### Service Endpoints

| Endpoint | Port | Protocol | Purpose |
|----------|------|----------|---------|
| /health | 8428 | HTTP | Health checks |
| /api/v1/query | 8428 | HTTP | PromQL queries |
| /api/v1/write | 8428 | HTTP | Prometheus remote write |
| /metrics | 8428 | HTTP | VictoriaMetrics self-metrics |

### Environment Variables

Services consuming VictoriaMetrics will use:

```
VICTORIAMETRICS_URL=http://victoriametrics:8428
METRICS_PUSH_ENABLED=true
METRICS_PUSH_INTERVAL=15s
```

## Architecture Decisions

### ADR-1: StatefulSet over Deployment

**Decision:** Use StatefulSet for VictoriaMetrics server.

**Rationale:**
- VictoriaMetrics stores time series data on disk
- Persistent volume must survive pod restarts
- StatefulSet provides stable pod identity and PVC binding
- Consistent with elasticsearch and redis patterns in this project

### ADR-2: DaemonSet for vmagent

**Decision:** Use DaemonSet for vmagent in Kubernetes.

**Rationale:**
- Ensures metrics scraping from all nodes
- Distributes scraping load across nodes
- Node-local collection reduces network overhead
- vmagent is lightweight (64Mi memory)

### ADR-3: Single-node mode for prototype

**Decision:** Deploy VictoriaMetrics in single-node mode.

**Rationale:**
- Matches elasticsearch and redis patterns (single replica)
- Sufficient for prototype/development
- Clustering adds complexity without prototype benefit
- Can be scaled later via values override

### ADR-4: Service name abstraction

**Decision:** Use service name "metrics-store" for VictoriaMetrics.

**Rationale:**
- Follows pattern from elasticsearch using "knowledge-store"
- Allows future backend substitution (e.g., Prometheus, Thanos)
- Consumers reference abstract service name

### ADR-5: vmagent not included in docker-compose

**Decision:** Omit vmagent from docker-compose.yml.

**Rationale:**
- docker-compose runs all services on single host
- VictoriaMetrics can scrape directly without vmagent
- Simpler local development experience
- vmagent adds value only in distributed (K8s) environment

## File Structure

### New Files

```
helm/dox-asdlc/charts/victoriametrics/
  Chart.yaml
  values.yaml
  templates/
    _helpers.tpl
    statefulset.yaml
    daemonset.yaml
    service.yaml
    configmap.yaml
    serviceaccount.yaml
    clusterrole.yaml
    clusterrolebinding.yaml
```

### Modified Files

```
docker/docker-compose.yml           # Add victoriametrics service
helm/dox-asdlc/Chart.yaml          # Add victoriametrics dependency
helm/dox-asdlc/values.yaml         # Add victoriametrics configuration
```

## Security Considerations

- VictoriaMetrics runs without authentication in prototype mode
- RBAC for vmagent is scoped to read-only pod/service discovery
- Service is ClusterIP (not externally exposed)
- Production deployments should enable authentication via proxy or VictoriaMetrics Enterprise

## Testing Strategy

### Unit Tests (Helm)
- Template rendering for all resource types
- Conditional logic (enabled/disabled)
- Value overrides applied correctly

### Integration Tests
- Pod starts and becomes healthy
- Service resolves to correct endpoints
- vmagent can scrape targets
- Query API returns valid responses

### Smoke Tests
- Write test metric via remote write
- Query test metric via PromQL
- Verify metric persists across pod restart

## Rollout Plan

1. Create Helm subchart with all templates
2. Add to parent Chart.yaml dependencies
3. Add default values to parent values.yaml
4. Add victoriametrics service to docker-compose.yml
5. Update shared environment variables for downstream consumers
6. Document configuration options
