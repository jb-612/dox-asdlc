#!/usr/bin/env bash
# Deploy aSDLC to GCP Cloud Run (all-in-Cloud-Run, cost-optimized)
#
# Usage:
#   export PROJECT=your-gcp-project
#   export REGION=us-central1          # optional, defaults to us-central1
#   ./scripts/gcp/deploy-cloud-run.sh [command]
#
# Commands:
#   setup     - Create GCS bucket, Artifact Registry, secrets (run once)
#   build     - Build and push all Docker images
#   deploy    - Deploy Cloud Run services
#   status    - Show service URLs and health
#   teardown  - Delete all resources
#   all       - setup + build + deploy (default)

set -euo pipefail

: "${PROJECT:?Set PROJECT to your GCP project ID}"
: "${REGION:=us-central1}"
BUCKET="${PROJECT}-asdlc-pgdump"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT}/asdlc"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

log() { echo "==> $*"; }
err() { echo "ERROR: $*" >&2; exit 1; }

# ─────────────────────────────────────────────────────────────
# setup: one-time infrastructure
# ─────────────────────────────────────────────────────────────
cmd_setup() {
    log "Enabling GCP APIs..."
    gcloud services enable \
        run.googleapis.com \
        artifactregistry.googleapis.com \
        secretmanager.googleapis.com \
        storage.googleapis.com \
        --project="${PROJECT}"

    log "Creating Artifact Registry repository..."
    gcloud artifacts repositories describe asdlc \
        --location="${REGION}" --project="${PROJECT}" 2>/dev/null \
    || gcloud artifacts repositories create asdlc \
        --repository-format=docker \
        --location="${REGION}" \
        --project="${PROJECT}"

    log "Creating GCS bucket for Postgres dumps..."
    if ! gsutil ls -b "gs://${BUCKET}" 2>/dev/null; then
        gsutil mb -l "${REGION}" -p "${PROJECT}" "gs://${BUCKET}"
        # Auto-delete dumps older than 30 days
        gsutil lifecycle set /dev/stdin "gs://${BUCKET}" <<'EOF'
{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}
EOF
    fi

    log "Checking secrets (create manually if missing)..."
    for secret in postgres-password anthropic-api-key llm-encryption-key; do
        if gcloud secrets describe "${secret}" --project="${PROJECT}" 2>/dev/null; then
            echo "  [ok] ${secret}"
        else
            echo "  [missing] ${secret} — create with:"
            echo "    echo -n 'value' | gcloud secrets create ${secret} --data-file=- --project=${PROJECT}"
        fi
    done

    log "Setup complete."
}

# ─────────────────────────────────────────────────────────────
# build: build and push Docker images
# ─────────────────────────────────────────────────────────────
cmd_build() {
    log "Configuring Docker auth for Artifact Registry..."
    gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

    cd "${REPO_ROOT}"

    log "Building orchestrator..."
    docker build -f docker/orchestrator/Dockerfile \
        -t "${REGISTRY}/orchestrator:latest" .

    log "Building workers..."
    docker build -f docker/workers/Dockerfile \
        -t "${REGISTRY}/workers:latest" .

    log "Building review-swarm..."
    docker build -f docker/review-swarm/Dockerfile \
        -t "${REGISTRY}/review-swarm:latest" .

    log "Building hitl-ui..."
    docker build -f docker/hitl-ui/Dockerfile \
        --build-arg VITE_USE_MOCKS=false \
        --build-arg VITE_API_BASE_URL=/api \
        -t "${REGISTRY}/hitl-ui:latest" .

    log "Building postgres-gcs..."
    docker build -f docker/postgres-gcs/Dockerfile \
        -t "${REGISTRY}/postgres-gcs:latest" \
        docker/postgres-gcs/

    log "Pushing images..."
    for img in orchestrator workers review-swarm hitl-ui postgres-gcs; do
        log "  Pushing ${img}..."
        docker push "${REGISTRY}/${img}:latest"
    done

    log "Build complete."
}

