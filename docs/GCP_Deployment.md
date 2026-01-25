# GCP Cloud Run Deployment

This guide covers deploying aSDLC services to Google Cloud Platform using Cloud Run.

## Prerequisites

- GCP project with billing enabled
- `gcloud` CLI installed and authenticated
- Docker with buildx support
- Artifact Registry API enabled
- Cloud Run API enabled

## Quick Start

```bash
# Authenticate with GCP
gcloud auth login
gcloud config set project <your-project-id>

# Enable required APIs
gcloud services enable artifactregistry.googleapis.com
gcloud services enable run.googleapis.com
```

## Services

| Service | Description | Mock Mode Support |
|---------|-------------|-------------------|
| hitl-ui | Human-in-the-Loop Web UI | Yes |
| orchestrator | Governance and coordination | No |
| workers | Agent execution pool | No |

## HITL-UI Deployment

### 1. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create <repo-name> \
  --repository-format=docker \
  --location=us-central1 \
  --description="aSDLC container images"
```

### 2. Configure Docker Authentication

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 3. Build and Push Image

**For Mock Mode (no backend required):**

```bash
docker buildx build --platform linux/amd64 \
  -f docker/hitl-ui/Dockerfile \
  -t us-central1-docker.pkg.dev/<project>/<repo>/hitl-ui:latest \
  --build-arg VITE_USE_MOCKS=true \
  --push .
```

**For Production Mode (requires backend services):**

```bash
docker buildx build --platform linux/amd64 \
  -f docker/hitl-ui/Dockerfile \
  -t us-central1-docker.pkg.dev/<project>/<repo>/hitl-ui:latest \
  --build-arg VITE_API_BASE_URL=https://your-api-url \
  --push .
```

### 4. Deploy to Cloud Run

```bash
gcloud run deploy hitl-ui \
  --image=us-central1-docker.pkg.dev/<project>/<repo>/hitl-ui:latest \
  --platform=managed \
  --region=us-central1 \
  --port=3000 \
  --allow-unauthenticated
```

### 5. Verify Deployment

```bash
# Get service URL
gcloud run services describe hitl-ui --region=us-central1 --format='value(status.url)'

# Test health
curl -s -o /dev/null -w "%{http_code}" $(gcloud run services describe hitl-ui --region=us-central1 --format='value(status.url)')
```

## Build Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `VITE_USE_MOCKS` | Enable mock data mode | `false` |
| `VITE_API_BASE_URL` | Backend API URL | `/api` |

## Architecture Considerations

### Mock Mode

When `VITE_USE_MOCKS=true`:
- No backend services required
- Uses simulated data for gates, sessions, workers
- Suitable for demos and UI development
- All API calls return mock responses

### Production Mode

When connecting to real backend:
- Requires orchestrator and workers deployed
- Requires Redis for state management
- Requires Elasticsearch for knowledge store
- Set `VITE_API_BASE_URL` to orchestrator URL

## Multi-Architecture Builds

Cloud Run requires `linux/amd64` images. If building on Apple Silicon (M1/M2/M3):

```bash
# Use buildx with platform flag
docker buildx build --platform linux/amd64 ...

# Or create a dedicated builder
docker buildx create --name amd64-builder --platform linux/amd64
docker buildx use amd64-builder
```

## Environment Variables

Cloud Run environment variables can be set during deployment:

```bash
gcloud run deploy hitl-ui \
  --image=... \
  --set-env-vars="NODE_ENV=production,LOG_LEVEL=info"
```

## Resource Configuration

```bash
gcloud run deploy hitl-ui \
  --image=... \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80
```

## Custom Domain

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service=hitl-ui \
  --domain=hitl.yourdomain.com \
  --region=us-central1
```

## Cleanup

```bash
# Delete Cloud Run service
gcloud run services delete hitl-ui --region=us-central1

# Delete container images
gcloud artifacts docker images delete \
  us-central1-docker.pkg.dev/<project>/<repo>/hitl-ui
```

## Troubleshooting

### Exec Format Error

If you see `exec format error` in Cloud Run logs:
- Image was built for wrong architecture (ARM instead of AMD64)
- Rebuild with `--platform linux/amd64`

### Container Fails to Start

Check logs:
```bash
gcloud run services logs read hitl-ui --region=us-central1
```

### 502 Bad Gateway

- Verify the port matches (default: 3000)
- Check container health endpoint
- Review startup logs for errors

## Current Deployment

| Property | Value |
|----------|-------|
| Project | cursor-sim |
| Region | us-central1 |
| Service | hitl-ui |
| URL | https://hitl-ui-101653240374.us-central1.run.app |
| Mode | Mock (VITE_USE_MOCKS=true) |
