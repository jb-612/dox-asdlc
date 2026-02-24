---
id: P15-F08
parent_id: P15
type: prd
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
dependencies: []
tags:
  - settings
  - ai-providers
  - electron
  - safeStorage
  - redesign
---

# PRD: Settings — Complete Redesign (P15-F08)

## Business Intent

The current Settings page is a flat list of miscellaneous fields with no clear organizational
model. As the Workflow Studio grows to support multiple AI providers (Anthropic, OpenAI, Google,
Azure OpenAI) and richer node configuration, the settings surface must reflect this multi-provider
reality. This redesign establishes Settings as the authoritative source of provider credentials
and model preferences for the entire application.

The redesign also closes a security gap: API keys are currently stored in plaintext JSON on disk.
This feature introduces `electron.safeStorage` encryption so keys are protected at rest using the
OS credential store.

## Success Metrics

| Metric | Target |
|--------|--------|
| All 4 providers configurable from Settings | 100% |
| API keys encrypted at rest via `safeStorage` | 100% (with graceful degradation on unsupported platforms) |
| "Test Connection" returns result within 15 seconds | p95 < 15s |
| API key value never present in renderer JS memory after save | Verified by code review |
| Provider config readable via IPC by Studio Block Composer (F01) | `SETTINGS_LOAD` returns `providers` field |
| All new IPC handlers covered by tests | ≥ 1 test per handler |
| Settings page navigable with keyboard alone | Tab-order complete |

## User Impact

| User | Impact |
|------|--------|
| Workflow author | Single place to configure all AI provider keys and model defaults |
| Developer / operator | API keys stored encrypted; no more plaintext in JSON config |
| Studio Block Composer (F01) | Reads model/temperature/max-tokens from Settings IPC |

## Scope

### In Scope

- Complete replacement of `SettingsPage.tsx` with tabbed layout (AI Providers / Environment / About)
- `ProviderCard` component for each of 4 providers (Anthropic, OpenAI, Google, Azure OpenAI)
- `ApiKeyStore` class using `electron.safeStorage` in the main process
- "Test Connection" IPC handler per provider (main-process fetch, key never in renderer)
- `ModelParamsForm` component: temperature slider + max tokens input per provider
- `EnvironmentSection`: Docker socket path, default repo mount, workspace dir, agent timeout
- `AboutSection`: app/Electron/Node version display
- Extended `AppSettings` type with `providers: Record<ProviderId, ProviderConfig>`
- 5 new IPC channels: `settings:set-api-key`, `settings:delete-api-key`,
  `settings:get-key-status`, `settings:test-provider`, `settings:get-version`
- Migration: existing flat settings fields retained (no breaking changes to consumers)

### Out of Scope

- Per-node model overrides in the workflow canvas (separate feature)
- Organization/team settings (multi-user access control)
- Settings import/export (future)
- OAuth-based authentication for providers (future)
- Provider usage/cost tracking (future)

## Constraints

- `electron.safeStorage` requires Electron ≥ 15; project already satisfies this
- Azure OpenAI requires both endpoint URL and API key; "Test Connection" must validate both are present
- The renderer must never receive API key values via IPC (security boundary)
- Legacy `AppSettings` fields must be preserved to avoid breaking the Execute tab and workflow engine

## Acceptance Criteria

1. Settings page renders with three tabs: AI Providers, Environment, About
2. Each of the 4 provider cards shows: API key field (masked), default model dropdown, temperature slider, max tokens input
3. Entering a valid API key and clicking "Save Key" stores it encrypted; page shows "Key saved ✓" badge
4. Clicking "Test Connection" for a configured provider returns success or a human-readable error within 15s
5. `AppSettings.providers` is persisted in `electron-config.json` (excluding key values)
6. API keys are stored in `api-keys.json` as base64-encoded `safeStorage.encryptString()` output
7. `SETTINGS_LOAD` returns `Record<ProviderId, { hasKey: boolean }>` (never key values)
8. Azure OpenAI "Test Connection" button is disabled when `azureEndpoint` is empty
9. `EnvironmentSection` includes: Docker socket path, default repo mount, workspace directory, agent timeout
10. `AboutSection` displays app version, Electron version, Node.js version
11. All new IPC handlers have at least one passing unit test
12. Existing settings (workflowDirectory, redisUrl, cursorAgentUrl, executionMockMode) continue to work
