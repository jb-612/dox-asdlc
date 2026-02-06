# GCP Cloud Run Deployment (All-in-Cloud-Run, Cost-Optimized)

**Status:** Approved
**Optimization:** Cost (ephemeral data, scale-to-zero)
**Date:** 2026-02-06

## Design Decisions

1. **Everything on Cloud Run** — no VMs, no Cloud SQL, no managed services
2. **Stateful services run as sidecars** — Redis, Postgres, ES share `localhost` with app
3. **Data is ephemeral** — good for demos and E2E testing, not long-term storage
4. **Postgres dumps to GCS** — survives instance recycling, restores on cold start
5. **Redis and ES are ephemeral** — data lost on restart (acceptable for demo/testing)
6. **VictoriaMetrics dropped** — use Cloud Run built-in metrics instead

## Why Sidecars?

Cloud Run only accepts HTTP/gRPC/WebSocket ingress. Redis uses its own TCP protocol,
PostgreSQL uses wire protocol. They **cannot** run as standalone Cloud Run services
that other services connect to. The solution: bundle them as sidecars sharing
`localhost` with the app containers.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Cloud Run Service: "asdlc-backend"                             │
│  (multi-container, 2 vCPU, 4Gi RAM)                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ INGRESS (HTTP :8080)                                     │   │
│  │ ┌──────────────┐                                         │   │
│  │ │ orchestrator  │ ← external traffic via Cloud Run URL   │   │
│  │ │ (FastAPI)     │                                         │   │
│  │ └──────┬───────┘                                         │   │
│  └────────┼─────────────────────────────────────────────────┘   │
│           │ localhost                                             │
│  ┌────────┼─────────────────────────────────────────────────┐   │
│  │ SIDECARS (share localhost network)                       │   │
│  │                                                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │   │
│  │  │  postgres   │  │   redis    │  │  elasticsearch     │ │   │
│  │  │  :5432      │  │   :6379    │  │  :9200             │ │   │
│  │  │  GCS dump/  │  │  ephemeral │  │  ephemeral         │ │   │
│  │  │  restore    │  │  (no AOF)  │  │  (indexes rebuilt) │ │   │
│  │  └────────────┘  └────────────┘  └────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌────────────┐  ┌──────────────┐                        │   │
│  │  │  workers   │  │ review-swarm │                        │   │
│  │  │  :8081     │  │ :8082        │                        │   │
│  │  │  streams   │  │ Claude SDK   │                        │   │
│  │  └────────────┘  └──────────────┘                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Cloud Run Service: "hitl-ui"                                    │
│  (single container, 1 vCPU, 256Mi RAM)                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ┌──────────┐                                             │   │
│  │ │ hitl-ui  │ ← public traffic                            │   │
│  │ │ :3000    │ → proxies /api to asdlc-backend URL         │   │
│  │ └──────────┘                                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  GCS Bucket: "asdlc-pgdump"                                     │
│  ┌──────────────────────────┐                                    │
│  │ latest.sql.gz  (~few MB) │ ← Postgres dumps here on SIGTERM │
│  │                          │ → Postgres restores on cold start  │
│  └──────────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Cost Estimate

| Component | Cost/month |
|-----------|-----------|
| Cloud Run "asdlc-backend" (scale-to-zero, ~4Gi) | $0-8 |
| Cloud Run "hitl-ui" (scale-to-zero, 256Mi) | $0-1 |
| GCS bucket (few MB of pg dumps) | ~$0.01 |
| Artifact Registry (Docker images) | $0-1 |
| **Total** | **$0-10/month** |

Scale-to-zero means you pay nothing when the system is idle. Cloud Run free tier
includes 2M requests/month, 360k vCPU-seconds, and 180k GiB-seconds.

## Data Persistence Model

| Service | Persistence | Survives Restart? | Notes |
|---------|-------------|-------------------|-------|
| PostgreSQL | GCS dump/restore | **Yes** | Dumps on SIGTERM, restores on startup |
| Redis | None (ephemeral) | No | Event streams and cache rebuilt on use |
| Elasticsearch | None (ephemeral) | No | Indexes created on demand by services |
| VictoriaMetrics | Dropped | N/A | Use Cloud Run built-in metrics |

### PostgreSQL GCS Dump/Restore Lifecycle

