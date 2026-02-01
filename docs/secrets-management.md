# Secrets Management

Centralized secrets management for aSDLC services.

## 1. Developer Setup Guide

### Backend Selection

Set the `SECRETS_BACKEND` environment variable to choose your secrets backend:

| Backend | Value | Use Case |
|---------|-------|----------|
| Environment Variables | `env` | Simple local dev, CI/CD |
| Infisical (cached) | `caching` | Hybrid: GCP primary + Infisical fallback |
| Infisical only | `infisical` | Self-hosted, offline-capable |
| GCP Secret Manager | `gcp` | Cloud-native, managed |

**Default:** `env` (environment variables)

### Environment Variables by Backend

#### For `caching` Backend (GCP Primary + Infisical Cache)

```bash
# GCP credentials (primary source of truth)
export GCP_PROJECT_ID=your-gcp-project
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# Or use: gcloud auth application-default login

# Infisical credentials (offline cache)
export INFISICAL_URL=http://localhost:8086
export INFISICAL_CLIENT_ID=your-client-id
export INFISICAL_CLIENT_SECRET=your-client-secret
export INFISICAL_PROJECT_ID=your-project-id
```

#### For `infisical` Backend

```bash
export INFISICAL_URL=http://localhost:8086
export INFISICAL_CLIENT_ID=your-client-id
export INFISICAL_CLIENT_SECRET=your-client-secret
export INFISICAL_PROJECT_ID=your-project-id
```

#### For `gcp` Backend

```bash
export GCP_PROJECT_ID=your-gcp-project

# Option 1: Service account key file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Option 2: Application Default Credentials
gcloud auth application-default login
```

#### For `env` Backend

No additional configuration needed. Secrets are read directly from environment variables.

### Starting Infisical Locally

```bash
cd docker && docker compose --profile secrets up -d
```

This starts:
- Infisical server at http://localhost:8086
- PostgreSQL database for Infisical
- Redis cache for Infisical

First-time setup:
1. Access http://localhost:8086
2. Create admin account
3. Create a project
4. Generate machine identity credentials (Settings > Machine Identities)
5. Copy Client ID and Client Secret

### Seeding Development Secrets

For new developers, seed initial secrets:

```bash
python scripts/secrets/seed_dev_secrets.py --target infisical
```

Options:
- `--target` - Backend to seed: `infisical`, `gcp`, or `env`
- `--environment` - Target environment: `dev`, `staging`, `prod`
- `--skip-existing` - Don't overwrite existing secrets
- `--no-interactive` - Use defaults, no prompts
- `--template-file` - Custom template (default: `dev-secrets.template.yaml`)

Required secrets:
- `SLACK_BOT_TOKEN` - Slack bot OAuth token
- `SLACK_APP_TOKEN` - Slack app-level token (for Socket Mode)
- `SLACK_SIGNING_SECRET` - Slack request signing secret
- `ANTHROPIC_API_KEY` - Anthropic Claude API key

Optional secrets:
- `OPENAI_API_KEY` - OpenAI API key
- `GOOGLE_AI_API_KEY` - Google AI API key
- `GITHUB_TOKEN` - GitHub personal access token

### Migrating Existing Secrets

To migrate secrets from one backend to another:

```bash
# Migrate from Redis to Infisical
python scripts/secrets/migrate_secrets.py --source redis --target infisical

# Migrate from JSON file to GCP
python scripts/secrets/migrate_secrets.py --source json-file --target gcp --source-file ./secrets.json

# Dry run (preview without changes)
python scripts/secrets/migrate_secrets.py --source redis --target infisical --dry-run

# Specific environment
python scripts/secrets/migrate_secrets.py --source redis --target infisical --environment staging
```

---

## 2. Admin Operations Guide

### Using the Admin UI

Navigate to **Admin > LLM** in the HITL UI to manage integration credentials.

#### Viewing Credentials

- Credentials are grouped by integration type (Slack, GitHub, etc.)
- Each credential shows:
  - Name and type
  - Masked value (e.g., `xoxb-...xyz`)
  - Source badge: **ENV** / **Infisical** / **GCP**
  - Status: Valid / Invalid / Untested

#### Testing Credentials

Click the play button next to any credential to test it:

