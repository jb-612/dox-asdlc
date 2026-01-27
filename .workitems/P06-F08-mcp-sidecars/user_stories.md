# P06-F08: User Stories

## Epic Summary

As a developer using Claude CLI tools, I want MCP protocol access to Redis and Elasticsearch in the Kubernetes cluster, so that I can interact with these services directly from Claude without needing separate tooling or port forwarding for each protocol.

## User Stories

### US-00: MCP Server Docker Images

**As a** DevOps engineer building the aSDLC platform,
**I want** lightweight MCP server Docker images for Redis and Elasticsearch,
**So that** the images can be deployed as sidecars in Kubernetes.

**Acceptance Criteria:**

1. `docker/mcp-redis/` directory contains Dockerfile, server.py, and requirements.txt
2. `docker/mcp-elasticsearch/` directory contains Dockerfile, server.py, and requirements.txt
3. Both images use `python:3.11-slim` base image
4. Both images are under 150MB in size
5. Both images expose port 9000 with `/health` HTTP endpoint
6. Both images run as non-root user (UID 1000)
7. Both images work with read-only root filesystem
8. `scripts/build-images.sh --mcp` builds both images

**Verification:**
```bash
# Build images
./scripts/build-images.sh --mcp

# Check sizes
docker images mcp/redis:latest --format "{{.Size}}"
docker images mcp/elasticsearch:latest --format "{{.Size}}"

# Test health endpoints (with backend services running)
docker run --rm -d --name test-redis redis:7.2
docker run --rm --link test-redis:redis -e REDIS_HOST=redis -p 9000:9000 mcp/redis:latest
curl http://localhost:9000/health

# Verify non-root
docker run --rm mcp/redis:latest id
# Should show uid=1000
```

---

### US-01: Redis MCP Sidecar Configuration

**As a** DevOps engineer deploying the aSDLC platform,
**I want** to enable an MCP sidecar for Redis via Helm values,
**So that** Claude CLI tools can interact with Redis using MCP protocol.

**Acceptance Criteria:**

1. `mcpSidecar.enabled` toggle exists in `redis/values.yaml` (default: false)
2. When enabled, sidecar container is added to Redis StatefulSet
3. Sidecar image is configurable (`mcpSidecar.image.repository`, `mcpSidecar.image.tag`)
4. Sidecar resources are configurable (requests/limits)
5. Sidecar receives Redis password from existing secret when auth is enabled
6. MCP port 9000 is added to Redis Service when sidecar is enabled
7. Sidecar has securityContext (runAsNonRoot, runAsUser: 1000, readOnlyRootFilesystem, allowPrivilegeEscalation: false)
8. Sidecar has TCP socket readiness probe (port 9000, initialDelaySeconds: 5, periodSeconds: 10)
9. Sidecar has TCP socket liveness probe (port 9000, initialDelaySeconds: 15, periodSeconds: 20)

**Verification:**
```bash
# Enable sidecar
helm upgrade dox-asdlc ./helm/dox-asdlc --set redis.mcpSidecar.enabled=true -n dox-asdlc

# Verify 2/2 containers
kubectl get pods -n dox-asdlc -l app.kubernetes.io/name=redis
# NAME      READY   STATUS    RESTARTS   AGE
# redis-0   2/2     Running   0          1m

# Verify MCP port on service
kubectl get svc redis -n dox-asdlc -o jsonpath='{.spec.ports[*].name}'
# redis mcp

# Verify security context
kubectl get pod redis-0 -n dox-asdlc -o jsonpath='{.spec.containers[?(@.name=="mcp-sidecar")].securityContext}'
```

---

### US-02: Elasticsearch MCP Sidecar Configuration

**As a** DevOps engineer deploying the aSDLC platform,
**I want** to enable an MCP sidecar for Elasticsearch via Helm values,
**So that** Claude CLI tools can interact with Elasticsearch using MCP protocol.

**Acceptance Criteria:**

