---
id: P15-F08
parent_id: P15
type: design
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

# Design: Settings — Complete Redesign (P15-F08)

## Overview

This feature is a complete replacement of the current `SettingsPage.tsx` and the underlying
`AppSettings` type. The existing page is a flat list of miscellaneous fields with no conceptual
grouping. The redesign adopts a **vendor-first mental model**: the top-level structure is AI
Providers, each with its own API key, model selection, and inference parameters. General
environment and workspace configuration occupies a second section.

The redesign also introduces **secure secret storage** for API keys using Electron's built-in
`safeStorage` API (encrypted on disk, OS-level key) rather than the current plain-JSON approach.

## Goals

- Organize settings around AI providers (Anthropic, OpenAI, Google, Azure OpenAI)
- Store API keys encrypted at rest via `electron.safeStorage`
- Provide "Test Connection" per provider to validate keys before use
- Expose model parameters (temperature, max tokens) per provider
- Surface general environment config (Docker, workspace, timeouts)
- Enable the Studio Block Composer (F01) to read model settings via IPC

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| `electron.safeStorage` | Platform | Built into Electron; no extra npm dep |
| P15-F01 (Studio Block Composer) | Internal | Reads provider/model settings from this feature |
| `apps/workflow-studio/src/shared/types/settings.ts` | Internal | Replaced entirely |
| `apps/workflow-studio/src/main/services/settings-service.ts` | Internal | Extended |
| `apps/workflow-studio/src/renderer/pages/SettingsPage.tsx` | Internal | Replaced entirely |

## UI Structure

```
Settings (tabbed sidebar layout)
├── AI Providers  [tab]
│   ├── Anthropic card
│   │   ├── API Key (masked input + "Test" button + status badge)
│   │   ├── Default Model (dropdown: claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5)
│   │   ├── Temperature (0.0–1.0 slider + numeric input)
│   │   ├── Max Tokens (numeric, 1–200000)
│   │   └── Context Window (read-only badge derived from model)
│   ├── OpenAI card
│   │   ├── API Key
│   │   ├── Default Model (gpt-4o, o1, o3-mini)
│   │   └── Model Parameters (Temperature, Max Tokens)
│   ├── Google card
│   │   ├── API Key
│   │   ├── Default Model (gemini-2.0-flash, gemini-pro)
│   │   └── Model Parameters
│   └── Azure OpenAI card
│       ├── Endpoint URL (text, required alongside key)
│       ├── API Key
│       ├── Deployment Name (maps to model)
│       └── Model Parameters
│
├── Environment  [tab]
│   ├── Docker Socket Path (/var/run/docker.sock or custom)
│   ├── Default Repo Mount Path (pre-filled in Execute tab)
│   ├── Workspace Directory
│   └── Agent Timeout (seconds per step, 30–3600)
│
└── About  [tab]
    ├── App Version (from package.json via IPC)
    └── Electron / Node versions
```

## Architecture

```
Renderer Process                         Main Process
┌──────────────────────────────┐        ┌──────────────────────────────────────┐
│  SettingsPage (React)         │        │  settings-handlers.ts                │
│  ── useSettingsStore()        │        │  ── settings:load → loadSettings()   │
│     zustand slice             │        │  ── settings:save → saveSettings()   │
│                               │        │  ── settings:test-provider →         │
│  ProviderCard component       │◄─IPC──►│     testProviderConnection()         │
│  ── API Key field (masked)    │        │  ── settings:get-key-status →        │
│  ── Model dropdown            │        │     hasApiKey(provider)              │
│  ── Parameter sliders         │        │                                      │
│  ── Test Connection button    │        │  SettingsService (extended)          │
│                               │        │  ── providerConfig: JSON on disk     │
│  EnvironmentSection           │        │  ── ApiKeyStore (safeStorage)        │
│  AboutSection                 │        │     stores encrypted key per provider│
└──────────────────────────────┘        └──────────────────────────────────────┘
```

## Interfaces

### Extended AppSettings (settings.ts)

