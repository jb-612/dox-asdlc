# P09-F01: Secrets Management Infrastructure

## Problem Statement

The current secrets implementation (`src/infrastructure/secrets/service.py`) uses local file-based storage with encryption. This approach has limitations:

1. **No centralized management** - Secrets scattered across env vars and config files
2. **No audit trail** - Can't track who accessed what secrets when
3. **Environment drift** - Hard to sync secrets across dev/staging/prod
4. **No rotation support** - Manual process to rotate credentials
5. **Limited access control** - File-based permissions only

## Requirements

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Centralized secret storage | Must | Single source of truth |
| Environment scoping | Must | dev/staging/prod isolation |
| Python SDK | Must | Orchestrator integration |
| Docker-native | Must | Local dev support |
| Audit logging | Should | Compliance/debugging |
| Secret rotation | Should | Automated credential refresh |
| UI for management | Should | Admin page integration |
| K8s native injection | Should | No code changes for K8s deploys |
| Cost-effective | Should | Free tier or low cost |

## Option A: Infisical (Self-Hosted)

### Overview

Infisical is an open-source secrets management platform. Self-hosted version is fully featured and free.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Docker Compose (Local Dev)                                      │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Infisical    │  │ PostgreSQL   │  │ Redis        │          │
│  │ Server       │─▶│ (secrets)    │  │ (cache)      │          │
│  │ :8080        │  └──────────────┘  └──────────────┘          │
│  └──────┬───────┘                                               │
│         │ REST API / SDK                                        │
│  ┌──────┴───────────────────────────────────────────┐          │
│  │                                                   │          │
│  ▼                  ▼                  ▼             │          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │          │
│  │ Orchestrator │  │ Slack Bridge │  │ Workers    │ │          │
│  │ Python SDK   │  │ Python SDK   │  │ Python SDK │ │          │
│  └──────────────┘  └──────────────┘  └────────────┘ │          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Kubernetes (Staging/Prod)                                       │
│                                                                  │
│  ┌──────────────┐                                               │
│  │ Infisical    │  (Can use same instance or separate)          │
│  │ Operator     │─────▶ Syncs secrets to K8s Secrets            │
│  └──────────────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Orchestrator │  │ Slack Bridge │  │ Workers      │          │
│  │ (K8s Secret) │  │ (K8s Secret) │  │ (K8s Secret) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Pros

- **Free & open source** - No licensing costs
- **Full-featured UI** - Web dashboard for secret management
- **Python SDK** - Native `infisical-python` package
- **K8s Operator** - Auto-sync to K8s Secrets
- **Environment support** - Built-in dev/staging/prod scoping
- **Audit logs** - Track all secret access
- **Secret versioning** - History and rollback
- **E2E encryption** - Secrets encrypted at rest and in transit

### Cons

- **Self-hosted overhead** - Must maintain PostgreSQL + Redis
- **Learning curve** - New tool for team
- **Resource usage** - ~500MB RAM for full stack

### Docker Compose Addition

```yaml
# docker/docker-compose.yml addition
services:
  infisical:
    image: infisical/infisical:latest
    ports:
      - "8085:8080"
    environment:
      - ENCRYPTION_KEY=${INFISICAL_ENCRYPTION_KEY}
      - AUTH_SECRET=${INFISICAL_AUTH_SECRET}
      - POSTGRES_HOST=infisical-db
      - REDIS_URL=redis://infisical-redis:6379
    depends_on:
      - infisical-db
      - infisical-redis

  infisical-db:
    image: postgres:15-alpine
    volumes:
      - infisical-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=infisical
      - POSTGRES_USER=infisical
      - POSTGRES_PASSWORD=${INFISICAL_DB_PASSWORD}

  infisical-redis:
    image: redis:7-alpine

volumes:
  infisical-data:
```

### Python Integration

```python
from infisical_client import InfisicalClient

client = InfisicalClient(
    client_id="YOUR_CLIENT_ID",
    client_secret="YOUR_CLIENT_SECRET",
)

# Get a secret
secret = client.get_secret(
    secret_name="SLACK_BOT_TOKEN",
    environment="dev",
    project_id="asdlc",
)

# List all secrets for an environment
secrets = client.list_secrets(
    environment="dev",
    project_id="asdlc",
)
```

### Cost

| Component | Local Dev | Staging | Production |
|-----------|-----------|---------|------------|
| Infisical Server | Free | Free | Free |
| PostgreSQL | Existing | Existing | Existing |
| Redis | Existing | Existing | Existing |
| **Total** | **$0** | **$0** | **$0** |

---

## Option B: GCP Secret Manager

### Overview

Google Cloud Secret Manager is a fully managed service for storing API keys, passwords, and other sensitive data.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Local Dev (Docker Compose)                                      │
│                                                                  │
│  ┌──────────────┐                                               │
│  │ GCP Auth     │  Service account key or ADC                   │
│  │ (JSON key)   │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼ google-cloud-secret-manager SDK                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Orchestrator │  │ Slack Bridge │  │ Workers      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                    │
└─────────┼─────────────────┼─────────────────┼────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  GCP Secret Manager (Cloud)                                      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Project: asdlc-dev                                         │ │
│  │                                                            │ │
│  │ Secrets:                                                   │ │
│  │   - SLACK_BOT_TOKEN                                        │ │
│  │   - SLACK_APP_TOKEN                                        │ │
│  │   - SLACK_SIGNING_SECRET                                   │ │
│  │   - ANTHROPIC_API_KEY                                      │ │
│  │   - OPENAI_API_KEY                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  IAM Policies:                                                   │
│    - dev-service-account: secretmanager.secretAccessor          │
│    - staging-service-account: secretmanager.secretAccessor      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  GKE (Staging/Prod)                                              │
│                                                                  │
│  ┌──────────────┐                                               │
│  │ Workload     │  Automatic via GKE Workload Identity          │
│  │ Identity     │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Orchestrator │  │ Slack Bridge │  │ Workers      │          │
│  │ (SDK)        │  │ (SDK)        │  │ (SDK)        │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Pros