1. `mcpSidecar.enabled` toggle exists in `elasticsearch/values.yaml` (default: false)
2. When enabled, sidecar container is added to Elasticsearch StatefulSet
3. Sidecar image is configurable (`mcpSidecar.image.repository`, `mcpSidecar.image.tag`)
4. Sidecar resources are configurable (requests/limits)
5. Sidecar connects to Elasticsearch on localhost:9200
6. MCP port 9000 is added to knowledge-store Service when sidecar is enabled
7. Sidecar has securityContext (runAsNonRoot, runAsUser: 1000, readOnlyRootFilesystem, allowPrivilegeEscalation: false)
8. Sidecar has TCP socket readiness probe (port 9000, initialDelaySeconds: 5, periodSeconds: 10)
9. Sidecar has TCP socket liveness probe (port 9000, initialDelaySeconds: 15, periodSeconds: 20)

**Verification:**
```bash
# Enable sidecar
helm upgrade dox-asdlc ./helm/dox-asdlc --set elasticsearch.mcpSidecar.enabled=true -n dox-asdlc

# Verify 2/2 containers
kubectl get pods -n dox-asdlc -l app.kubernetes.io/name=elasticsearch
# NAME              READY   STATUS    RESTARTS   AGE
# elasticsearch-0   2/2     Running   0          2m

# Verify MCP port on service
kubectl get svc knowledge-store -n dox-asdlc -o jsonpath='{.spec.ports[*].name}'
# http mcp

# Verify security context
kubectl get pod elasticsearch-0 -n dox-asdlc -o jsonpath='{.spec.containers[?(@.name=="mcp-sidecar")].securityContext}'
```

---

### US-03: MCP Connectivity from Claude CLI

**As a** developer using Claude CLI tools,
**I want** to connect to Redis and Elasticsearch via MCP protocol on port 9000,
**So that** I can use Claude's built-in MCP capabilities to query and manipulate data.

**Acceptance Criteria:**

1. Redis MCP sidecar accessible at `redis:9000` within the cluster
2. Elasticsearch MCP sidecar accessible at `knowledge-store:9000` within the cluster
3. Port forwarding works for local development: `kubectl port-forward svc/redis 9000:9000`
4. MCP sidecars respond to health checks at `/health`
5. Redis sidecar can authenticate with Redis when auth is enabled
6. Sidecar failure does NOT affect main container functionality (graceful degradation)

**Verification:**
```bash
# Port forward Redis MCP
kubectl port-forward svc/redis 9000:9000 -n dox-asdlc &

# Test health endpoint (exact endpoint depends on MCP server implementation)
curl http://localhost:9000/health

# Port forward Elasticsearch MCP
kubectl port-forward svc/knowledge-store 9001:9000 -n dox-asdlc &

# Test health endpoint
curl http://localhost:9001/health

# Verify graceful degradation - kill sidecar, main container should continue
kubectl exec redis-0 -n dox-asdlc -c redis -- redis-cli ping
# PONG (works even if sidecar is down)
```

---

### US-04: Prometheus Annotations for Orchestrator

**As a** platform operator,
**I want** the orchestrator service to have Prometheus scrape annotations,
**So that** VictoriaMetrics can automatically discover and scrape metrics.

**Acceptance Criteria:**

1. `prometheus.enabled` toggle in `orchestrator/values.yaml` (default: true)
2. Pod annotations include `prometheus.io/scrape: "true"` when enabled
3. Pod annotations include `prometheus.io/port: "8080"`
4. Pod annotations include `prometheus.io/path: "/metrics"`
5. vmagent discovers and scrapes orchestrator metrics

**Verification:**
```bash
# Check pod annotations
kubectl get pods -n dox-asdlc -l app.kubernetes.io/name=orchestrator -o jsonpath='{.items[0].metadata.annotations}'
# Should include prometheus.io/scrape, port, path

# Verify in vmagent targets (after port-forward to VM)
curl "http://localhost:8428/api/v1/targets" | grep orchestrator
```

---

### US-05: Prometheus Annotations for Workers

**As a** platform operator,
**I want** the workers service to have Prometheus scrape annotations,
**So that** VictoriaMetrics can automatically discover and scrape metrics.