```typescript
// Provider identifiers
export type ProviderId = 'anthropic' | 'openai' | 'google' | 'azure';

// Known model IDs per provider
export const PROVIDER_MODELS: Record<ProviderId, readonly string[]> = {
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  openai:    ['gpt-4o', 'o1', 'o3-mini'],
  google:    ['gemini-2.0-flash', 'gemini-pro'],
  azure:     [],   // deployment names are user-defined
};

// Context window sizes (informational, keyed by model ID)
export const MODEL_CONTEXT_WINDOW: Record<string, number> = {
  'claude-sonnet-4-6': 200000,
  'claude-opus-4-6':   200000,
  'claude-haiku-4-5':  200000,
  'gpt-4o':            128000,
  'o1':                200000,
  'o3-mini':           200000,
  'gemini-2.0-flash':  1048576,
  'gemini-pro':        1048576,
};

export interface ProviderModelParams {
  temperature?: number;      // 0.0–1.0, default 0.7
  maxTokens?:   number;      // default 4096
}

export interface ProviderConfig {
  /** Provider identifier */
  id: ProviderId;
  /** Default model to use for this provider */
  defaultModel?: string;
  /**
   * Model-level parameters. Committed field name is `modelParams` (not `params`).
   */
  modelParams?: ProviderModelParams;
  /**
   * Whether an API key has been stored (never expose the raw key to renderer).
   * Committed field name is `hasKey` (not `enabled`).
   * The actual key lives in electron.safeStorage; renderer only sees this flag.
   */
  hasKey?: boolean;
  azureEndpoint?: string;            // Azure OpenAI only
  azureDeployment?: string;          // Azure OpenAI only
}

// NOTE: The committed settings.ts uses:
//   - `hasKey?: boolean` (not `enabled: boolean`)
//   - `modelParams?: ProviderModelParams` (not `params: ProviderModelParams`)
//   - `providers?: Partial<Record<ProviderId, ProviderConfig>>` (optional, partial)
// All implementations MUST use these committed field names.

export interface AppSettings {
  // AI Providers (non-secret config only)
  providers: Record<ProviderId, ProviderConfig>;

  // Environment
  dockerSocketPath:     string;   // default: /var/run/docker.sock
  defaultRepoMountPath: string;   // default: ''
  workspaceDirectory:   string;   // default: ''
  agentTimeoutSeconds:  number;   // default: 300

  // General (retained from current settings)
  workflowDirectory:       string;
  templateDirectory:       string;
  autoSaveIntervalSeconds: number;
  cliDefaultCwd:           string;
  redisUrl:                string;
  cursorAgentUrl:          string;
  executionMockMode:       boolean;
}
```

### API Key Store (api-key-store.ts)

```typescript
// Main-process only. Never imported into renderer.
export class ApiKeyStore {
  // Returns true if a key is stored for this provider.
  hasKey(provider: ProviderId): boolean

  // Store (or overwrite) an encrypted API key.
  setKey(provider: ProviderId, plaintext: string): void

  // Retrieve and decrypt a stored key. Returns null if not set.
  getKey(provider: ProviderId): string | null

  // Delete stored key.
  deleteKey(provider: ProviderId): void
}

// Storage: each key is encrypted via safeStorage.encryptString() and persisted
// as a base64-encoded string in a separate "api-keys.json" in userData.
// safeStorage uses the OS credential store as the encryption root key.
```

### New IPC Channels (ipc-channels.ts additions)

```typescript
// Load full settings (excludes API key values — only hasKey status)
SETTINGS_LOAD:          'settings:load'    // unchanged
SETTINGS_SAVE:          'settings:save'    // unchanged (Partial<AppSettings>)

// API key management (main process only — key never crosses IPC)
SETTINGS_SET_API_KEY:   'settings:set-api-key'
  // invoke({ provider: ProviderId, key: string }) → { success: boolean; error?: string }
SETTINGS_DELETE_API_KEY: 'settings:delete-api-key'
  // invoke({ provider: ProviderId }) → { success: boolean }
SETTINGS_GET_KEY_STATUS: 'settings:get-key-status'
  // invoke({ provider: ProviderId }) → { hasKey: boolean }

// Connection test (main process performs fetch, key never in renderer)
SETTINGS_TEST_PROVIDER: 'settings:test-provider'
  // invoke({ provider: ProviderId }) → { ok: boolean; latencyMs?: number; error?: string }

// App version info (NEW — needs to be added to ipc-channels.ts)
SETTINGS_GET_VERSION:   'settings:get-version'
  // invoke() → { appVersion: string; electronVersion: string; nodeVersion: string }
```

