# P06-F08: MCP Sidecars for Redis and Elasticsearch

## Overview

Add Model Context Protocol (MCP) sidecars to Redis and Elasticsearch StatefulSets in Helm charts, enabling Claude CLI tools to interact directly with these services via MCP protocol. Additionally, add Prometheus scrape annotations to backend application services for VictoriaMetrics metrics collection.

## Goals

1. Build lightweight MCP server Docker images for Redis and Elasticsearch
2. Enable Claude CLI tools to interact with Redis via MCP sidecar on port 9000
3. Enable Claude CLI tools to interact with Elasticsearch via MCP sidecar on port 9000
4. Ensure backend application services expose metrics for VictoriaMetrics scraping
5. Maintain backward compatibility with existing deployments

## Architecture

```
+-----------------------------------------------------------------------+
|                    K8s Cluster (dox-asdlc namespace)                   |
+-----------------------------------------------------------------------+
|                                                                        |
|  DEPLOYMENTS (with Prometheus annotations)                             |
|  +---------------+ +---------------+                                   |
|  | orchestrator  | |   workers     |                                   |
|  |   :8080       | |   :8081       |                                   |
|  | annotations:  | | annotations:  |                                   |
|  |  prometheus.  | |  prometheus.  |                                   |
|  |  io/scrape:   | |  io/scrape:   |                                   |
|  |  "true"       | |  "true"       |                                   |
|  +---------------+ +---------------+                                   |
|         |                 |                                            |
|         +--------+--------+                                            |
|                  |                                                     |
|                  v                                                     |
|  +-----------------------------------------------+                     |
|  |        vmagent (scrapes annotations)          |                     |
|  +-----------------------------------------------+                     |
|                                                                        |
|  STATEFULSETS (with MCP sidecars)                                      |
|  +---------------------------+   +---------------------------+         |
|  |         redis-0           |   |     elasticsearch-0       |         |
|  | +-------+ +-------------+ |   | +-------+ +-------------+ |         |
|  | | redis | | mcp-redis   | |   | | es    | | mcp-elastic | |         |
|  | | :6379 | | sidecar     | |   | | :9200 | | sidecar     | |         |
|  | |       | | :9000       | |   | | :9300 | | :9000       | |         |
|  | +---+---+ +------+------+ |   | +---+---+ +------+------+ |         |
|  |     |            |        |   |     |            |        |         |
|  |     +-----+------+        |   |     +-----+------+        |         |
|  |           | localhost     |   |           | localhost     |         |
|  +---------------------------+   +---------------------------+         |
|           |                               |                            |
|           v                               v                            |
|  +----------------+              +----------------+                     |
|  | redis Service  |              | knowledge-store|                     |
|  | :6379 (redis)  |              | Service        |                     |
|  | :9000 (mcp)    |              | :9200 (http)   |                     |
|  +----------------+              | :9000 (mcp)    |                     |
|                                  +----------------+                     |
+-----------------------------------------------------------------------+
```

## MCP Server Docker Images

This feature includes building lightweight Python-based MCP server Docker images. These images provide MCP protocol access to Redis and Elasticsearch.

### docker/mcp-redis

| Aspect | Details |
|--------|---------|
| Base image | `python:3.11-slim` |
| Dependencies | `redis`, `mcp` Python packages |
| Port | 9000 |
| Health endpoint | `/health` (HTTP GET) |
| Size target | < 150MB |

The MCP Redis server:
- Connects to Redis via `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` environment variables
- Exposes MCP protocol on port 9000
- Provides health check at `/health`
- Runs as non-root user (UID 1000)

### docker/mcp-elasticsearch

| Aspect | Details |
|--------|---------|
| Base image | `python:3.11-slim` |
| Dependencies | `elasticsearch`, `mcp` Python packages |
| Port | 9000 |
| Health endpoint | `/health` (HTTP GET) |
| Size target | < 150MB |

The MCP Elasticsearch server:
- Connects to Elasticsearch via `ES_HOST`, `ES_PORT` environment variables
- Exposes MCP protocol on port 9000
- Provides health check at `/health`
- Runs as non-root user (UID 1000)

## Technical Approach

### 1. MCP Sidecar Pattern

MCP sidecars run alongside the main container in the same pod, communicating via localhost:

```yaml
# Pod spec pattern
containers:
  - name: main-container
    # ... main container config
  - name: mcp-sidecar
    image: mcp/<service>:latest
    ports:
      - name: mcp
        containerPort: 9000
    env:
      - name: BACKEND_HOST
        value: "localhost"
      - name: BACKEND_PORT
        value: "<service-port>"
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
    readinessProbe:
      tcpSocket:
        port: 9000
      initialDelaySeconds: 5
      periodSeconds: 10
    livenessProbe:
      tcpSocket:
        port: 9000
      initialDelaySeconds: 15
      periodSeconds: 20
```

