# P06-F08: Tasks

## Phase 0: MCP Docker Images (DevOps)

### T00a: Create docker/mcp-redis/Dockerfile
**Estimate:** 30 min | **Story:** US-00

- [ ] Create `docker/mcp-redis/` directory
- [ ] Create `Dockerfile` with `python:3.11-slim` base
- [ ] Create non-root user (UID 1000)
- [ ] Install Python dependencies from requirements.txt
- [ ] Copy server.py application code
- [ ] Set EXPOSE 9000
- [ ] Set CMD to run the MCP server
- [ ] Ensure container runs as non-root user

**Files:**
- `docker/mcp-redis/Dockerfile`

---

### T00b: Create docker/mcp-redis MCP server code
**Estimate:** 1 hr | **Story:** US-00 | **Depends on:** T00a

- [ ] Create `requirements.txt` with redis and mcp packages
- [ ] Create minimal `server.py` implementing MCP protocol
- [ ] Implement `/health` HTTP endpoint on port 9000
- [ ] Read `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` from environment
- [ ] Connect to Redis backend on localhost
- [ ] Expose basic Redis operations via MCP tools
- [ ] Handle connection errors gracefully

**Files:**
- `docker/mcp-redis/requirements.txt`
- `docker/mcp-redis/server.py`

---

### T00c: Build and test mcp-redis image locally
**Estimate:** 30 min | **Story:** US-00 | **Depends on:** T00b

- [ ] Build image: `docker build -t mcp/redis:latest docker/mcp-redis/`
- [ ] Verify image size < 150MB
- [ ] Run container with test Redis: `docker run --rm -p 9000:9000 mcp/redis:latest`
- [ ] Test health endpoint: `curl http://localhost:9000/health`
- [ ] Verify container runs as non-root (UID 1000)
- [ ] Verify read-only filesystem compatibility

**Commands:**
```bash
docker build -t mcp/redis:latest docker/mcp-redis/
docker images mcp/redis:latest --format "{{.Size}}"
docker run --rm -d --name test-redis redis:7.2
docker run --rm --link test-redis:redis -e REDIS_HOST=redis -p 9000:9000 mcp/redis:latest
curl http://localhost:9000/health
docker exec mcp-redis-test id  # Should show uid=1000
```

---

### T00d: Create docker/mcp-elasticsearch/Dockerfile
**Estimate:** 30 min | **Story:** US-00

- [ ] Create `docker/mcp-elasticsearch/` directory
- [ ] Create `Dockerfile` with `python:3.11-slim` base
- [ ] Create non-root user (UID 1000)
- [ ] Install Python dependencies from requirements.txt
- [ ] Copy server.py application code
- [ ] Set EXPOSE 9000
- [ ] Set CMD to run the MCP server
- [ ] Ensure container runs as non-root user

**Files:**
- `docker/mcp-elasticsearch/Dockerfile`

---

### T00e: Create docker/mcp-elasticsearch MCP server code
**Estimate:** 1 hr | **Story:** US-00 | **Depends on:** T00d

- [ ] Create `requirements.txt` with elasticsearch and mcp packages
- [ ] Create minimal `server.py` implementing MCP protocol
- [ ] Implement `/health` HTTP endpoint on port 9000
- [ ] Read `ES_HOST`, `ES_PORT` from environment
- [ ] Connect to Elasticsearch backend on localhost
- [ ] Expose basic Elasticsearch operations via MCP tools
- [ ] Handle connection errors gracefully

**Files:**
- `docker/mcp-elasticsearch/requirements.txt`
- `docker/mcp-elasticsearch/server.py`

---

### T00f: Build and test mcp-elasticsearch image locally
**Estimate:** 30 min | **Story:** US-00 | **Depends on:** T00e

- [ ] Build image: `docker build -t mcp/elasticsearch:latest docker/mcp-elasticsearch/`
- [ ] Verify image size < 150MB
- [ ] Run container with test Elasticsearch
- [ ] Test health endpoint: `curl http://localhost:9000/health`
- [ ] Verify container runs as non-root (UID 1000)
- [ ] Verify read-only filesystem compatibility

**Commands:**
```bash
docker build -t mcp/elasticsearch:latest docker/mcp-elasticsearch/
docker images mcp/elasticsearch:latest --format "{{.Size}}"
docker run --rm -d --name test-es -e "discovery.type=single-node" elasticsearch:8.11.0
docker run --rm --link test-es:elasticsearch -e ES_HOST=elasticsearch -p 9000:9000 mcp/elasticsearch:latest
curl http://localhost:9000/health
```

---

### T00g: Add MCP images to build-images.sh script
**Estimate:** 30 min | **Story:** US-00 | **Depends on:** T00c, T00f

