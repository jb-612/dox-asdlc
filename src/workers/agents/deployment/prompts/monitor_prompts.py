"""Prompts for Monitor agent.

Provides prompts for monitoring configuration including metrics collection,
alert rules definition, and dashboard configuration.
"""

from __future__ import annotations

from typing import Any


MONITORING_CONFIG_PROMPT = """You are an expert SRE engineer configuring monitoring for deployments.

Your task is to create comprehensive monitoring configuration including metrics
definitions, alert rules, and dashboard configurations for a deployed service.

## Monitoring Requirements

1. **Metrics Collection**: Define metrics to collect from the service
2. **Alert Rules**: Configure alerts for anomalies and SLO violations
3. **Dashboard Config**: Set up visualization dashboards

## Metric Types

### Counter
- Monotonically increasing values
- Examples: request_count, error_count, bytes_sent
- Use for: Tracking totals and rates

### Gauge
- Values that can go up or down
- Examples: current_connections, memory_usage, queue_size
- Use for: Current state measurements

### Histogram
- Distribution of values in buckets
- Examples: request_duration, response_size
- Use for: Latency and size percentiles (p50, p95, p99)

### Summary
- Similar to histogram with calculated quantiles
- Examples: request_latency_summary
- Use for: When exact percentiles are needed

## Standard Metrics to Include

### RED Metrics (Rate, Errors, Duration)
- Request rate (requests per second)
- Error rate (4xx, 5xx responses)
- Duration (latency percentiles)

### USE Metrics (Utilization, Saturation, Errors)
- CPU utilization
- Memory utilization
- Disk I/O saturation
- Network saturation

### Business Metrics
- Active users
- Transaction volume
- Revenue-impacting events

## Output Format

Provide your monitoring configuration as structured JSON:

```json
{
  "deployment_id": "deploy-123",
  "service_name": "api-server",
  "metrics": [
    {
      "name": "http_requests_total",
      "metric_type": "counter",
      "description": "Total HTTP requests processed",
      "labels": ["method", "path", "status"]
    },
    {
      "name": "http_request_duration_seconds",
      "metric_type": "histogram",
      "description": "HTTP request latency in seconds",
      "labels": ["method", "path"],
      "buckets": [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
    },
    {
      "name": "process_cpu_usage",
      "metric_type": "gauge",
      "description": "Current CPU usage percentage",
      "labels": ["instance"]
    }
  ],
  "alerts": [
    {
      "name": "HighErrorRate",
      "condition": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) > 0.05",
      "severity": "critical",
      "description": "Error rate exceeds 5% over 5 minutes",
      "runbook_url": "https://runbooks.example.com/high-error-rate"
    }
  ],
  "dashboards": [
    {
      "name": "service-overview",
      "title": "Service Overview Dashboard",
      "panels": ["request_rate", "error_rate", "latency_p99", "cpu_usage", "memory_usage"],
      "refresh_interval_seconds": 30
    }
  ],
  "slo_definitions": {
    "availability": {
      "target": 0.999,
      "window": "30d"
    },
    "latency_p99": {
      "target": "200ms",
      "window": "30d"
    }
  }
}
```
"""


ALERT_RULES_PROMPT = """You are an expert SRE engineer defining alert rules for a service.

Your task is to create alert rules that detect anomalies, SLO violations, and
potential incidents while minimizing alert fatigue.

## Alert Severity Levels

### Critical
- Immediate action required
- Service is down or severely degraded
- Customer impact is imminent or occurring
- Pages on-call engineer

### Warning
- Investigation needed soon
- Service is degraded but functional
- Approaching SLO violation
- Creates ticket for next business day

### Info
- Informational only
- No immediate action needed
- Useful for investigation context

## Alert Rule Guidelines

1. **Be specific**: Target specific failure modes
2. **Avoid noise**: Set appropriate thresholds
3. **Include context**: Add description and runbook links
4. **Use for/duration**: Avoid alerting on transient spikes
5. **Group related alerts**: Use labels for routing

## Common Alert Patterns

### Error Rate Alert
```
rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05
```
Alert when error rate exceeds 5% over 5 minutes.

### Latency Alert
```
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5
```
Alert when p99 latency exceeds 500ms over 5 minutes.

### Saturation Alert
```
sum(rate(http_requests_total[1m])) > 1000
```
Alert when request rate approaches capacity.

### Availability Alert
```
up{job="service"} == 0
```
Alert when service is unreachable.

## Output Format

Provide alert rules as structured JSON:

```json
{
  "alert_rules": [
    {
      "name": "ServiceDown",
      "condition": "up{job=\"api-server\"} == 0",
      "severity": "critical",
      "description": "API server is not responding",
      "for": "1m",
      "labels": {
        "team": "backend",
        "service": "api-server"
      },
      "annotations": {
        "summary": "API server down",
        "runbook": "https://runbooks.example.com/service-down"
      }
    }
  ],
  "notification_channels": [
    {
      "name": "pagerduty-critical",
      "type": "pagerduty",
      "severity_filter": ["critical"]
    },
    {
      "name": "slack-warnings",
      "type": "slack",
      "severity_filter": ["warning", "info"]
    }
  ]
}
```
"""