# ─────────────────────────────────────────────────────────────
# deploy: deploy Cloud Run services
# ─────────────────────────────────────────────────────────────
cmd_deploy() {
    log "Generating Cloud Run service YAML..."

    # Generate backend service YAML with project-specific values
    local yaml_file="/tmp/asdlc-backend-service.yaml"
    sed -e "s|REGION-docker.pkg.dev/PROJECT|${REGISTRY}|g" \
        -e "s|PROJECT-asdlc-pgdump|${BUCKET}|g" \
        "${REPO_ROOT}/docs/environments/gcp-cloud-run-deployment.md" \
        > /dev/null  # validate sed works

    cat > "${yaml_file}" <<YAML
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
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/startup-cpu-boost: "true"
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "1"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 3600
      containers:
        - name: orchestrator
          image: ${REGISTRY}/orchestrator:latest
          ports:
            - containerPort: 8080
          env:
            - name: REDIS_HOST
              value: "localhost"
            - name: REDIS_PORT
              value: "6379"
            - name: REDIS_PASSWORD
              value: "cloudrun-redis-pw"
            - name: REDIS_URL
              value: "redis://:cloudrun-redis-pw@localhost:6379"
            - name: ELASTICSEARCH_URL
              value: "http://localhost:9200"
            - name: KNOWLEDGE_STORE_BACKEND
              value: "elasticsearch"
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
                  key: latest
                  name: postgres-password
            - name: IDEATION_PERSISTENCE_BACKEND
              value: "postgres"
            - name: POSTGRES_SSL_MODE
              value: "disable"
            - name: SERVICE_NAME
              value: "orchestrator"
            - name: SERVICE_PORT
              value: "8080"
            - name: GIT_WRITE_ACCESS
              value: "true"
            - name: LLM_CONFIG_ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: llm-encryption-key
          resources:
            limits:
              cpu: "1"
              memory: "512Mi"
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 5
            failureThreshold: 24
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 30

        - name: postgres
          image: ${REGISTRY}/postgres-gcs:latest
          env:
            - name: POSTGRES_USER
              value: "asdlc"
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: postgres-password
            - name: POSTGRES_DB
              value: "asdlc_ideation"
            - name: GCS_BUCKET
              value: "${BUCKET}"
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

        - name: workers
          image: ${REGISTRY}/workers:latest
          env:
            - name: REDIS_HOST
              value: "localhost"
            - name: REDIS_PORT
              value: "6379"
            - name: REDIS_PASSWORD
              value: "cloudrun-redis-pw"
            - name: ELASTICSEARCH_URL
              value: "http://localhost:9200"
            - name: KNOWLEDGE_STORE_BACKEND
              value: "elasticsearch"
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

        - name: review-swarm
          image: ${REGISTRY}/review-swarm:latest
          env:
            - name: REDIS_HOST
              value: "localhost"
            - name: REDIS_PORT
              value: "6379"
            - name: REDIS_PASSWORD
              value: "cloudrun-redis-pw"
            - name: ELASTICSEARCH_URL
              value: "http://localhost:9200"
            - name: KNOWLEDGE_STORE_BACKEND
              value: "elasticsearch"
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: anthropic-api-key
            - name: LLM_CONFIG_ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: llm-encryption-key
            - name: SERVICE_NAME
              value: "review-swarm"
            - name: SERVICE_PORT
              value: "8082"
            - name: GIT_WRITE_ACCESS
              value: "false"
          resources:
            limits:
              cpu: "0.5"
              memory: "512Mi"
YAML

    log "Deploying asdlc-backend (multi-container)..."
    gcloud run services replace "${yaml_file}" \
        --region="${REGION}" \
        --project="${PROJECT}"

    # Allow unauthenticated access (for demo; restrict in production)
    gcloud run services add-iam-policy-binding asdlc-backend \
        --region="${REGION}" \
        --member="allUsers" \
        --role="roles/run.invoker" \
        --project="${PROJECT}" 2>/dev/null || true

    # Deploy HITL UI
    local backend_url
    backend_url=$(gcloud run services describe asdlc-backend \
        --region="${REGION}" --project="${PROJECT}" \
        --format='value(status.url)')

    log "Deploying hitl-ui (backend URL: ${backend_url})..."
    gcloud run deploy hitl-ui \
        --image="${REGISTRY}/hitl-ui:latest" \
        --region="${REGION}" \
        --project="${PROJECT}" \
        --memory=256Mi \
        --cpu=1 \
        --min-instances=0 \
        --max-instances=2 \
        --concurrency=200 \
        --timeout=3600 \
        --set-env-vars="API_BACKEND_URL=${backend_url}" \
        --set-env-vars="SERVICE_NAME=hitl-ui,SERVICE_PORT=3000" \
        --allow-unauthenticated

    log "Deploy complete."
    cmd_status
}

# ─────────────────────────────────────────────────────────────
# status: show URLs and health
# ─────────────────────────────────────────────────────────────
cmd_status() {
    log "Service URLs:"
    for svc in asdlc-backend hitl-ui; do
        local url
        url=$(gcloud run services describe "${svc}" \
            --region="${REGION}" --project="${PROJECT}" \
            --format='value(status.url)' 2>/dev/null || echo "NOT DEPLOYED")
        echo "  ${svc}: ${url}"
    done

    echo ""
    log "Health check:"
    local backend_url
    backend_url=$(gcloud run services describe asdlc-backend \
        --region="${REGION}" --project="${PROJECT}" \
        --format='value(status.url)' 2>/dev/null || echo "")
    if [ -n "${backend_url}" ]; then
        curl -s --max-time 45 "${backend_url}/health" 2>/dev/null \
            | python3 -m json.tool 2>/dev/null \
            || echo "  (service starting or unavailable — cold start takes ~30-45s)"
    fi
}

# ─────────────────────────────────────────────────────────────
# teardown: delete everything
# ─────────────────────────────────────────────────────────────
cmd_teardown() {
    log "This will delete ALL aSDLC Cloud Run resources."
    read -rp "Are you sure? (yes/no): " confirm
    if [ "${confirm}" != "yes" ]; then
        log "Aborted."
        exit 0
    fi

    log "Deleting Cloud Run services..."
    gcloud run services delete asdlc-backend --region="${REGION}" --project="${PROJECT}" --quiet 2>/dev/null || true
    gcloud run services delete hitl-ui --region="${REGION}" --project="${PROJECT}" --quiet 2>/dev/null || true

    log "Deleting GCS bucket..."
    gsutil rm -r "gs://${BUCKET}" 2>/dev/null || true

    log "Deleting Artifact Registry images (keeping repository)..."
    for img in orchestrator workers review-swarm hitl-ui postgres-gcs; do
        gcloud artifacts docker images delete "${REGISTRY}/${img}" --quiet 2>/dev/null || true
    done

    log "Teardown complete. Secrets and Artifact Registry repository preserved."
    log "To fully clean up: gcloud artifacts repositories delete asdlc --location=${REGION} --project=${PROJECT}"
}

# ─────────────────────────────────────────────────────────────
# main
# ─────────────────────────────────────────────────────────────
CMD="${1:-all}"

case "${CMD}" in
    setup)    cmd_setup ;;
    build)    cmd_build ;;
    deploy)   cmd_deploy ;;
    status)   cmd_status ;;
    teardown) cmd_teardown ;;
    all)
        cmd_setup
        cmd_build
        cmd_deploy
        ;;
    *)
        echo "Usage: $0 {setup|build|deploy|status|teardown|all}"
        exit 1
        ;;
esac