**Acceptance Criteria:**

1. `prometheus.enabled` toggle in `workers/values.yaml` (default: true)
2. Pod annotations include `prometheus.io/scrape: "true"` when enabled
3. Pod annotations include `prometheus.io/port: "8081"`
4. Pod annotations include `prometheus.io/path: "/metrics"`
5. vmagent discovers and scrapes worker metrics

**Verification:**
```bash
# Check pod annotations
kubectl get pods -n dox-asdlc -l app.kubernetes.io/name=workers -o jsonpath='{.items[0].metadata.annotations}'
# Should include prometheus.io/scrape, port, path

# Verify in vmagent targets
curl "http://localhost:8428/api/v1/targets" | grep workers
```

---

### US-06: HITL-UI Prometheus Annotations (OUT OF SCOPE)

**Status:** OUT OF SCOPE

**Reason:** React SPAs do not typically expose Prometheus metrics. The HITL-UI is a client-side React application served by nginx. It does not have a backend process that can expose `/metrics` endpoints. Metrics for the platform are collected from backend services (orchestrator, workers) which do expose Prometheus-compatible endpoints.

**Alternative:** If frontend metrics are needed in the future, consider:
- Browser-based metrics collection (e.g., RUM tools)
- nginx access log metrics via a separate exporter
- Application Performance Monitoring (APM) solutions

---

### US-07: Enable Sidecars for Minikube Development

**As a** developer working locally with minikube,
**I want** MCP sidecars enabled by default in development,
**So that** I can use Claude CLI tools without additional configuration.

**Acceptance Criteria:**

1. `values-minikube.yaml` enables `redis.mcpSidecar.enabled: true`
2. `values-minikube.yaml` enables `elasticsearch.mcpSidecar.enabled: true`
3. Development deployment includes both sidecars
4. Sidecars use lower resource limits suitable for minikube

**Verification:**
```bash
# Deploy with minikube values
./scripts/k8s/quickstart.sh --reset

# Verify both sidecars running
kubectl get pods -n dox-asdlc | grep -E "(redis|elasticsearch)"
# redis-0          2/2     Running
# elasticsearch-0  2/2     Running
```

---

### US-08: Disable Sidecars for Production

**As a** platform operator deploying to production,
**I want** MCP sidecars disabled by default,
**So that** production deployments do not include unnecessary components.

**Acceptance Criteria:**

1. `values.yaml` (production) has `mcpSidecar.enabled: false` for both Redis and Elasticsearch
2. Production deployment does not include sidecars unless explicitly enabled
3. Main containers function normally without sidecars

**Verification:**
```bash
# Deploy with production values (no -f values-minikube.yaml)
helm upgrade dox-asdlc ./helm/dox-asdlc -n dox-asdlc

# Verify single container per pod
kubectl get pods -n dox-asdlc | grep -E "(redis|elasticsearch)"
# redis-0          1/1     Running
# elasticsearch-0  1/1     Running
```

---

## Story Dependencies

```
US-00 (Docker images) ----+
                          |
                          +---> US-01 (Redis sidecar values) ----+
                          |                                      |
                          +---> US-02 (ES sidecar values)   ----+---> US-03 (MCP connectivity)
                                                                 |
                                                                 +---> US-07 (Minikube enable)
                                                                 |
                                                                 +---> US-08 (Prod disable)

US-04 (Orchestrator prometheus)  --+
                                   |
US-05 (Workers prometheus)      --+--> Metrics scraping functional

US-06 (HITL-UI prometheus)      ---> OUT OF SCOPE
```

## Definition of Done

- [ ] MCP Docker images build successfully and pass local tests
- [ ] All Helm templates render without errors
- [ ] Helm lint passes on all modified charts
- [ ] Sidecars start and respond to health checks when enabled
- [ ] Sidecars do not affect main container functionality (graceful degradation)
- [ ] Sidecars run as non-root with restricted security context
- [ ] Prometheus annotations work with existing vmagent scrape config
- [ ] Documentation updated if needed
- [ ] All acceptance criteria verified manually