```
Cold Start:
  1. Container starts
  2. Check GCS for gs://${BUCKET}/latest.sql.gz
  3. If found: restore into fresh Postgres
  4. If not found: run init.sql (fresh schema)
  5. Start accepting connections

Running:
  6. Periodic dump every 5 minutes (background)
  7. Upload to gs://${BUCKET}/latest.sql.gz

Shutdown (SIGTERM):
  8. Final pg_dump → GCS
  9. Stop Postgres gracefully
  10. Exit
```

## Cloud Run Service Definitions

### Service 1: asdlc-backend (multi-container)

```yaml
# cloud-run-backend.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: asdlc-backend
  annotations:
    run.googleapis.com/launch-stage: BETA
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cpu-throttling: "false"    # workers need always-on CPU
        run.googleapis.com/startup-cpu-boost: "true"   # faster ES startup
        autoscaling.knative.dev/minScale: "0"          # scale to zero
        autoscaling.knative.dev/maxScale: "1"          # single instance (shared state)
    spec:
      containerConcurrency: 80
      timeoutSeconds: 3600
      serviceAccountName: asdlc-backend-sa

      containers:
        # === INGRESS CONTAINER ===
        - name: orchestrator
          image: REGION-docker.pkg.dev/PROJECT/asdlc/orchestrator:latest
          ports:
            - containerPort: 8080
          env:
            - name: REDIS_HOST
              value: "localhost"
            - name: REDIS_PORT
              value: "6379"
            - name: REDIS_PASSWORD
              value: "cloudrun-redis-pw"
            - name: ELASTICSEARCH_URL
              value: "http://localhost:9200"
            - name: POSTGRES_HOST
              value: "localhost"
            - name: POSTGRES_PORT
              value: "5432"
            - name: POSTGRES_DB
              value: "asdlc_ideation"
            - name: POSTGRES_USER
              value: "asdlc"
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-password
            - name: IDEATION_PERSISTENCE_BACKEND
              value: "postgres"
            - name: SERVICE_NAME
              value: "orchestrator"
            - name: SERVICE_PORT
              value: "8080"
            - name: GIT_WRITE_ACCESS
              value: "true"
            - name: LLM_CONFIG_ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: llm-encryption-key
          resources:
            limits:
              cpu: "1"
              memory: "512Mi"
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 20
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 30

        # === SIDECAR: PostgreSQL with GCS dump/restore ===
        - name: postgres
          image: REGION-docker.pkg.dev/PROJECT/asdlc/postgres-gcs:latest
          env:
            - name: POSTGRES_USER
              value: "asdlc"
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-password
            - name: POSTGRES_DB
              value: "asdlc_ideation"
            - name: GCS_BUCKET
              value: "PROJECT-asdlc-pgdump"
            - name: DUMP_INTERVAL_SECONDS
              value: "300"
          resources:
            limits:
              cpu: "0.25"
              memory: "256Mi"
          startupProbe:
            exec:
              command: ["pg_isready", "-U", "asdlc"]
            initialDelaySeconds: 5
            periodSeconds: 2
            failureThreshold: 30

        # === SIDECAR: Redis (ephemeral, no persistence) ===
        - name: redis
          image: redis:7-alpine
          command: ["redis-server"]
          args:
            - "--bind"
            - "0.0.0.0"
            - "--port"
            - "6379"
            - "--requirepass"
            - "cloudrun-redis-pw"
            - "--maxmemory"
            - "256mb"
            - "--maxmemory-policy"
            - "allkeys-lru"
            - "--save"
            - ""
            - "--appendonly"
            - "no"
          resources:
            limits:
              cpu: "0.25"
              memory: "300Mi"
          startupProbe:
            exec:
              command: ["redis-cli", "-a", "cloudrun-redis-pw", "ping"]
            periodSeconds: 2
            failureThreshold: 15

        # === SIDECAR: Elasticsearch (ephemeral) ===
        - name: elasticsearch
          image: docker.elastic.co/elasticsearch/elasticsearch:8.17.0
          env:
            - name: discovery.type
              value: "single-node"
            - name: xpack.security.enabled
              value: "false"
            - name: ES_JAVA_OPTS
              value: "-Xms384m -Xmx384m"
            - name: cluster.name
              value: "asdlc-cloudrun"
          resources:
            limits:
              cpu: "0.5"
              memory: "768Mi"
          startupProbe:
            httpGet:
              path: /_cluster/health
              port: 9200
            initialDelaySeconds: 20
            periodSeconds: 5
            failureThreshold: 30

        # === SIDECAR: Workers (stream consumer) ===
        - name: workers
          image: REGION-docker.pkg.dev/PROJECT/asdlc/workers:latest
          env:
            - name: REDIS_HOST
              value: "localhost"
            - name: REDIS_PORT
              value: "6379"
            - name: REDIS_PASSWORD
              value: "cloudrun-redis-pw"
            - name: ELASTICSEARCH_URL
              value: "http://localhost:9200"
            - name: SERVICE_NAME
              value: "workers"
            - name: SERVICE_PORT
              value: "8081"
            - name: GIT_WRITE_ACCESS
              value: "false"
          resources:
            limits:
              cpu: "0.5"
              memory: "512Mi"

        # === SIDECAR: Review Swarm ===
        - name: review-swarm
          image: REGION-docker.pkg.dev/PROJECT/asdlc/review-swarm:latest
          env:
            - name: REDIS_HOST
              value: "localhost"
            - name: REDIS_PORT
              value: "6379"
            - name: REDIS_PASSWORD
              value: "cloudrun-redis-pw"
            - name: ELASTICSEARCH_URL
              value: "http://localhost:9200"
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: anthropic-api-key
            - name: SERVICE_NAME
              value: "review-swarm"
            - name: SERVICE_PORT
              value: "8082"
          resources:
            limits:
              cpu: "0.5"
              memory: "512Mi"
```

