---
id: P15-F08
parent_id: P15
type: user_stories
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
---

# User Stories: Settings — Complete Redesign (P15-F08)

---

## US-01: Configure an AI provider API key

**As a** workflow author
**I want** to enter my API key for each AI provider in the Settings page
**So that** agent nodes backed by that provider can authenticate without me editing config files

### Acceptance Criteria

- Each of the 4 providers (Anthropic, OpenAI, Google, Azure OpenAI) has a masked API key input
- A "Save Key" action stores the key encrypted via `electron.safeStorage`
- The page shows a "Key saved ✓" badge after successful save
- The key value is never shown after entry (only `•••••••` placeholder and a "Clear" button)
- Clearing a key deletes it from encrypted storage

### Test Scenarios

**Given** the Anthropic provider card is open
**When** I enter a valid API key and click "Save Key"
**Then** the key is stored encrypted and the badge shows "Key saved ✓"

**Given** a key has been saved for OpenAI
**When** the settings page reloads
**Then** the OpenAI key field shows a masked placeholder (not the actual key value)

---

## US-02: Test a provider connection

**As a** workflow author
**I want** to verify my API key works before running a workflow
**So that** I know immediately if the key is invalid or rate-limited

### Acceptance Criteria

- Each provider card has a "Test Connection" button
- Clicking the button triggers a cheap authenticated request from the main process (key never in renderer)
- Success shows: green badge with latency in ms
- Failure shows: red badge with the provider's error message
- Button is disabled when no key has been saved for that provider
- Azure OpenAI "Test" button is also disabled when `azureEndpoint` is empty

### Test Scenarios

**Given** an Anthropic key is saved
**When** I click "Test Connection"
**Then** the main process sends a 1-token request and returns `{ ok: true, latencyMs: N }`

**Given** no key is saved for Google
**When** the Google provider card renders
**Then** the "Test Connection" button is disabled

---

## US-03: Select a default model per provider

**As a** workflow author
**I want** to choose a default model for each AI provider
**So that** new agent nodes pre-populate with my preferred model instead of requiring manual selection each time

### Acceptance Criteria

- Each provider card shows a model dropdown with the known models for that provider
- Azure OpenAI shows a free-text "Deployment Name" field instead of a dropdown
- The selected default model is persisted in `AppSettings.providers[provider].defaultModel`
- The context window size for the selected model is displayed as a read-only informational badge

### Test Scenarios

**Given** I select "claude-opus-4-6" as Anthropic's default model
**When** settings are saved
**Then** `providers.anthropic.defaultModel === "claude-opus-4-6"` in `electron-config.json`

---

## US-04: Configure model inference parameters per provider

**As a** workflow author
**I want** to set temperature and max tokens per AI provider
**So that** I can tune output style globally without changing every node in a workflow

### Acceptance Criteria

- Each provider card includes a temperature control (0.0–1.0, slider + numeric input)
- Each provider card includes a max tokens input (1–200000, numeric)
- Values are persisted in `AppSettings.providers[provider].params`
- Default temperature: 0.7; default max tokens: 4096
- Invalid values (out of range) are clamped or rejected with inline validation

### Test Scenarios

**Given** the OpenAI provider card
**When** I set temperature to 0.2 and max tokens to 2048
**Then** `providers.openai.params = { temperature: 0.2, maxTokens: 2048 }` after save

---

## US-05: Configure Azure OpenAI endpoint

**As an** operator running Azure OpenAI
**I want** to enter both an endpoint URL and an API key for Azure OpenAI
**So that** the application can route requests to my Azure-hosted deployment

### Acceptance Criteria

- Azure OpenAI card has an "Endpoint URL" field (e.g. `https://my-resource.openai.azure.com/`)
- Azure OpenAI card has a "Deployment Name" field (maps to model ID in API calls)
- Both endpoint and key must be present for "Test Connection" to be enabled
- The endpoint URL is stored in `AppSettings.providers.azure.azureEndpoint` (not encrypted)
- The API key is stored encrypted in `ApiKeyStore`

### Test Scenarios

**Given** I enter an endpoint URL but no API key for Azure OpenAI
**When** the Azure OpenAI card renders
**Then** the "Test Connection" button is disabled

---

## US-06: Configure environment parameters

**As a** developer or operator
**I want** to configure environment-level settings (Docker socket, workspace path, agent timeout)
**So that** workflow execution picks up my local environment layout without command-line flags

### Acceptance Criteria

- "Docker Socket Path" field with default `/var/run/docker.sock` and Browse button
- "Default Repo Mount Path" field (pre-fills the Execute tab's repo path input)
- "Workspace Directory" field with Browse button
- "Agent Timeout" field: integer seconds, 30–3600, default 300
- All fields persisted in `AppSettings` under the new environment keys

### Test Scenarios

**Given** I set Agent Timeout to 600 and click Save
**When** the settings page reloads
**Then** the Agent Timeout field shows "600"

---

## US-07: API keys encrypted at rest

**As a** security-conscious developer
**I want** API keys stored encrypted on disk
**So that** my credentials are not exposed if my machine is compromised or if the config file is shared accidentally

### Acceptance Criteria

- API keys are never written to `electron-config.json` in plaintext
- Keys are stored in a separate `api-keys.json` as `base64(safeStorage.encryptString(key))`
- `SETTINGS_LOAD` IPC response contains only `{ hasKey: boolean }` per provider (never the key value)
- If `safeStorage.isEncryptionAvailable()` returns false, a warning banner appears in Settings

### Test Scenarios

**Given** I save an Anthropic API key
**When** I inspect `electron-config.json`
**Then** no API key value is present in that file

**Given** `safeStorage.isEncryptionAvailable()` returns false
**When** the Settings page loads
**Then** a visible warning: "API key encryption unavailable on this system. Keys will be stored unencrypted."

---

## US-08: Provider settings accessible to Studio Block Composer

**As** the Studio Block Composer (F01)
**I want** to read provider config (defaultModel, params) via IPC
**So that** blocks auto-populate with the user's model preferences

### Acceptance Criteria

- `SETTINGS_LOAD` IPC response includes `providers: Record<ProviderId, ProviderConfig>`
- `ProviderConfig` includes `enabled`, `defaultModel`, `params`, `azureEndpoint`, `azureDeployment`
- `ProviderConfig` does NOT include any API key value
- Response is available immediately on renderer startup (settings loaded in main process at app start)

### Test Scenarios

**Given** the user has set Anthropic default model to "claude-opus-4-6"
**When** the Studio Block Composer calls `SETTINGS_LOAD`
**Then** `providers.anthropic.defaultModel === "claude-opus-4-6"` in the response

---

## US-09: View app and runtime versions

**As a** developer or support engineer
**I want** to see the app version, Electron version, and Node.js version in Settings
**So that** I can accurately report the runtime environment in bug reports

### Acceptance Criteria

- "About" tab shows: App Version, Electron Version, Node.js version
- Values come from the `settings:get-version` IPC channel
- The tab is always readable (no authentication required)

### Test Scenarios

**Given** the Settings page is open
**When** I click the "About" tab
**Then** App Version, Electron Version, and Node.js version are displayed