### 2. Redis MCP Sidecar

| Aspect | Value |
|--------|-------|
| Image | `mcp/redis:latest` |
| Port | 9000 |
| Backend connection | `localhost:6379` |
| Authentication | Uses same Redis password from existing secret |
| Environment variables | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |

The sidecar connects to Redis on localhost (same pod) and exposes MCP protocol on port 9000.

### 3. Elasticsearch MCP Sidecar

| Aspect | Value |
|--------|-------|
| Image | `mcp/elasticsearch:latest` |
| Port | 9000 |
| Backend connection | `localhost:9200` |
| Authentication | None (ES security disabled for dev) |
| Environment variables | `ES_HOST`, `ES_PORT` |

The sidecar connects to Elasticsearch on localhost (same pod) and exposes MCP protocol on port 9000.

### 4. Prometheus Annotations Pattern

Services are discovered by vmagent via pod annotations:

```yaml
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "<metrics-port>"
  prometheus.io/path: "/metrics"
```

This pattern is already configured in the VictoriaMetrics scrape config (vmagent ConfigMap).

**Note:** HITL-UI (React SPA) does not expose Prometheus metrics. Metrics are served by backend services (orchestrator, workers).

## Failure Handling

MCP sidecars are designed as "nice to have" components. Their failure should NOT affect the main service functionality.

### Sidecar Failure Isolation

| Scenario | Behavior |
|----------|----------|
| MCP sidecar fails to start | Main container starts normally; pod may show 1/2 Ready |
| MCP sidecar crashes | Main container continues running; sidecar restarts via liveness probe |
| MCP sidecar health check fails | Sidecar marked not ready; main container unaffected |
| Main container fails | Entire pod restarts (expected behavior) |

### Implementation Strategy

1. **Separate readiness conditions:** MCP sidecar has its own readiness/liveness probes independent of main container
2. **No shared lifecycle:** Sidecar does not use `shareProcessNamespace` or depend on main container lifecycle
3. **Graceful degradation:** Claude CLI tools should handle MCP unavailability gracefully
4. **Cluster functions without MCP:** All core Redis and Elasticsearch functionality works if sidecars are disabled or failing

### Liveness vs Readiness

| Probe Type | Purpose | Action on Failure |
|------------|---------|-------------------|
| Readiness | Exclude from service endpoints | Traffic not routed to MCP port |
| Liveness | Detect hung processes | Container restart |

Both probes use TCP socket check on port 9000 as a safe, minimal health verification.

## Security Context

All MCP sidecar containers run with restricted security context to follow Kubernetes security best practices.

### Container Security Context

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
```

### Security Rationale

| Setting | Purpose |
|---------|---------|
| `runAsNonRoot: true` | Prevents running as root user |
| `runAsUser: 1000` | Runs as unprivileged user |
| `readOnlyRootFilesystem: true` | Prevents filesystem modifications |
| `allowPrivilegeEscalation: false` | Prevents privilege escalation attacks |

### Docker Image Requirements

MCP Docker images must:
1. Create a non-root user (UID 1000) during build
2. Set appropriate file permissions for the application
3. Use `/tmp` or other writable volumes if temporary files are needed
4. Not require root for any operations

## Interfaces

### Values Schema for MCP Sidecar

```yaml
# Added to redis/values.yaml and elasticsearch/values.yaml
mcpSidecar:
  enabled: false
  image:
    repository: mcp/redis  # or mcp/elasticsearch
    tag: latest
    pullPolicy: IfNotPresent
  port: 9000
  resources:
    requests:
      memory: "64Mi"
      cpu: "50m"
    limits:
      memory: "128Mi"
      cpu: "100m"
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    readOnlyRootFilesystem: true
    allowPrivilegeEscalation: false
```

### Values Schema for Prometheus Annotations

```yaml
# Added to orchestrator/workers values.yaml
prometheus:
  enabled: true
  port: 8080  # or 8081 depending on service
  path: /metrics
```

### Service Port Addition

```yaml
# Added to redis/service.yaml and elasticsearch/service.yaml
ports:
  - port: 9000
    targetPort: mcp
    protocol: TCP
    name: mcp