### Service 2: hitl-ui (standalone)

```bash
gcloud run deploy hitl-ui \
  --image=${REGION}-docker.pkg.dev/${PROJECT}/asdlc/hitl-ui:latest \
  --region=${REGION} \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=2 \
  --concurrency=200 \
  --timeout=3600 \
  --set-env-vars="API_BACKEND_URL=${BACKEND_URL}" \
  --set-env-vars="SERVICE_NAME=hitl-ui,SERVICE_PORT=3000" \
  --allow-unauthenticated
```

Where `BACKEND_URL` is the Cloud Run URL of `asdlc-backend`
(e.g., `https://asdlc-backend-xxxxx-uc.a.run.app`).

## Postgres GCS Wrapper

A custom Dockerfile wraps the official `postgres:16-alpine` image with a
dump/restore entrypoint. See `docker/postgres-gcs/` for implementation.

**Lifecycle:**
- **Startup:** Downloads `gs://${BUCKET}/latest.sql.gz` → restores into Postgres
- **Running:** Background dump every `DUMP_INTERVAL_SECONDS` (default: 300s / 5 min)
- **Shutdown (SIGTERM):** Final dump to GCS → graceful Postgres stop

**Required IAM:** The Cloud Run service account needs `roles/storage.objectAdmin`
on the GCS bucket.

## Resource Totals (asdlc-backend)

| Container | CPU | Memory |
|-----------|-----|--------|
| orchestrator | 1.0 | 512Mi |
| postgres | 0.25 | 256Mi |
| redis | 0.25 | 300Mi |
| elasticsearch | 0.5 | 768Mi |
| workers | 0.5 | 512Mi |
| review-swarm | 0.5 | 512Mi |
| **Total** | **3.0** | **2860Mi** |

Set the Cloud Run service to `--cpu=4 --memory=4Gi` to give headroom.

## Deployment Steps

### Prerequisites

```bash
export PROJECT=your-gcp-project
export REGION=us-central1
export BUCKET=${PROJECT}-asdlc-pgdump
```

### 1. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com
```

### 2. Create Artifact Registry

```bash
gcloud artifacts repositories create asdlc \
  --repository-format=docker \
  --location=${REGION}
