---
name: deploy
description: Deploy aSDLC to any environment tier — Cloud Run, K8s, or local. Use when deploying, updating, or tearing down environments.
argument-hint: "[environment-tier]"
disable-model-invocation: true
---

Deploy to environment $ARGUMENTS:

## When to Use

- Deploying to any environment tier (workflow step 10)
- Updating existing deployments
- Tearing down environments

## Environment Menu

| Tier | Script | Command |
|------|--------|---------|
| Local Dev | Docker Compose | `cd docker && docker compose up -d` |
| Local Staging | K8s (minikube) | `./scripts/k8s/deploy.sh` |
| Remote Lab | GCP Cloud Run | `./scripts/gcp/deploy-cloud-run.sh all` |
| Teardown K8s | Helm uninstall | `./scripts/k8s/teardown.sh` |
| Teardown Cloud Run | GCP cleanup | `./scripts/gcp/deploy-cloud-run.sh teardown` |

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `deploy-cloud-run.sh` | GCP Cloud Run deploy | `./scripts/gcp/deploy-cloud-run.sh {setup\|build\|deploy\|all}` |
| `deploy-k8s.sh` | Helm deploy to K8s | `./scripts/k8s/deploy.sh [--wait]` |
| `teardown-k8s.sh` | Remove K8s deployment | `./scripts/k8s/teardown.sh [--delete-data]` |
| `build-images.sh` | Build Docker images | `./scripts/build-images.sh [--minikube\|--push]` |

## Pre-Deploy Checklist

1. Run `@testing` quality gates first
2. Verify all tests pass
3. Check environment prerequisites (Docker, kubectl, gcloud)

## Cross-References

- `@testing` — Run tests before deploy
- See `docs/environments/README.md` for full environment guides
