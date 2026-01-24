# Feature Design: P07-F01 Plane CE Kubernetes Deployment

## Overview

This feature adds Plane Community Edition to the Kubernetes deployment as a project/epic/task management tool. Plane CE is deployed in a dedicated namespace (`plane-ce`) separate from the main aSDLC namespace (`dox-asdlc`) to maintain clean separation of concerns and independent lifecycle management.

## Architecture Decision

**Separate Namespace with Integration Scripts** was selected because:
1. Plane CE has its own complex dependencies (PostgreSQL, Redis, MinIO, RabbitMQ)
2. Independent lifecycle management (upgrade/rollback without affecting aSDLC)
3. Clean separation of concerns - project management vs. aSDLC runtime
4. Official Helm chart provides tested configurations

## Dependencies

External dependencies:
- minikube 1.32+ or compatible Kubernetes cluster (running)
- Helm 3.12+ with `makeplane` repository added
- kubectl configured for the target cluster
- Recommended: 4 CPUs, 8GB RAM for minikube

Internal dependencies:
- P06-F01 (Kubernetes Base Infrastructure) - provides minikube scripts and deployment patterns

## Interfaces

### Provided Interfaces

**Plane CE Helm Deployment Scripts**
```bash
./scripts/k8s/add-plane-repo.sh    # Add Plane Helm repository
./scripts/k8s/deploy-plane.sh      # Deploy Plane CE to plane-ce namespace
./scripts/k8s/teardown-plane.sh    # Remove Plane CE deployment
```

**Integration with Main Deploy Script**
```bash
./scripts/k8s/deploy.sh --with-plane   # Deploy aSDLC with Plane CE
```

**Helm Values Configuration**
```
helm/plane-ce/values-minikube.yaml   # Minikube-optimized values
```

### Required Interfaces

**From P06-F01:**
- `./scripts/k8s/start-minikube.sh` - Cluster must be running
- Helm and kubectl must be available

## Technical Approach

### Namespace Isolation

Plane CE runs in a dedicated `plane-ce` namespace:
- Prevents resource conflicts with `dox-asdlc` namespace
- Allows independent PVC management for Plane's PostgreSQL, Redis, MinIO
- Enables separate resource quotas if needed

### Helm Repository

Official Plane Helm repository: `https://helm.plane.so/`
Chart name: `makeplane/plane-ce`

### Resource Configuration for Minikube

The values-minikube.yaml file configures Plane CE for local development:
- NodePort service for web access (avoids ingress complexity)
- Reduced persistence sizes (1Gi PostgreSQL, 512Mi Redis, 2Gi MinIO)
- Conservative resource limits (500m CPU, 512Mi memory per component)

### Access Pattern

For minikube, access is via NodePort:
```bash
minikube service plane-app-web -n plane-ce --url
```

## File Structure

```
helm/
└── plane-ce/
    └── values-minikube.yaml        # Minikube-specific values

scripts/k8s/
├── add-plane-repo.sh               # Add Plane Helm repo
├── deploy-plane.sh                 # Deploy Plane CE
├── teardown-plane.sh               # Remove Plane CE
└── deploy.sh                       # (modified) Add --with-plane flag
```

## Plane CE Components

When deployed, Plane CE creates the following pods:
- `plane-app-web` - Frontend web application
- `plane-app-api` - Backend API server
- `plane-app-worker` - Background job processor
- `plane-app-beat-worker` - Scheduled task processor
- `plane-app-postgresql` - PostgreSQL database
- `plane-app-redis` - Redis cache/queue
- `plane-app-minio` - Object storage (MinIO)
- `plane-app-rabbitmq` - Message queue (RabbitMQ)

## Open Questions

1. Whether to configure Plane CE authentication integration with aSDLC (future feature)
2. Backup strategy for Plane CE data in production environments

## Risks

**Risk 1: Resource constraints on developer machines**
Mitigation: Conservative resource limits in values-minikube.yaml. Document minimum requirements (4 CPUs, 8GB RAM).

**Risk 2: Plane CE Helm chart version compatibility**
Mitigation: Pin to stable chart version in deployment script. Document tested versions.

**Risk 3: Port conflicts with existing services**
Mitigation: Use high NodePort range (30080+) that doesn't conflict with dox-asdlc services.