- [ ] Add `--mcp` flag to build-images.sh
- [ ] Add build commands for mcp/redis and mcp/elasticsearch images
- [ ] Add images to default build list (or optional with flag)
- [ ] Update script help text
- [ ] Test: `./scripts/build-images.sh --mcp`

**Files:**
- `scripts/build-images.sh`

---

## Phase 1: Redis MCP Sidecar (DevOps)

### T01: Add mcpSidecar config to Redis values.yaml
**Estimate:** 30 min | **Story:** US-01 | **Depends on:** T00g

- [ ] Add `mcpSidecar` section to `helm/dox-asdlc/charts/redis/values.yaml`
- [ ] Include `enabled: false` (default disabled)
- [ ] Include `image.repository: mcp/redis`
- [ ] Include `image.tag: latest`
- [ ] Include `image.pullPolicy: IfNotPresent`
- [ ] Include `port: 9000`
- [ ] Include `resources` block (requests: 64Mi/50m, limits: 128Mi/100m)
- [ ] Include `securityContext` block (runAsNonRoot, runAsUser, readOnlyRootFilesystem, allowPrivilegeEscalation)

**Files:**
- `helm/dox-asdlc/charts/redis/values.yaml`

---

### T02: Add sidecar container to Redis StatefulSet
**Estimate:** 45 min | **Story:** US-01 | **Depends on:** T01

- [ ] Add conditional sidecar container block in `statefulset.yaml`
- [ ] Use `{{- if .Values.mcpSidecar.enabled }}`
- [ ] Configure container name: `mcp-sidecar`
- [ ] Set image from values
- [ ] Set containerPort 9000 with name `mcp`
- [ ] Add env var `REDIS_HOST: "localhost"`
- [ ] Add env var `REDIS_PORT: "6379"`
- [ ] Add conditional `REDIS_PASSWORD` from existing secret when auth enabled
- [ ] Add resource limits from values
- [ ] Add securityContext from values
- [ ] Add readiness probe (tcpSocket on port 9000, initialDelaySeconds: 5, periodSeconds: 10)
- [ ] Add liveness probe (tcpSocket on port 9000, initialDelaySeconds: 15, periodSeconds: 20)

**Files:**
- `helm/dox-asdlc/charts/redis/templates/statefulset.yaml`

---

### T03: Add MCP port to Redis Service
**Estimate:** 20 min | **Story:** US-01 | **Depends on:** T01

- [ ] Add conditional MCP port block to `service.yaml`
- [ ] Use `{{- if .Values.mcpSidecar.enabled }}`
- [ ] Add port 9000, targetPort mcp, name mcp

**Files:**
- `helm/dox-asdlc/charts/redis/templates/service.yaml`

---

### T04: Validate Redis sidecar with helm template
**Estimate:** 20 min | **Story:** US-01 | **Depends on:** T02, T03

- [ ] Run `helm template` with sidecar enabled
- [ ] Verify sidecar container appears in StatefulSet
- [ ] Verify MCP port appears in Service
- [ ] Verify securityContext is applied correctly
- [ ] Verify readiness and liveness probes use tcpSocket
- [ ] Run `helm lint` on redis chart
- [ ] Test with sidecar disabled (should not appear)

**Commands:**
```bash
helm template test ./helm/dox-asdlc --set redis.mcpSidecar.enabled=true --show-only charts/redis/templates/statefulset.yaml
helm template test ./helm/dox-asdlc --set redis.mcpSidecar.enabled=true --show-only charts/redis/templates/service.yaml
helm lint ./helm/dox-asdlc/charts/redis
```

---

## Phase 2: Elasticsearch MCP Sidecar (DevOps)

### T05: Add mcpSidecar config to Elasticsearch values.yaml
**Estimate:** 30 min | **Story:** US-02 | **Depends on:** T00g

- [ ] Add `mcpSidecar` section to `helm/dox-asdlc/charts/elasticsearch/values.yaml`
- [ ] Include `enabled: false` (default disabled)
- [ ] Include `image.repository: mcp/elasticsearch`
- [ ] Include `image.tag: latest`
- [ ] Include `image.pullPolicy: IfNotPresent`
- [ ] Include `port: 9000`
- [ ] Include `resources` block (requests: 64Mi/50m, limits: 128Mi/100m)
- [ ] Include `securityContext` block (runAsNonRoot, runAsUser, readOnlyRootFilesystem, allowPrivilegeEscalation)

**Files:**
- `helm/dox-asdlc/charts/elasticsearch/values.yaml`

---

### T06: Add sidecar container to Elasticsearch StatefulSet
**Estimate:** 45 min | **Story:** US-02 | **Depends on:** T05

