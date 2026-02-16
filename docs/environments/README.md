# aSDLC Environment Tiers

This project uses a tiered environment strategy optimized for different stages of development.

## Environment Overview

| Tier | Platform | Use Case | Speed | Cost |
|------|----------|----------|-------|------|
| **Workstation** | Bare metal (tmux + worktrees) | Agent dev, multi-session | Instant | Free |
| **Local Dev** | Docker Compose | Rapid iteration, debugging | Fast | Free |
| **Local Staging** | K8s (minikube) | K8s testing, Helm validation | Slow | Free |
| **Remote Lab** | GCP Cloud Run | Demos, quick deploys | Fast | Low |
| **Remote Staging** | GCP GKE | Pre-production, full K8s | Slow | Medium |

## When to Use Each Environment

### Workstation (Bare Metal)
- Multi-session agent development with tmux
- Hook telemetry and observability via SQLite + dashboard
- No container overhead, native file access
- Session management via `tmux-launcher.sh` and `list-sessions.sh`
- Observability via `start-dashboard.sh` (SQLite at `~/.asdlc/telemetry.db`)
- **Startup time:** instant

### Local Dev (Docker Compose)
- Day-to-day development
- UI hot reload with Vite
- Backend debugging
- Quick integration tests
- **Rebuild time:** seconds

### Local Staging (Minikube)
- Testing Helm charts
- Ingress configuration
- K8s-specific features (HPA, PDB)
- Pre-deploy validation
- **Rebuild time:** minutes

### Remote Lab (Cloud Run)
- Quick demos to stakeholders
- External testing
- Serverless deployment
- No K8s overhead
- **Deploy time:** ~1 minute

### Remote Staging (GKE)
- Production-like environment
- Load testing
- Full observability stack
- Multi-replica testing
- **Deploy time:** ~5 minutes

## Quick Reference

```bash
# Workstation
./scripts/sessions/tmux-launcher.sh p11-guardrails  # tmux multi-session
./scripts/telemetry/start-dashboard.sh               # observability dashboard

# Local Dev
cd docker && docker compose up -d

# Local Staging
minikube start -p dox-asdlc
helm upgrade --install dox-asdlc ./helm/dox-asdlc

# Remote Lab
gcloud run deploy

# Remote Staging
gcloud container clusters get-credentials dox-staging
helm upgrade --install dox-asdlc ./helm/dox-asdlc
```

## Detailed Guides

- [Workstation Observability](../observability/workstation.md)
- [Local Dev (Docker Compose)](./local-dev.md)
- [Local Staging (Minikube)](./local-staging.md)
- [Remote Lab (Cloud Run)](./remote-lab.md)
- [Remote Staging (GKE)](./remote-staging.md)