```

### 3. Create GCS Bucket (for Postgres dumps)

```bash
gsutil mb -l ${REGION} gs://${BUCKET}
gsutil lifecycle set <(echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}') gs://${BUCKET}
```

### 4. Store Secrets

```bash
echo -n "your-pg-password" | gcloud secrets create postgres-password --data-file=-
echo -n "your-anthropic-key" | gcloud secrets create anthropic-api-key --data-file=-
echo -n "your-encryption-key" | gcloud secrets create llm-encryption-key --data-file=-
```

### 5. Build and Push Images

```bash
# Configure Docker auth
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build all images
docker build -f docker/orchestrator/Dockerfile -t ${REGION}-docker.pkg.dev/${PROJECT}/asdlc/orchestrator:latest .
docker build -f docker/workers/Dockerfile -t ${REGION}-docker.pkg.dev/${PROJECT}/asdlc/workers:latest .
docker build -f docker/review-swarm/Dockerfile -t ${REGION}-docker.pkg.dev/${PROJECT}/asdlc/review-swarm:latest .
docker build -f docker/hitl-ui/Dockerfile -t ${REGION}-docker.pkg.dev/${PROJECT}/asdlc/hitl-ui:latest .
docker build -f docker/postgres-gcs/Dockerfile -t ${REGION}-docker.pkg.dev/${PROJECT}/asdlc/postgres-gcs:latest docker/postgres-gcs/

# Push all
for img in orchestrator workers review-swarm hitl-ui postgres-gcs; do
  docker push ${REGION}-docker.pkg.dev/${PROJECT}/asdlc/${img}:latest
done
```

### 6. Grant IAM Permissions

```bash
SA=$(gcloud run services describe asdlc-backend --region=${REGION} \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || \
  echo "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com")

# GCS access for Postgres dumps
gcloud storage buckets add-iam-policy-binding gs://${BUCKET} \
  --member="serviceAccount:${SA}" \
  --role="roles/storage.objectAdmin"

# Secret Manager access
for secret in postgres-password anthropic-api-key llm-encryption-key; do
  gcloud secrets add-iam-policy-binding ${secret} \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 7. Deploy

```bash
# Deploy backend (multi-container)
./scripts/gcp/deploy-cloud-run.sh

# Deploy HITL UI
BACKEND_URL=$(gcloud run services describe asdlc-backend \
  --region=${REGION} --format='value(status.url)')

gcloud run deploy hitl-ui \
  --image=${REGION}-docker.pkg.dev/${PROJECT}/asdlc/hitl-ui:latest \
  --region=${REGION} \
  --memory=256Mi --cpu=1 \
  --min-instances=0 --max-instances=2 \
  --set-env-vars="API_BACKEND_URL=${BACKEND_URL}" \
  --allow-unauthenticated
```

### 8. Verify

```bash
BACKEND_URL=$(gcloud run services describe asdlc-backend --region=${REGION} --format='value(status.url)')
FRONTEND_URL=$(gcloud run services describe hitl-ui --region=${REGION} --format='value(status.url)')

echo "Backend:  ${BACKEND_URL}/health"
echo "Frontend: ${FRONTEND_URL}"

curl -s ${BACKEND_URL}/health | python3 -m json.tool
```

## Known Limitations

### Single Instance Constraint

`maxScale: 1` is set because Redis, Postgres, and ES hold in-memory state. If
Cloud Run scaled to 2 instances, each would have its own Redis/Postgres — data
would diverge. For a demo/testing deployment this is fine.

### Cold Start Time

With 6 containers, cold start is ~30-45 seconds (Elasticsearch dominates at ~20-30s).
After the first request warms the instance, subsequent requests are fast.

Use `--min-instances=1` during active demo sessions (~$30-60/month) to eliminate cold starts.

### Instance Recycling

Cloud Run may recycle instances at any time (typically every few hours to days).
When this happens:
- **Postgres**: Restores from last GCS dump (max 5 min data loss)
- **Redis**: Starts empty (event streams and cache rebuilt on use)
- **ES**: Starts empty (indexes recreated on demand by KnowledgeStore)

### CPU Throttling Disabled

`cpu-throttling: false` is required because workers consume Redis Streams in the
background. This means CPU is always allocated while the instance is active,
increasing cost slightly vs throttled mode.

### Memory Pressure

4Gi is tight for 6 containers. Elasticsearch heap is reduced to 384MB (from 512MB
in local dev). Monitor memory usage and bump to 8Gi if OOM kills occur.

## Teardown

```bash
gcloud run services delete asdlc-backend --region=${REGION} --quiet
gcloud run services delete hitl-ui --region=${REGION} --quiet
gsutil rm -r gs://${BUCKET}
gcloud artifacts repositories delete asdlc --location=${REGION} --quiet
for secret in postgres-password anthropic-api-key llm-encryption-key; do
  gcloud secrets delete ${secret} --quiet
done
```
