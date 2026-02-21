# GitHub Actions — GCP Cloud Run Deployment

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `deploy-cloud-run.yml` | Push to `main` or manual | Build images, deploy to Cloud Run |
| `teardown-cloud-run.yml` | Manual only | Delete Cloud Run services and optionally clean up |

## Prerequisites

### 1. GCP Workload Identity Federation (keyless auth)

No service account keys needed. Set up Workload Identity Federation between
GitHub Actions and your GCP project:

```bash
export PROJECT_ID=your-gcp-project
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export GITHUB_ORG=your-github-org   # or username
export GITHUB_REPO=dox-asdlc

# Create Workload Identity Pool
gcloud iam workload-identity-pools create github-actions \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions"

# Create OIDC Provider
gcloud iam workload-identity-pools providers create-oidc github \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-actions \
  --display-name="GitHub" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Create Service Account for deployments
gcloud iam service-accounts create github-deployer \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions Deployer"

SA_EMAIL="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant required roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# Allow GitHub Actions to impersonate the SA
gcloud iam service-accounts add-iam-policy-binding ${SA_EMAIL} \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"

# Print the provider ID (needed for GitHub)
echo "Workload Identity Provider:"
echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions/providers/github"
echo ""
echo "Service Account:"
echo "${SA_EMAIL}"
```

### 2. GitHub Repository Variables

Go to **Settings > Secrets and variables > Actions > Variables** and add:

| Variable | Value | Example |
|----------|-------|---------|
| `GCP_PROJECT_ID` | Your GCP project ID | `my-project-123` |
| `GCP_REGION` | Deployment region | `us-central1` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | From step 1 | `projects/123/locations/global/workloadIdentityPools/github-actions/providers/github` |
| `GCP_SERVICE_ACCOUNT` | From step 1 | `github-deployer@my-project-123.iam.gserviceaccount.com` |

### 3. GCP Secrets (one-time setup)

Create secrets in GCP Secret Manager before first deploy:

```bash
echo -n "your-pg-password" | gcloud secrets create postgres-password --data-file=-
echo -n "your-anthropic-key" | gcloud secrets create anthropic-api-key --data-file=-
echo -n "your-encryption-key" | gcloud secrets create llm-encryption-key --data-file=-
```

### 4. GCS Bucket and Artifact Registry (one-time setup)

Run setup once before first deploy:

```bash
export PROJECT=your-gcp-project
./scripts/gcp/deploy-cloud-run.sh setup
```

Or let the first pipeline run handle it (the deploy step creates the service YAML
which references the bucket; bucket must exist).

## Usage

### Auto-deploy on push to main

Any push to `main` that changes `src/`, `docker/`, `scripts/gcp/`, or the
workflow file triggers a full build + deploy.

### Manual deploy

Go to **Actions > Deploy to GCP Cloud Run > Run workflow**.

Options:
- **skip_build**: Redeploy existing images without rebuilding (fast redeploy)

### Manual teardown

Go to **Actions > Teardown GCP Cloud Run > Run workflow**.

Type `destroy` to confirm. Optionally delete GCS bucket and/or Artifact Registry images.

## Pipeline Flow

```
push to main
  │
  ├─► [build] Build 5 Docker images in parallel
  │     ├── orchestrator
  │     ├── workers
  │     ├── review-swarm
  │     ├── hitl-ui
  │     └── postgres-gcs
  │     Tags: :latest + :sha
  │     Cache: GitHub Actions cache (layer caching)
  │
  ├─► [deploy-backend] Deploy multi-container Cloud Run service
  │     ├── Generate service YAML from template
  │     ├── gcloud run services replace
  │     ├── Set IAM (allUsers invoker for demo)
  │     └── Output backend URL
  │
  ├─► [deploy-hitl-ui] Deploy standalone Cloud Run service
  │     ├── gcloud run deploy
  │     └── Output frontend URL
  │
  └─► [smoke-test] Verify deployment
        ├── Health check backend (retries for cold start)
        ├── Health check frontend
        └── Print summary with URLs
```

## Cost Impact

The pipeline itself runs on GitHub-hosted runners (free for public repos,
2000 min/month for private). GCP costs are only for the deployed services
(see `docs/environments/gcp-cloud-run-deployment.md`).