- **Fully managed** - No infrastructure to maintain
- **GKE native** - Workload Identity integration (no keys in K8s)
- **IAM integration** - Fine-grained access control
- **Audit logging** - Cloud Audit Logs built-in
- **Automatic replication** - Multi-region by default
- **Version history** - Built-in versioning
- **Already using GCP** - Fits existing infrastructure

### Cons

- **Requires GCP auth locally** - Service account key or `gcloud auth`
- **No UI in project** - Must use GCP Console (not Admin page)
- **Cost for access** - $0.06 per 10,000 operations
- **Internet required** - Can't work fully offline
- **Vendor lock-in** - GCP-specific APIs

### Python Integration

```python
from google.cloud import secretmanager

client = secretmanager.SecretManagerServiceClient()

def get_secret(secret_id: str, project_id: str = "asdlc-dev") -> str:
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

# Usage
slack_token = get_secret("SLACK_BOT_TOKEN")
```

### Local Dev Setup

```bash
# Option 1: Service account key (less secure)
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Option 2: Application Default Credentials (recommended)
gcloud auth application-default login
```

### Cost Estimate

| Operation | Price | Monthly Est. (10 devs, 50 secrets) |
|-----------|-------|-----------------------------------|
| Secret versions | $0.06/version/month | $3.00 |
| Access operations | $0.03/10,000 | $0.30 |
| **Total** | | **~$3-5/month** |

---

## Comparison Matrix

| Criteria | Infisical | GCP Secret Manager |
|----------|-----------|-------------------|
| **Setup Complexity** | Medium (Docker stack) | Low (SDK only) |
| **Maintenance** | Self-managed | Fully managed |
| **Local Dev** | Full offline support | Requires GCP auth |
| **K8s Integration** | Operator (manual setup) | Workload Identity (native) |
| **UI** | Built-in web UI | GCP Console |
| **Admin Page Integration** | Easy (REST API) | Requires proxy |
| **Audit Logging** | Built-in | Cloud Audit Logs |
| **Cost** | $0 (self-hosted) | ~$3-5/month |
| **Vendor Lock-in** | None | GCP |
| **Offline Development** | Yes | No |

---

## Recommendation

### For This Project: **Hybrid Approach**

Given the existing infrastructure and requirements, I recommend:

1. **Use Infisical for Local Dev & Admin UI**
   - Self-hosted in Docker Compose
   - Integrates with existing Admin/LLM page
   - Works offline
   - Free

2. **Use GCP Secret Manager for Staging/Prod (optional)**
   - Native GKE Workload Identity
   - No secrets in K8s manifests
   - Managed service
   - Can sync from Infisical via CI/CD

### Migration Path

```
Phase 1: Infisical Setup (Local Dev)
├── Add Infisical to docker-compose.yml
├── Create SecretsClient abstraction
├── Migrate existing secrets
└── Update Admin/LLM page to use Infisical API

Phase 2: Service Integration
├── Update orchestrator to use SecretsClient
├── Update slack-bridge to use SecretsClient
├── Update workers to use SecretsClient
└── Remove old secrets service

Phase 3: GCP Integration (Optional)
├── Set up GCP Secret Manager
├── Add GCP backend to SecretsClient
├── Configure Workload Identity for GKE
└── Sync secrets via CI/CD
```

### Abstraction Layer

To support both backends, create a unified interface:

```python
# src/infrastructure/secrets/client.py

from abc import ABC, abstractmethod
from typing import Optional

class SecretsClient(ABC):
    @abstractmethod
    async def get_secret(self, name: str, environment: str = "dev") -> str:
        """Get a secret value by name."""
        pass

    @abstractmethod
    async def list_secrets(self, environment: str = "dev") -> list[str]:
        """List all secret names."""
        pass

    @abstractmethod
    async def set_secret(self, name: str, value: str, environment: str = "dev") -> None:
        """Create or update a secret."""
        pass

class InfisicalClient(SecretsClient):
    """Infisical backend for local dev and self-hosted."""
    pass

class GCPSecretManagerClient(SecretsClient):
    """GCP Secret Manager backend for cloud environments."""
    pass

def get_secrets_client() -> SecretsClient:
    """Factory function - returns appropriate client based on environment."""
    backend = os.environ.get("SECRETS_BACKEND", "infisical")
    if backend == "gcp":
        return GCPSecretManagerClient()
    return InfisicalClient()
```

---

## Decision Required

Please choose:

- [ ] **Option A**: Infisical only (simpler, fully self-hosted)
- [ ] **Option B**: GCP Secret Manager only (managed, cloud-native)
- [ ] **Option C**: Hybrid with abstraction layer (recommended, flexible)

## Next Steps After Decision

1. Create detailed tasks.md based on chosen option
2. Implement infrastructure changes
3. Migrate existing secrets
4. Update all services to use new client
5. Update Admin/LLM page UI
6. Document operational procedures
