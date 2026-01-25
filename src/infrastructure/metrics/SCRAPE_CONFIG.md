# Prometheus/VictoriaMetrics Scrape Configuration

This document describes how to configure metric scraping for aSDLC services.

## Overview

aSDLC services expose Prometheus-compatible `/metrics` endpoints:

| Service | Port | Endpoint |
|---------|------|----------|
| Orchestrator | 8080 | `http://orchestrator:8080/metrics` |
| Workers | 8081 | `http://workers:8081/metrics` |

## Docker Compose Configuration

For docker-compose deployments, configure vmagent with static targets:

```yaml
# vmagent/prometheus.yml or similar
scrape_configs:
  - job_name: "asdlc-orchestrator"
    static_configs:
      - targets: ["orchestrator:8080"]
    metrics_path: /metrics
    scrape_interval: 15s
    scrape_timeout: 10s

  - job_name: "asdlc-workers"
    static_configs:
      - targets: ["workers:8081"]
    metrics_path: /metrics
    scrape_interval: 15s
    scrape_timeout: 10s
```

### Recommended Scrape Settings

| Setting | Value | Reason |
|---------|-------|--------|
| `scrape_interval` | 15s | Balance between resolution and overhead |
| `scrape_timeout` | 10s | Allow time for slow collectors |
| `metrics_path` | /metrics | Standard Prometheus path |

## Kubernetes Configuration

For Kubernetes deployments, use service discovery with pod annotations.

### Pod Annotations

Add these annotations to your Pod spec:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"  # or 8081 for workers
    prometheus.io/path: "/metrics"
```

### vmagent Kubernetes Service Discovery

```yaml
scrape_configs:
  - job_name: "asdlc-services"
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ["dox-asdlc"]

    relabel_configs:
      # Only scrape pods with prometheus.io/scrape annotation
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true

      # Use prometheus.io/path annotation for metrics path
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)

      # Use prometheus.io/port annotation for port
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__

      # Add pod name as label
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: pod

      # Add namespace as label
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: namespace
```

## Job Naming Convention

Use the `asdlc-` prefix for all aSDLC-related scrape jobs:

- `asdlc-orchestrator` - Orchestrator service metrics
- `asdlc-workers` - Workers service metrics
- `asdlc-hitl-ui` - HITL UI service metrics (if applicable)

This allows filtering by job in PromQL:

```promql
# All aSDLC metrics
{job=~"asdlc-.*"}

# Only orchestrator metrics
{job="asdlc-orchestrator"}
```

## Metrics Exposed

### Service Info

```
asdlc_service_info{service="orchestrator",version="0.1.0"} 1
```

### HTTP Request Metrics

```
# Counter: total requests
asdlc_http_requests_total{service="orchestrator",method="GET",endpoint="/health",status="200"} 42

# Histogram: request duration
asdlc_http_request_duration_seconds_bucket{service="orchestrator",method="GET",endpoint="/health",le="0.1"} 40
asdlc_http_request_duration_seconds_sum{service="orchestrator",method="GET",endpoint="/health"} 1.234
asdlc_http_request_duration_seconds_count{service="orchestrator",method="GET",endpoint="/health"} 42
```

### Worker Pool Metrics (workers only)

```
asdlc_active_workers{service="workers"} 4
asdlc_events_processed_total{service="workers",status="success"} 100
asdlc_events_processed_total{service="workers",status="failed"} 2
```

### Redis Connection Metrics

```
asdlc_redis_connection_up{service="orchestrator"} 1
```

### Process Metrics

```
asdlc_process_memory_bytes{service="orchestrator",type="rss"} 52428800
asdlc_process_memory_bytes{service="orchestrator",type="vms"} 104857600
```

## VictoriaMetrics URL

Configure the `VICTORIAMETRICS_URL` environment variable for the orchestrator to enable the metrics proxy API:

```bash
# Docker Compose
VICTORIAMETRICS_URL=http://victoriametrics:8428

# Kubernetes
VICTORIAMETRICS_URL=http://victoriametrics.monitoring.svc.cluster.local:8428
```

## Troubleshooting

### Check if metrics are being scraped

```bash
# Query VictoriaMetrics for recent scrapes
curl "http://localhost:8428/api/v1/query?query=up{job=~'asdlc-.*'}"
```

### Verify metrics endpoint is accessible

```bash
# Test orchestrator metrics
curl http://localhost:8080/metrics

# Test workers metrics
curl http://localhost:8081/metrics
```

### Check for scrape errors

Look for `scrape_samples_post_metric_relabeling` and `scrape_duration_seconds` metrics in VictoriaMetrics to identify scrape issues.