- [ ] Add conditional sidecar container block in `statefulset.yaml`
- [ ] Use `{{- if .Values.mcpSidecar.enabled }}`
- [ ] Configure container name: `mcp-sidecar`
- [ ] Set image from values
- [ ] Set containerPort 9000 with name `mcp`
- [ ] Add env var `ES_HOST: "localhost"`
- [ ] Add env var `ES_PORT: "9200"`
- [ ] Add resource limits from values
- [ ] Add securityContext from values
- [ ] Add readiness probe (tcpSocket on port 9000, initialDelaySeconds: 5, periodSeconds: 10)
- [ ] Add liveness probe (tcpSocket on port 9000, initialDelaySeconds: 15, periodSeconds: 20)

**Files:**
- `helm/dox-asdlc/charts/elasticsearch/templates/statefulset.yaml`

---

### T07: Add MCP port to Elasticsearch Service
**Estimate:** 20 min | **Story:** US-02 | **Depends on:** T05

- [ ] Add conditional MCP port block to `service.yaml`
- [ ] Use `{{- if .Values.mcpSidecar.enabled }}`
- [ ] Add port 9000, targetPort mcp, name mcp

**Files:**
- `helm/dox-asdlc/charts/elasticsearch/templates/service.yaml`

---

### T08: Validate Elasticsearch sidecar with helm template
**Estimate:** 20 min | **Story:** US-02 | **Depends on:** T06, T07

- [ ] Run `helm template` with sidecar enabled
- [ ] Verify sidecar container appears in StatefulSet
- [ ] Verify MCP port appears in Service
- [ ] Verify securityContext is applied correctly
- [ ] Verify readiness and liveness probes use tcpSocket
- [ ] Run `helm lint` on elasticsearch chart
- [ ] Test with sidecar disabled (should not appear)

**Commands:**
```bash
helm template test ./helm/dox-asdlc --set elasticsearch.mcpSidecar.enabled=true --show-only charts/elasticsearch/templates/statefulset.yaml
helm template test ./helm/dox-asdlc --set elasticsearch.mcpSidecar.enabled=true --show-only charts/elasticsearch/templates/service.yaml
helm lint ./helm/dox-asdlc/charts/elasticsearch
```

---

## Phase 3: Prometheus Annotations (DevOps)

### T09: Add prometheus config to orchestrator values.yaml
**Estimate:** 20 min | **Story:** US-04

- [ ] Add `prometheus` section to `helm/dox-asdlc/charts/orchestrator/values.yaml`
- [ ] Include `enabled: true` (default enabled)
- [ ] Include `port: 8080`
- [ ] Include `path: /metrics`
- [ ] Update `podAnnotations` section with Prometheus annotations

**Files:**
- `helm/dox-asdlc/charts/orchestrator/values.yaml`

---

### T10: Add prometheus config to workers values.yaml
**Estimate:** 20 min | **Story:** US-05

- [ ] Add `prometheus` section to `helm/dox-asdlc/charts/workers/values.yaml`
- [ ] Include `enabled: true` (default enabled)
- [ ] Include `port: 8081`
- [ ] Include `path: /metrics`
- [ ] Update `podAnnotations` section with Prometheus annotations

**Files:**
- `helm/dox-asdlc/charts/workers/values.yaml`

---

### T11: Validate Prometheus annotations with helm template
**Estimate:** 20 min | **Story:** US-04, US-05 | **Depends on:** T09, T10

- [ ] Run `helm template` for each deployment
- [ ] Verify `prometheus.io/scrape: "true"` annotation present
- [ ] Verify `prometheus.io/port` annotation matches service port
- [ ] Verify `prometheus.io/path` annotation is `/metrics`
- [ ] Run `helm lint` on orchestrator and workers charts

**Commands:**
```bash
helm template test ./helm/dox-asdlc --show-only charts/orchestrator/templates/deployment.yaml | grep -A5 "annotations"
helm template test ./helm/dox-asdlc --show-only charts/workers/templates/deployment.yaml | grep -A5 "annotations"
```

---

## Phase 4: Parent Chart Integration (DevOps)

### T12: Update parent chart values.yaml
**Estimate:** 30 min | **Story:** US-08 | **Depends on:** T04, T08, T11

- [ ] Add `mcpSidecar.enabled: false` under `redis` section
- [ ] Add `mcpSidecar.enabled: false` under `elasticsearch` section
- [ ] Verify defaults result in no sidecars in production

**Files:**
- `helm/dox-asdlc/values.yaml`

---

### T13: Update values-minikube.yaml for development
**Estimate:** 30 min | **Story:** US-07 | **Depends on:** T12