**Note:** `SETTINGS_GET_VERSION` is NOT yet in the committed `ipc-channels.ts`. It must be added
as part of F08 implementation (see tasks.md T14).

### Provider Test Endpoints

Each provider's "Test Connection" call hits a cheap endpoint in main process:

| Provider | Test Method |
|----------|-------------|
| Anthropic | `POST /v1/messages` with 1-token prompt, `max_tokens: 1` |
| OpenAI | `GET /v1/models` (list models, small payload) |
| Google | `GET /v1/models` (Gemini REST API) |
| Azure OpenAI | `GET {endpoint}/openai/models?api-version=2024-02-01` |

Timeout: 10 seconds. The key is fetched from `ApiKeyStore.getKey()` inside the main process handler.

## Storage Strategy

| Data | Storage | Format |
|------|---------|--------|
| Non-secret settings | `{userData}/electron-config.json` | Plain JSON |
| API keys | `{userData}/api-keys.json` | `{ provider: base64(safeStorage.encrypt(plaintext)) }` |

`safeStorage` availability:
- Available on macOS (Keychain), Windows (DPAPI), Linux (gnome-libsecret or kwallet)
- If `safeStorage.isEncryptionAvailable()` returns false: log a warning and store keys in
  plaintext JSON (graceful degradation; surfaced as a warning badge in the UI)

## Security Considerations

1. **API keys never cross IPC boundary**: The renderer never receives key values — only `hasKey: boolean`. The "save key" IPC channel accepts a plaintext key inbound once (on explicit user save action), encrypts it in the main process, then discards the plaintext.

2. **Test Connection in main process**: The provider health check runs entirely server-side. The renderer sends only `{ provider }` and receives `{ ok, latencyMs, error }`.

3. **No keys in Zustand store**: The renderer Zustand settings slice stores `Record<ProviderId, { hasKey: boolean }>`. Never the key value.

4. **safeStorage.isEncryptionAvailable() guard**: If encryption is unavailable (edge case on Linux with no keyring daemon), the UI shows a warning and the user must decide whether to continue.

## Settings Migration Strategy

When loading settings from disk, detect and migrate old formats:

### Migration Logic (in `SettingsService.load()`)

```typescript
function migrateSettings(raw: Record<string, unknown>): AppSettings {
  const settings = { ...DEFAULT_SETTINGS, ...raw };

  // Migration 1: No providers key → add defaults
  if (!raw.providers) {
    settings.providers = {};
  }

  // Migration 2: Old ProviderConfig with `enabled` → ignore (use hasKey from ApiKeyStore)
  for (const [id, config] of Object.entries(settings.providers ?? {})) {
    if ('enabled' in config) {
      delete (config as any).enabled;
      // hasKey is derived from ApiKeyStore.hasKey(), not stored in config
    }
    // Migration 3: Old `params` field → rename to `modelParams`
    if ('params' in config && !('modelParams' in config)) {
      (config as any).modelParams = (config as any).params;
      delete (config as any).params;
    }
  }

  return settings;
}
```

### Migration Path

| Old Format | New Format | Action |
|------------|------------|--------|
| No `providers` key | `providers: {}` | Add empty providers object |
| `ProviderConfig.enabled` | `ProviderConfig.hasKey` | Ignore `enabled`; derive from `ApiKeyStore.hasKey()` |
| `ProviderConfig.params` | `ProviderConfig.modelParams` | Rename field |
| No `workItemDirectory` | `workItemDirectory: ''` | Add default |
| No `dockerSocketPath` | `dockerSocketPath: '/var/run/docker.sock'` | Add default |

## safeStorage Platform Limitations

`electron.safeStorage` relies on OS-level credential stores:

| Platform | Backend | Notes |
|----------|---------|-------|
| macOS | Keychain | Always available |
| Windows | DPAPI | Always available |
| Linux | gnome-libsecret / kwallet | **Requires keyring daemon** |

