---
id: P15-F08
parent_id: P15
type: tasks
version: 1
status: complete
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
---

# Tasks: Settings — Complete Redesign (P15-F08)

## Progress

- Started: 2026-02-22
- Tasks Complete: 15/15
- Percentage: 100%
- Status: COMPLETE

---

### T01: Replace AppSettings type and add provider types

- [x] Estimate: 1hr
- [x] Tests: TypeScript compiles with no errors; existing consumers still typecheck
- [x] Dependencies: None
- [x] Agent: frontend
- [x] Notes:
  Replace `apps/workflow-studio/src/shared/types/settings.ts`:
  - Add `ProviderId`, `ProviderConfig`, `ProviderModelParams` types
  - Add `PROVIDER_MODELS`, `MODEL_CONTEXT_WINDOW` constants
  - Extend `AppSettings` with `providers: Record<ProviderId, ProviderConfig>` and environment fields
    (`dockerSocketPath`, `defaultRepoMountPath`, `workspaceDirectory`, `agentTimeoutSeconds`)
  - Retain all existing fields unchanged (`workflowDirectory`, `redisUrl`, etc.)
  - Update `DEFAULT_SETTINGS` with defaults for all new fields

---

### T02: Add 5 new IPC channels to ipc-channels.ts

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles; no runtime test needed (declarations only)
- [x] Dependencies: T01
- [x] Agent: frontend
- [x] Notes:
  Add to `apps/workflow-studio/src/shared/ipc-channels.ts`:
  - `SETTINGS_SET_API_KEY: 'settings:set-api-key'`
  - `SETTINGS_DELETE_API_KEY: 'settings:delete-api-key'`
  - `SETTINGS_GET_KEY_STATUS: 'settings:get-key-status'`
  - `SETTINGS_TEST_PROVIDER: 'settings:test-provider'`
  - `SETTINGS_GET_VERSION: 'settings:get-version'`

---

### T03: Implement ApiKeyStore using electron.safeStorage

- [x] Estimate: 1.5hr
- [x] Tests: Unit tests for setKey/getKey/hasKey/deleteKey; mock safeStorage; test graceful
      degradation when `isEncryptionAvailable()` is false
- [x] Dependencies: T01
- [x] Agent: frontend
- [x] Notes:
  Create `apps/workflow-studio/src/main/services/api-key-store.ts`:
  - `hasKey(provider)`, `setKey(provider, plaintext)`, `getKey(provider)`, `deleteKey(provider)`
  - Storage: `{userData}/api-keys.json` as `{ [provider]: base64(safeStorage.encryptString(key)) }`
  - If `safeStorage.isEncryptionAvailable()` is false: log warning, store plaintext (degraded mode),
    set `this.encryptionAvailable = false` for caller inspection
  - All file ops use `fs/promises`

---

### T04: Extend SettingsService with provider config

- [x] Estimate: 1hr
- [x] Tests: Unit tests for load/save with new `providers` field; verify defaults merge correctly;
      verify legacy fields not lost on upgrade
- [x] Dependencies: T01, T03
- [x] Agent: frontend
- [x] Notes:
  Extend `apps/workflow-studio/src/main/services/settings-service.ts`:
  - Update `getDefaultSettings()` to include `providers` and environment defaults
  - `ApiKeyStore` is injected (or instantiated) in `SettingsService` constructor
  - `load()`: merge from disk; include `providers` in returned object (no key values)
  - `save(updates)`: handle `providers` updates; never write key values to JSON

---

### T05: Add IPC handlers for settings (API key + test + version)

- [x] Estimate: 1.5hr
- [x] Tests: Unit tests for each of 5 new handlers: set-api-key, delete-api-key, get-key-status,
      test-provider (mock fetch), get-version