- [ ] Add `redis.mcpSidecar.enabled: true`
- [ ] Add `redis.mcpSidecar.resources` with dev-appropriate limits
- [ ] Add `elasticsearch.mcpSidecar.enabled: true`
- [ ] Add `elasticsearch.mcpSidecar.resources` with dev-appropriate limits

**Files:**
- `helm/dox-asdlc/values-minikube.yaml`

---

### T14: Full chart validation
**Estimate:** 30 min | **Story:** US-07, US-08 | **Depends on:** T12, T13

- [ ] Run `helm lint` on parent chart
- [ ] Run `helm template` with production values (no sidecars)
- [ ] Run `helm template` with minikube values (sidecars enabled)
- [ ] Verify no YAML syntax errors
- [ ] Verify conditional blocks work correctly

**Commands:**
```bash
helm lint ./helm/dox-asdlc
helm template test ./helm/dox-asdlc > /dev/null && echo "Production OK"
helm template test ./helm/dox-asdlc -f ./helm/dox-asdlc/values-minikube.yaml > /dev/null && echo "Minikube OK"
```

---

## Phase 5: Deployment Verification (DevOps)

### T15: Deploy to minikube with sidecars
**Estimate:** 45 min | **Story:** US-03, US-07 | **Depends on:** T14

- [ ] Start minikube if not running
- [ ] Build MCP images: `./scripts/build-images.sh --mcp`
- [ ] Deploy with `./scripts/k8s/quickstart.sh --reset`
- [ ] Wait for all pods to be Ready
- [ ] Verify Redis pod shows 2/2 containers
- [ ] Verify Elasticsearch pod shows 2/2 containers

**Commands:**
```bash
./scripts/build-images.sh --mcp
./scripts/k8s/quickstart.sh --reset
kubectl get pods -n dox-asdlc -w
```

---

### T16: Test MCP sidecar connectivity
**Estimate:** 30 min | **Story:** US-03 | **Depends on:** T15

- [ ] Port forward Redis MCP: `kubectl port-forward svc/redis 9000:9000 -n dox-asdlc`
- [ ] Test Redis MCP health endpoint
- [ ] Port forward Elasticsearch MCP: `kubectl port-forward svc/knowledge-store 9001:9000 -n dox-asdlc`
- [ ] Test Elasticsearch MCP health endpoint
- [ ] Document actual MCP endpoints for future reference

**Note:** Actual MCP health/test endpoints depend on the MCP server implementation.

---

### T17: Verify Prometheus scraping
**Estimate:** 30 min | **Story:** US-04, US-05 | **Depends on:** T15

- [ ] Port forward VictoriaMetrics: `kubectl port-forward svc/metrics-store 8428:8428 -n dox-asdlc`
- [ ] Query targets: `curl "http://localhost:8428/api/v1/targets"`
- [ ] Verify orchestrator appears in targets
- [ ] Verify workers appears in targets
- [ ] Check for any scrape errors

---

## Progress

- Phase 0 (Docker Images): 0/7 tasks (0%)
- Phase 1 (Redis MCP): 0/4 tasks (0%)
- Phase 2 (ES MCP): 0/4 tasks (0%)
- Phase 3 (Prometheus): 0/3 tasks (0%)
- Phase 4 (Integration): 0/3 tasks (0%)
- Phase 5 (Verification): 0/3 tasks (0%)
- **Total: 0/24 tasks (0%)**

## Task Dependencies Graph

```
Phase 0: Docker Images
T00a (redis Dockerfile) --> T00b (redis server) --> T00c (build/test redis)
T00d (es Dockerfile) ----> T00e (es server) -----> T00f (build/test es)
                                                          |
T00c, T00f ------------------------------------------------+---> T00g (build-images.sh)

Phase 1: Redis
T00g --> T01 (values) --> T02 (statefulset) --> T04 (validate)
                     \-> T03 (service) ------/

Phase 2: Elasticsearch
T00g --> T05 (values) --> T06 (statefulset) --> T08 (validate)
                     \-> T07 (service) ------/

Phase 3: Prometheus
T09 (orchestrator) --+
T10 (workers) ------+--> T11 (validate)

Phase 4: Integration
T04, T08, T11 --> T12 (values.yaml) --> T13 (minikube) --> T14 (full validate)

Phase 5: Verification
T14 --> T15 (deploy) --> T16 (MCP test)
                    \--> T17 (Prometheus test)
```

## Execution Notes

- **Domain:** DevOps
- **HITL Required:** Yes, before deployment operations (Step 10 in workflow)
- **Estimated Total Time:** ~10 hours (increased from 7 hours due to Phase 0)
- **Can Be Parallelized:**
  - Phase 0: T00a-T00c (Redis) and T00d-T00f (ES) can run in parallel
  - Phase 1, 2, 3 can run in parallel after Phase 0 complete