### Linux Without Keyring

On Linux systems without a keyring daemon (e.g., headless servers, minimal desktop environments):

1. `safeStorage.isEncryptionAvailable()` returns `false`.
2. The `ApiKeyStore` falls back to **plaintext** storage in `api-keys.json`.
3. The UI shows a persistent **warning banner**:
   "API key encryption unavailable on this system. Keys are stored unencrypted.
   Install gnome-keyring or kwallet for encrypted storage."
4. The warning banner is dismissible for the current session but re-appears on next app launch.

## Azure-Specific ProviderCard Variant

The Azure OpenAI provider requires additional fields not needed by other providers:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Endpoint URL | text input | Yes (for Azure) | Azure resource endpoint, e.g. `https://my-resource.openai.azure.com` |
| Deployment Name | text input | Yes (for Azure) | Deployment name (maps to model) |
| API Key | password input | Yes | Azure API key |

The `ProviderCard` component checks `provider === 'azure'` and renders additional fields:
- Endpoint URL input above the API key field
- Deployment name input instead of model dropdown
- "Test Connection" button disabled until both endpoint URL **and** API key are provided

## Provider Availability Interface for F01

The Studio Block Composer (F01) needs to know which providers are configured to populate its
model selector dropdown. Expose this via `SettingsService`:

```typescript
// In SettingsService (main process)
getConfiguredProviders(): ProviderId[] {
  return (['anthropic', 'openai', 'google', 'azure'] as ProviderId[])
    .filter(id => this.apiKeyStore.hasKey(id));
}
```

This returns only providers with a stored API key. F01 calls this via an IPC channel
(e.g., `SETTINGS_GET_CONFIGURED_PROVIDERS`) or reads from the settings store.

## File Structure

```
apps/workflow-studio/src/
├── shared/types/settings.ts          # Replaced: new AppSettings, ProviderId, ProviderConfig
├── shared/ipc-channels.ts            # +5 new channels
│
├── main/
│   ├── services/
│   │   ├── settings-service.ts       # Extended: load/save with new providers field
│   │   └── api-key-store.ts          # New: safeStorage wrapper for API keys
│   └── ipc/
│       └── settings-handlers.ts      # Extended: 5 new IPC handlers
│
└── renderer/
    ├── pages/SettingsPage.tsx         # Replaced: tabbed layout shell
    └── components/settings/
        ├── index.ts                   # Barrel export
        ├── ProviderCard.tsx           # Per-provider form card
        ├── ModelParamsForm.tsx        # Temperature + MaxTokens inputs
        ├── EnvironmentSection.tsx     # Docker / Workspace / Timeout
        └── AboutSection.tsx           # Version info
```

## Architecture Decisions

### safeStorage vs keytar

`electron.safeStorage` (built-in) was chosen over `keytar` (npm native addon) because:
- No additional native npm dependency to build/bundle
- Available in all supported Electron versions (≥15)
- Uses OS credential store as root key on all platforms
- Simpler deployment (no binding compilation step)

### Flat IPC vs Nested Objects

Settings save/load uses `Partial<AppSettings>` (flat merge). API keys use separate IPC channels
to maintain the security boundary. This avoids the complexity of a nested "settings with secrets"
protocol while keeping the existing save/load surface intact.

### Retained Legacy Fields

The existing fields (`workflowDirectory`, `templateDirectory`, `autoSaveIntervalSeconds`,
`cliDefaultCwd`, `redisUrl`, `cursorAgentUrl`, `executionMockMode`) are retained in `AppSettings`
to avoid breaking existing IPC consumers (Execute tab, workflow engine). They are moved to the
"Environment" section of the new UI.

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `safeStorage` unavailable on Linux (no keyring) | Medium | Graceful degradation: warn user, allow unencrypted storage |
| Test Connection rate limiting by providers | Low | 10s timeout, single request, no retry |
| Azure requires endpoint URL before key test | High | "Test" button disabled until endpoint URL is also set |
| Large AppSettings type breaks existing consumers | Low | All legacy fields retained; additive change only |