- [x] Dependencies: T02, T03, T04
- [x] Agent: frontend
- [x] Notes:
  Extend `apps/workflow-studio/src/main/ipc/settings-handlers.ts` (or create if not present):
  - `SETTINGS_SET_API_KEY`: invoke → decrypt-safe IPC; call `apiKeyStore.setKey(provider, key)`;
    return `{ success: boolean; error?: string }`
  - `SETTINGS_DELETE_API_KEY`: call `apiKeyStore.deleteKey(provider)`
  - `SETTINGS_GET_KEY_STATUS`: return `{ hasKey: apiKeyStore.hasKey(provider) }`
  - `SETTINGS_TEST_PROVIDER`: fetch provider health endpoint (see design.md) using stored key;
    10s timeout; return `{ ok, latencyMs, error }`
  - `SETTINGS_GET_VERSION`: return `{ appVersion, electronVersion, nodeVersion }` from `process.versions`
    and `app.getVersion()`

---

### T06: Build SettingsPage shell with tab navigation

- [x] Estimate: 1hr
- [x] Tests: Renders 3 tabs; keyboard navigation works; selected tab highlights
- [x] Dependencies: T01, T02
- [x] Agent: frontend
- [x] Notes:
  Replace `apps/workflow-studio/src/renderer/pages/SettingsPage.tsx`:
  - Tabbed sidebar: "AI Providers" | "Environment" | "About"
  - Load settings on mount via `SETTINGS_LOAD` IPC
  - Save settings via `SETTINGS_SAVE` IPC on Save button
  - Render `<ProviderSection>`, `<EnvironmentSection>`, or `<AboutSection>` based on active tab
  - Retain existing Save/Reset footer pattern

---

### T07: Build ProviderCard component

- [x] Estimate: 2hr
- [x] Tests: Renders all 4 provider variants; key field masked; Save Key calls IPC; Test button
      disabled when no key; Azure shows endpoint field
- [x] Dependencies: T05, T06
- [x] Agent: frontend
- [x] Notes:
  Create `apps/workflow-studio/src/renderer/components/settings/ProviderCard.tsx`:
  - Props: `provider: ProviderId`, `config: ProviderConfig`, `hasKey: boolean`,
    `onChange(config)`, `onSaveKey(key)`, `onDeleteKey()`, `onTest()`
  - API key section: masked `<input type="password">` + "Save Key" + "Clear" + status badge
  - Model dropdown: `PROVIDER_MODELS[provider]` options; Azure uses text input for deployment name
  - Azure-only: endpoint URL text input (`azureEndpoint`)
  - "Test Connection" button: disabled when `!hasKey` (also `!azureEndpoint` for Azure)
  - Test result badge: green ✓ with latency or red ✗ with error message
  - Accordion/expanded layout per card; all 4 cards visible with collapse support

---

### T08: Build ModelParamsForm component

- [x] Estimate: 1hr
- [x] Tests: Temperature clamped to [0.0, 1.0]; max tokens clamped to [1, 200000]; context window
      badge updates on model change
- [x] Dependencies: T01
- [x] Agent: frontend
- [x] Notes:
  Create `apps/workflow-studio/src/renderer/components/settings/ModelParamsForm.tsx`:
  - Props: `params: ProviderModelParams`, `selectedModel: string`, `onChange(params)`
  - Temperature: range slider (0.0–1.0, step 0.05) + numeric text input synced together
  - Max Tokens: numeric text input with min/max validation
  - Context Window: read-only badge from `MODEL_CONTEXT_WINDOW[selectedModel]` (e.g. "200K tokens")
  - Used inside `ProviderCard`

---

### T09: Build EnvironmentSection component

- [x] Estimate: 1hr
- [x] Tests: Browse buttons call `DIALOG_OPEN_DIRECTORY`; agent timeout clamped to [30, 3600];
      all fields persist
- [x] Dependencies: T06
- [x] Agent: frontend
- [x] Notes:
  Create `apps/workflow-studio/src/renderer/components/settings/EnvironmentSection.tsx`:
  - Docker Socket Path: text input + Browse button (directory dialog)
  - Default Repo Mount Path: text input + Browse button
  - Workspace Directory: text input + Browse button
  - Agent Timeout: numeric input (30–3600 seconds, default 300), unit label "seconds"
  - Retain legacy fields in this section: Workflow Directory, Template Directory,
    Auto-save Interval, CLI Default Working Dir, Execution Mode, Redis URL, Cursor Agent URL