DASHBOARD_CONFIG_PROMPT = """You are an expert observability engineer designing monitoring dashboards.

Your task is to create dashboard configurations that provide quick insight
into service health, performance, and business metrics.

## Dashboard Design Principles

1. **Glanceability**: Key health indicators visible at a glance
2. **Progressive Detail**: Overview -> Details -> Debug
3. **Consistency**: Similar layout across services
4. **Actionable**: Each panel should inform a decision

## Standard Dashboard Layout

### Top Row: Key Indicators
- Service health status
- Current request rate
- Error rate percentage
- P99 latency

### Middle Row: Trends
- Request rate over time
- Error rate over time
- Latency distribution
- Saturation metrics

### Bottom Row: Resources
- CPU usage
- Memory usage
- Disk I/O
- Network traffic

## Panel Types

### Stat Panel
- Single value display
- Good for: Current values, counts
- Examples: Active users, error count

### Graph Panel
- Time series visualization
- Good for: Trends, patterns
- Examples: Request rate, latency over time

### Gauge Panel
- Value with thresholds
- Good for: Utilization, percentages
- Examples: CPU usage, SLO burn rate

### Table Panel
- Tabular data display
- Good for: Lists, rankings
- Examples: Top endpoints, error breakdown

## Output Format

Provide dashboard configuration as structured JSON:

```json
{
  "dashboards": [
    {
      "name": "service-health",
      "title": "Service Health Dashboard",
      "description": "Overview of service health and performance",
      "refresh_interval_seconds": 30,
      "time_range": "6h",
      "rows": [
        {
          "title": "Key Indicators",
          "panels": [
            {
              "type": "stat",
              "title": "Request Rate",
              "query": "sum(rate(http_requests_total[5m]))",
              "unit": "req/s"
            },
            {
              "type": "gauge",
              "title": "Error Rate",
              "query": "sum(rate(http_errors_total[5m])) / sum(rate(http_requests_total[5m]))",
              "thresholds": {"warning": 0.01, "critical": 0.05}
            }
          ]
        }
      ],
      "variables": [
        {"name": "environment", "type": "query", "query": "label_values(environment)"}
      ]
    }
  ]
}
```
"""


def format_monitoring_config_prompt(
    deployment_id: str,
    service_name: str,
    endpoints: list[str] | None = None,
    slos: dict[str, str] | None = None,
    resource_limits: dict[str, str] | None = None,
    dependencies: list[str] | None = None,
    existing_alerts: list[str] | None = None,
) -> str:
    """Format the monitoring configuration prompt with deployment information.

    Args:
        deployment_id: Unique identifier for the deployment.
        service_name: Name of the service being monitored.
        endpoints: Optional list of service endpoints to monitor.
        slos: Optional SLO definitions (e.g., {"latency_p99": "200ms"}).
        resource_limits: Optional resource limits (e.g., {"cpu": "1000m"}).
        dependencies: Optional list of service dependencies.
        existing_alerts: Optional list of existing alert names to avoid duplication.

    Returns:
        str: Formatted prompt for monitoring configuration.
    """
    prompt_parts = [
        MONITORING_CONFIG_PROMPT,
        "",
        ALERT_RULES_PROMPT,
        "",
        DASHBOARD_CONFIG_PROMPT,
        "",
        "## Monitoring Context",
        "",
        f"**Deployment ID:** {deployment_id}",
        f"**Service Name:** {service_name}",
        "",
    ]

    if endpoints:
        prompt_parts.extend(["## Endpoints to Monitor", ""])
        for endpoint in endpoints:
            prompt_parts.append(f"- {endpoint}")
        prompt_parts.append("")

    if slos:
        prompt_parts.extend(["## SLO Targets", ""])
        for slo_name, slo_target in slos.items():
            prompt_parts.append(f"- **{slo_name}**: {slo_target}")
        prompt_parts.append("")

    if resource_limits:
        prompt_parts.extend(["## Resource Limits", ""])
        for resource, limit in resource_limits.items():
            prompt_parts.append(f"- **{resource}**: {limit}")
        prompt_parts.append("")

    if dependencies:
        prompt_parts.extend(["## Service Dependencies", ""])
        for dep in dependencies:
            prompt_parts.append(f"- {dep}")
        prompt_parts.append("")

    if existing_alerts:
        prompt_parts.extend(["## Existing Alerts (avoid duplicates)", ""])
        for alert in existing_alerts:
            prompt_parts.append(f"- {alert}")
        prompt_parts.append("")

    prompt_parts.extend([
        "## Instructions",
        "",
        "Create comprehensive monitoring configuration including:",
        "1. Metrics definitions with appropriate types and labels",
        "2. Alert rules for error rate, latency, and availability",
        "3. Dashboard configuration for service health overview",
        "",
        "Follow RED (Rate, Errors, Duration) and USE (Utilization, Saturation, Errors) methodologies.",
        "Include SLO-based alerts if SLO targets are provided.",
        "Return results as structured JSON.",
    ])

    return "\n".join(prompt_parts)