- **Slack Bot Token**: Sends a test message to the configured channel
  - Shows workspace name on success
  - Displays channel and message timestamp
- **Other credentials**: Validates format and connectivity

Test results appear in a dialog with:
- Success/failure status
- Detailed error message if failed
- Slack-specific info: workspace, channel, timestamp

#### Environment Selector

Use the environment dropdown to filter credentials:
- **Development** - Local dev secrets
- **Staging** - Pre-production secrets
- **Production** - Live secrets
- **All** - Show all environments

### Backend Health Monitoring

Check backend health at:

```
GET /api/integrations/health
```

Response:

```json
{
  "status": "healthy",
  "backend": "gcp",
  "using_cache": false,
  "details": {
    "project_id": "your-project"
  }
}
```

Status values:
- `healthy` - Backend fully operational
- `degraded` - Running with fallback (e.g., cached secrets)
- `unhealthy` - Backend unavailable

When using caching backend:

```json
{
  "status": "degraded",
  "backend": "infisical",
  "using_cache": true,
  "primary": {
    "status": "unhealthy",
    "error": "GCP connection failed"
  },
  "cache": {
    "status": "healthy",
    "last_sync": "2026-02-01T10:30:00Z"
  }
}
```

### Caching Backend Behavior

When `SECRETS_BACKEND=caching`:

| Operation | GCP Available | GCP Unavailable |
|-----------|---------------|-----------------|
| Read secret | GCP (updates cache) | Infisical cache |
| Write secret | GCP + Infisical | **Blocked** (error) |
| List secrets | GCP | Infisical cache |
| Delete secret | GCP + Infisical | **Blocked** (error) |

**Important:** Write operations require GCP connectivity. The caching backend provides read resilience only.

---

## 3. Troubleshooting Guide

### Common Issues

#### "GCP unavailable, using cached secrets"

**Cause:** GCP Secret Manager is unreachable.

**Check:**
1. Verify GCP credentials:
   ```bash
   gcloud auth application-default print-access-token
   ```
2. Check project ID:
   ```bash
   echo $GCP_PROJECT_ID
   ```
3. Verify IAM permissions (need `secretmanager.secretAccessor` role)

**Resolution:** Fix GCP credentials or continue with cached secrets (read-only).

#### "Cannot set secret: GCP unavailable"

**Cause:** Attempting to write secrets while GCP is unreachable.

**Resolution:** Write operations require GCP connectivity. Either:
- Fix GCP connection
- Switch to `infisical` backend temporarily

#### "Infisical connection failed"

**Cause:** Infisical server is not running or unreachable.

**Check:**
1. Verify containers are running:
   ```bash
   docker compose ps | grep infisical
   ```
2. Check Infisical health:
   ```bash
   curl http://localhost:8086/api/status
   ```
3. Verify credentials:
   ```bash
   echo $INFISICAL_URL
   echo $INFISICAL_CLIENT_ID
   ```

**Resolution:**
```bash
cd docker && docker compose --profile secrets up -d
```

### Verifying Active Backend

Check which backend is currently active:

```bash
curl http://localhost:8080/api/integrations/health | jq
```

Or programmatically:

```python
from src.infrastructure.secrets.client import get_secrets_client

client = get_secrets_client()
print(f"Backend: {client.backend_type}")
```

### Checking Cache Status

When using the caching backend, verify cache status:

```bash
curl http://localhost:8080/api/integrations/health | jq '.using_cache'
```

If `using_cache` is `true`:
- You are running from Infisical cache
- GCP is unavailable
- Write operations will fail
- Data may be stale (check `cache.last_sync`)

### Resetting Secrets State

To clear and reseed secrets:

```bash
# Clear Infisical secrets (via UI or API)
# Then reseed:
python scripts/secrets/seed_dev_secrets.py --target infisical

# For GCP, delete and recreate via console or gcloud
gcloud secrets delete SECRET_NAME --quiet
python scripts/secrets/seed_dev_secrets.py --target gcp
```

### Debug Logging

Enable debug logging for secrets operations:

```bash
export LOG_LEVEL=DEBUG
```

This logs:
- Backend selection logic
- Secret access attempts
- Cache hits/misses
- Authentication attempts