---

### T10: Build AboutSection component

- [x] Estimate: 30min
- [x] Tests: Renders version strings from IPC response
- [x] Dependencies: T05
- [x] Agent: frontend
- [x] Notes:
  Create `apps/workflow-studio/src/renderer/components/settings/AboutSection.tsx`:
  - On mount: invoke `SETTINGS_GET_VERSION` IPC
  - Display: App Version, Electron Version, Node.js version as labeled rows
  - Copy-to-clipboard button for version string (useful for bug reports)

---

### T11: Wire encryption warning banner

- [x] Estimate: 30min
- [x] Tests: Warning banner visible when `encryptionAvailable: false` in key status response
- [x] Dependencies: T03, T06
- [x] Agent: frontend
- [x] Notes:
  - Extend `SETTINGS_GET_KEY_STATUS` response to include `encryptionAvailable: boolean`
  - In SettingsPage, if any provider returns `encryptionAvailable: false`, show a top-level
    warning banner: "API key encryption unavailable on this system. Keys are stored unencrypted."
  - Banner dismissible for session but re-appears on next open

---

---

## Phase 4: Design Review Findings

### T13: Settings migration strategy for pre-P15 settings format

- [x] Estimate: 1hr
- [x] Tests: Unit test -- loading settings without `providers` key migrates to default providers;
      loading settings with old `enabled`/`params` field names migrates to `hasKey?`/`modelParams?`;
      existing fields preserved after migration
- [x] Dependencies: T04
- [x] Agent: frontend
- [x] Notes:
  Add migration logic to `SettingsService.load()`:
  - When loading settings from disk, detect old format (no `providers` key or empty) and add
    default providers config
  - If old-format `ProviderConfig` has `enabled` field, map to `hasKey` semantics (ignore `enabled`,
    check `ApiKeyStore.hasKey()` instead)
  - If old-format `ProviderConfig` has `params` field, rename to `modelParams`
  - Log migration actions for debugging
  - Increment a `settingsVersion` counter to track migrations

### T14: Add `SETTINGS_GET_VERSION` IPC channel

- [x] Estimate: 15min
- [x] Tests: TypeScript compiles; handler returns `{ appVersion, electronVersion, nodeVersion }`
- [x] Dependencies: T02
- [x] Agent: frontend
- [x] Notes:
  Add `SETTINGS_GET_VERSION: 'settings:get-version'` to `ipc-channels.ts` (not yet in committed
  code). Wire handler in `settings-handlers.ts` to return `{ appVersion: app.getVersion(),
  electronVersion: process.versions.electron, nodeVersion: process.versions.node }`.

### T15: Expose provider availability interface for F01 integration

- [x] Estimate: 1hr
- [x] Tests: Unit test -- `getConfiguredProviders()` returns only providers with stored API keys;
      returns empty array when no keys configured
- [x] Dependencies: T03, T04
- [x] Agent: frontend
- [x] Notes:
  Add `getConfiguredProviders(): ProviderId[]` to `SettingsService` (or export from `settingsStore`).
  Returns the list of provider IDs that have a stored API key (via `ApiKeyStore.hasKey()`). This
  interface is consumed by F01 (Studio Block Composer) to populate the model selector dropdown
  with only configured providers.

---

### T12: Integration tests and migration smoke test

- [x] Estimate: 1.5hr
- [x] Tests: Existing settings round-trip (load/save with legacy fields); new providers round-trip;
      all 5 new IPC handlers tested end-to-end with Electron test harness or vitest mocks
- [x] Dependencies: T01-T11, T13, T14, T15
- [x] Agent: frontend
- [x] Notes:
  - Verify `DEFAULT_SETTINGS` migration: app starting fresh gets correct provider defaults
  - Verify upgrade path: existing `electron-config.json` (no `providers` key) merges correctly
    with defaults on load (uses migration logic from T13)
  - Test `ApiKeyStore` full cycle: set → get → has → delete
  - Test that `SETTINGS_LOAD` response never contains API key strings even after `setKey()`
  - tsc --noEmit must pass on all modified files