```

## Dependencies

### External Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| `python:3.11-slim` | Base image for MCP servers | Available on Docker Hub |
| `redis` Python package | Redis client for MCP server | Available on PyPI |
| `elasticsearch` Python package | ES client for MCP server | Available on PyPI |
| `mcp` Python package | MCP protocol implementation | Available on PyPI |

### Internal Dependencies

| Dependency | Purpose |
|------------|---------|
| Redis StatefulSet | Host for Redis MCP sidecar |
| Elasticsearch StatefulSet | Host for Elasticsearch MCP sidecar |
| VictoriaMetrics vmagent | Scrapes Prometheus annotations |
| Existing secrets | Redis password for sidecar auth |

## Files to Modify

### New Docker Images (Phase 0)

| File | Purpose |
|------|---------|
| `docker/mcp-redis/Dockerfile` | MCP Redis server container |
| `docker/mcp-redis/server.py` | Minimal MCP Redis server implementation |
| `docker/mcp-redis/requirements.txt` | Python dependencies |
| `docker/mcp-elasticsearch/Dockerfile` | MCP Elasticsearch server container |
| `docker/mcp-elasticsearch/server.py` | Minimal MCP Elasticsearch server implementation |
| `docker/mcp-elasticsearch/requirements.txt` | Python dependencies |
| `scripts/build-images.sh` | Add MCP image builds |

### Redis Chart

| File | Changes |
|------|---------|
| `helm/dox-asdlc/charts/redis/values.yaml` | Add `mcpSidecar` configuration block |
| `helm/dox-asdlc/charts/redis/templates/statefulset.yaml` | Add sidecar container conditional |
| `helm/dox-asdlc/charts/redis/templates/service.yaml` | Add MCP port 9000 |

### Elasticsearch Chart

| File | Changes |
|------|---------|
| `helm/dox-asdlc/charts/elasticsearch/values.yaml` | Add `mcpSidecar` configuration block |
| `helm/dox-asdlc/charts/elasticsearch/templates/statefulset.yaml` | Add sidecar container conditional |
| `helm/dox-asdlc/charts/elasticsearch/templates/service.yaml` | Add MCP port 9000 |

### Application Charts (Prometheus annotations)

| File | Changes |
|------|---------|
| `helm/dox-asdlc/charts/orchestrator/values.yaml` | Add `prometheus` config block |
| `helm/dox-asdlc/charts/workers/values.yaml` | Add `prometheus` config block |

Note: HITL-UI excluded from Prometheus annotations (React SPA does not expose metrics).

### Parent Chart Values

| File | Changes |
|------|---------|
| `helm/dox-asdlc/values.yaml` | Enable MCP sidecars (disabled by default for production) |
| `helm/dox-asdlc/values-minikube.yaml` | Enable MCP sidecars for development |

## What Is NOT In Scope

| Item | Reason |
|------|--------|
| Custom Coordination MCP (`src/infrastructure/coordination/`) | Domain-specific, not replaced by generic MCP |
| Custom KnowledgeStore MCP (`src/infrastructure/knowledge_store/`) | Semantic search features beyond generic ES MCP |
| Redis 7.2 version change | Stable and working |
| Elasticsearch 8.11 version change | Already has kNN support |
| HITL-UI Prometheus metrics | React SPA does not expose Prometheus metrics |

## Testing Strategy

### Manual Verification Steps

1. **Build MCP Docker images:**
   ```bash
   ./scripts/build-images.sh --mcp
   ```

2. **Deploy to minikube:**
   ```bash
   ./scripts/k8s/quickstart.sh --reset
   ```

3. **Verify sidecars running:**
   ```bash
   kubectl get pods -n dox-asdlc
   # Redis and Elasticsearch pods should show 2/2 containers
   ```

4. **Test MCP connectivity:**
   ```bash
   # Port forward MCP port
   kubectl port-forward svc/redis 9000:9000 -n dox-asdlc

   # In another terminal, test MCP connection
   curl http://localhost:9000/health
   ```

5. **Verify Prometheus annotations working:**
   ```bash
   # Check vmagent targets
   kubectl port-forward svc/metrics-store 8428:8428 -n dox-asdlc
   curl "http://localhost:8428/api/v1/targets"
   ```

### Helm Template Validation

```bash
# Validate templates render correctly
helm template dox-asdlc ./helm/dox-asdlc -f ./helm/dox-asdlc/values-minikube.yaml

# Check specific subchart
helm template dox-asdlc ./helm/dox-asdlc --show-only charts/redis/templates/statefulset.yaml
```

## Rollback Plan

If issues occur:

1. Set `mcpSidecar.enabled: false` in values
2. Redeploy: `helm upgrade dox-asdlc ./helm/dox-asdlc -n dox-asdlc`
3. Sidecars will be removed, main containers unaffected

## Security Considerations

1. **Redis password:** Sidecar reads password from same secret as main Redis container
2. **Network access:** MCP port 9000 exposed on service, accessible within cluster only (ClusterIP)
3. **No external exposure:** MCP ports not exposed via NodePort or LoadBalancer
4. **Non-root execution:** All MCP sidecars run as non-root user (UID 1000)
5. **Read-only filesystem:** Sidecar containers use read-only root filesystem
6. **No privilege escalation:** Containers cannot escalate privileges
