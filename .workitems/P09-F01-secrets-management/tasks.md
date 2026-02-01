# P09-F01: Secrets Management - Tasks

## Status: In Progress

**Decision:** Option C - Hybrid with abstraction layer
**Decided:** 2026-02-01

---

## Tasks for Option C (Hybrid - Recommended)

### Phase 1: Infrastructure Setup ✅ COMPLETE

- [x] **T01**: Add Infisical to docker-compose.yml
  - Added infisical, postgres, redis services with `secrets` profile
  - Port 8086 for Infisical UI
  - Configured environment variables and volumes

- [x] **T02**: Create SecretsClient abstraction interface
  - Created `src/infrastructure/secrets/client.py`
  - Abstract methods: get_secret, list_secrets, set_secret, delete_secret, test_secret
  - Factory function `get_secrets_client()` based on SECRETS_BACKEND env var
  - EnvironmentSecretsClient as fallback implementation

- [x] **T03**: Implement InfisicalClient
  - Created `src/infrastructure/secrets/infisical_client.py`
  - Machine identity authentication with token caching
  - REST API integration for all methods
  - Special test_slack_token() that sends actual Slack test message

- [x] **T04**: Implement GCPSecretManagerClient
  - Created `src/infrastructure/secrets/gcp_client.py`
  - Uses google-cloud-secret-manager SDK
  - Support for both service account and ADC auth
  - Environment prefix convention (dev_, staging_)

### Phase 2: Service Integration (~3 hours)

- [x] **T05**: Update orchestrator to use SecretsClient
  - Added health check endpoint at `/api/integrations/health`
  - Returns status, backend type, and connection details
  - Added `backend_type` property to all SecretsClient implementations
  - Added `health_check()` method to SecretsClient (env, infisical, gcp)

- [x] **T06**: Update slack-bridge to use SecretsClient
  - Already implemented via `fetch_slack_credentials_from_secrets()`
  - Uses SecretsService which stores credentials in Redis
  - Fallback to env vars verified working

- [x] **T07**: Update workers to use SecretsClient
  - Added `src/workers/secrets_helper.py` with helper functions
  - `get_secret()` - async function with env var fallback
  - `get_secret_sync()` - sync version for non-async contexts
  - `get_multiple_secrets()` - batch fetch multiple secrets
  - `require_secret()` - raises if secret not found

### Phase 3: Admin UI Integration ✅ COMPLETE

- [x] **T08**: Update IntegrationCredentialsSection to show secrets source
  - Added `SecretsBackendBadge` component showing backend type (env/infisical/gcp)
  - Shows health status (healthy/degraded/unhealthy) with color coding
  - Calls `/api/integrations/health` endpoint

- [x] **T09**: Add Slack test message functionality
  - Added `TestResultDialog` component for detailed test results
  - Shows Slack-specific info: workspace, channel, timestamp of test message
  - Play button triggers `POST /api/integrations/test/SLACK_BOT_TOKEN`

- [x] **T10**: Add secret environment selector
  - Added `EnvironmentSelector` dropdown (dev/staging/prod/all)
  - UI ready for backend filtering when implemented

### Phase 4: Kubernetes Integration ⏸️ POSTPONED

> **Note:** K8s integration postponed per user request (2026-02-01). Will implement when needed.

- [ ] **T11**: Add Infisical K8s Operator to Helm chart
  - Create operator deployment
  - Configure secret sync CRDs
  - Document manual GCP alternative

- [ ] **T12**: Update service deployments
  - Remove hardcoded secret env vars
  - Reference synced K8s Secrets

### Phase 5: Migration & Documentation (~2 hours)

- [x] **T13**: Create secrets migration script
  - Created `scripts/secrets/migrate_secrets.py` with full CLI
  - Supports --source (redis, json-file), --target (infisical, gcp)
  - Supports --environment (dev, staging, prod) and --dry-run
  - Exports to JSON with masked values for security
  - Verifies all secrets accessible after migration
  - Tests: 20 unit tests in `tests/unit/infrastructure/secrets_service/test_migrate_secrets.py`

- [x] **T14**: Update documentation
  - Created `docs/secrets-management.md` with three sections:
  - Developer setup guide (backend selection, env vars, Infisical setup, seeding, migration)
  - Admin operations guide (UI usage, credential testing, health monitoring, caching behavior)
  - Troubleshooting guide (common errors, verification steps, debug logging)

- [x] **T15**: Add secrets seeding for new devs
  - Created `scripts/secrets/seed_dev_secrets.py` with full CLI
  - Created `scripts/secrets/dev-secrets.template.yaml` with all required secrets
  - Required secrets: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET, ANTHROPIC_API_KEY
  - Optional secrets: OPENAI_API_KEY, GOOGLE_AI_API_KEY, GITHUB_TOKEN
  - Supports --skip-existing, --no-interactive, --template-file options
  - Tests: 19 unit tests in `tests/unit/infrastructure/secrets_service/test_seed_dev_secrets.py`

---

## Tasks for Option A (Infisical Only)

Same as Phase 1-5 above, minus T04 (GCP client).

---

## Tasks for Option B (GCP Secret Manager Only)

### Phase 1: GCP Setup (~2 hours)

- [ ] **T01**: Create GCP Secret Manager secrets
  - Create project or use existing
  - Create secrets for all credentials
  - Set up IAM policies

- [ ] **T02**: Create SecretsClient with GCP backend only
  - Implement GCPSecretManagerClient
  - No abstraction needed if GCP-only

### Phase 2-5: Same as hybrid, minus Infisical-specific tasks

---

## Estimation Summary

| Option | Estimated Hours | Complexity |
|--------|-----------------|------------|
| Option A (Infisical) | ~12 hours | Medium |
| Option B (GCP) | ~10 hours | Low |
| Option C (Hybrid) | ~14 hours | Medium-High |

---

## Dependencies

- Docker Compose must support new services
- GCP project access (for Option B/C)
- Admin UI running (for Phase 3)
