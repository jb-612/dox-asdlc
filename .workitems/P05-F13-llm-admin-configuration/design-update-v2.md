# P05-F13: Design Update v2 - Dynamic Models & Config Export

## Overview of Changes

This update addresses two requirements from UI review:

1. **Dynamic Model Discovery** - Fetch real models from vendor APIs using stored keys
2. **Raw Config Editor** - Advanced users can edit/export config to .env format

---

## 1. Dynamic Model Discovery

### Problem

Static model lists become outdated. Model IDs must match exactly what vendors expect.

### Solution

When an API key is validated, call the vendor's list-models API and cache results.

### Architecture Update

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Model Discovery Flow                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User adds API key                                                   │
│         │                                                                │
│         ▼                                                                │
│  2. POST /api/llm/keys/{id}/test                                        │
│         │                                                                │
│         ├──► Validate key with vendor                                   │
│         │                                                                │
│         ▼                                                                │
│  3. If valid: GET /api/llm/keys/{id}/discover-models                    │
│         │                                                                │
│         ├──► Anthropic: GET https://api.anthropic.com/v1/models         │
│         ├──► OpenAI:    GET https://api.openai.com/v1/models            │
│         └──► Google:    GET https://generativelanguage.googleapis.com/v1/models
│         │                                                                │
│         ▼                                                                │
│  4. Cache discovered models in Redis (TTL: 24 hours)                    │
│         │                                                                │
│         ▼                                                                │
│  5. Model dropdown fetches: GET /api/llm/keys/{id}/models               │
│         └──► Returns cached models (or triggers discovery if stale)     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### New/Updated API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/llm/keys/{id}/models | GET | Get models discovered for this key |
| /api/llm/keys/{id}/discover | POST | Force re-discovery of models |

### Updated Data Models

```typescript
// Discovered model from vendor API
interface DiscoveredModel {
  id: string;              // Exact vendor model ID (e.g., "claude-sonnet-4-20250514")
  name: string;            // Display name (e.g., "Claude Sonnet 4")
  provider: LLMProvider;
  contextWindow: number;   // From vendor metadata
  maxOutput: number;       // From vendor metadata
  capabilities: string[];  // chat, vision, tools, etc.
  deprecated: boolean;     // If vendor marks as deprecated
  discoveredAt: string;    // When we fetched this info
}

// Updated APIKey to track discovery
interface APIKey {
  id: string;
  provider: LLMProvider;
  name: string;
  keyMasked: string;
  createdAt: string;
  lastUsed: string | null;
  isValid: boolean;
  modelsDiscoveredAt: string | null;  // NEW: When models were last fetched
  modelCount: number;                  // NEW: How many models available
}
```

### Vendor API Integration

```python
# src/infrastructure/llm/model_discovery.py

class ModelDiscoveryService:
    """Discovers available models from LLM vendor APIs."""
    
    async def discover_anthropic_models(self, api_key: str) -> list[DiscoveredModel]:
        """Fetch models from Anthropic API."""
        # GET https://api.anthropic.com/v1/models
        # Header: x-api-key: {api_key}
        # Header: anthropic-version: 2023-06-01
        
    async def discover_openai_models(self, api_key: str) -> list[DiscoveredModel]:
        """Fetch models from OpenAI API."""
        # GET https://api.openai.com/v1/models
        # Header: Authorization: Bearer {api_key}
        # Filter for chat models (gpt-4*, gpt-3.5-turbo*, etc.)
        
    async def discover_google_models(self, api_key: str) -> list[DiscoveredModel]:
        """Fetch models from Google Generative AI API."""
        # GET https://generativelanguage.googleapis.com/v1/models?key={api_key}
        # Filter for generateContent supported models
```

### Redis Cache Structure

```
llm:models:{key_id}       -> JSON list of DiscoveredModel
llm:models:{key_id}:ttl   -> Expiry timestamp (24 hours)
```

### UI Changes

```
AgentConfigRow
├── Provider dropdown (unchanged)
├── API Key dropdown (unchanged)  
├── Model dropdown ◄── NOW: Fetches from /api/llm/keys/{keyId}/models
│   ├── Shows "Loading..." while fetching
│   ├── Shows actual model names from vendor
│   └── Disables if no valid key selected
└── Settings button (unchanged)
```

---

## 2. Raw Config Editor with .env Export

### Problem

Power users want direct control over configuration and ability to export settings for deployment/CI.

### Solution

Add a "Raw Config" tab in Advanced Settings that shows full JSON config and can export to .env format.

### UI Design

```
┌─ Advanced Settings ────────────────────────────────────────────────────┐
│                                                                         │
│  [Parameters]  [Raw Config]                                            │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─ Raw Config Tab ──────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  ⚠️  Advanced Users Only                                          │ │
│  │  Direct editing may cause configuration errors.                   │ │
│  │  Changes here override UI settings.                               │ │
│  │                                                                    │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │ {                                                            │ │ │
│  │  │   "agents": {                                                │ │ │
│  │  │     "discovery": {                                           │ │ │
│  │  │       "provider": "anthropic",                               │ │ │
│  │  │       "model": "claude-sonnet-4-20250514",                   │ │ │
│  │  │       "apiKeyId": "key-abc123",                              │ │ │
│  │  │       "temperature": 0.2,                                    │ │ │
│  │  │       "maxTokens": 16384                                     │ │ │
│  │  │     },                                                       │ │ │
│  │  │     "coding": { ... },                                       │ │ │
│  │  │     ...                                                      │ │ │
│  │  │   }                                                          │ │ │
│  │  │ }                                                            │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  │                                                                    │ │
│  │  [Validate JSON]  [Export to .env]  [Import from .env]            │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### .env Export Format

```bash
# LLM Configuration - Generated by aSDLC Admin
# Generated: 2026-01-29T15:00:00Z

# Discovery Agent
LLM_DISCOVERY_PROVIDER=anthropic
LLM_DISCOVERY_MODEL=claude-sonnet-4-20250514
LLM_DISCOVERY_API_KEY_ID=key-abc123
LLM_DISCOVERY_TEMPERATURE=0.2
LLM_DISCOVERY_MAX_TOKENS=16384

# Design Agent  
LLM_DESIGN_PROVIDER=anthropic
LLM_DESIGN_MODEL=claude-sonnet-4-20250514
LLM_DESIGN_API_KEY_ID=key-abc123
LLM_DESIGN_TEMPERATURE=0.2
LLM_DESIGN_MAX_TOKENS=16384

# Coding Agent
LLM_CODING_PROVIDER=anthropic
LLM_CODING_MODEL=claude-sonnet-4-20250514
LLM_CODING_API_KEY_ID=key-abc123
LLM_CODING_TEMPERATURE=0.2
LLM_CODING_MAX_TOKENS=16384

# ... (all 7 agent roles)

# API Keys (IDs only - actual keys stored securely)
# To use in deployment, set these environment variables:
# ANTHROPIC_API_KEY=your-key-here
# OPENAI_API_KEY=your-key-here
# GOOGLE_API_KEY=your-key-here
```

### New API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/llm/config/export | GET | Export full config as JSON |
| /api/llm/config/export/env | GET | Export config as .env format |
| /api/llm/config/import | POST | Import config from JSON |
| /api/llm/config/validate | POST | Validate config JSON |

### New Components

```
docker/hitl-ui/src/components/llm/
├── ... (existing)
├── RawConfigEditor.tsx      # JSON editor with syntax highlighting
├── EnvExportDialog.tsx      # Shows .env content, copy/download buttons
└── ConfigImportDialog.tsx   # Upload/paste JSON config
```

### Security Considerations

1. **API Keys in .env export**: Only export key IDs, not actual keys
2. **Validation**: Validate JSON structure before applying
3. **Backup**: Create backup before import overwrites config
4. **Audit**: Log all import/export operations

---

## 3. Updated Phase Plan

### Original Phases (1-2 Complete)

| Phase | Status | Scope |
|-------|--------|-------|
| 1 | ✅ DONE | Frontend: Types, mocks, components, page |
| 2 | ✅ DONE | Backend: API, service, encryption |

### Updated Remaining Phases

| Phase | Scope | Tasks |
|-------|-------|-------|
| **3A** | Dynamic Model Discovery | T25-T28 |
| **3B** | Raw Config Editor | T29-T32 |
| **3C** | Integration (Frontend ↔ Backend) | T18-T19 (existing) |
| **4** | Wire Ideation Studio | T20-T21 (existing) |
| **5** | Wire P04-F03 Agents | T22-T23 (existing) |
| **6** | Streaming Support | T24 (existing) |

---

## 4. New Tasks

### Phase 3A: Dynamic Model Discovery

#### T25: Create model_discovery.py service
- [ ] Estimate: 2hr
- [ ] Tests: tests/unit/infrastructure/llm/test_model_discovery.py
- [ ] Dependencies: T14 (encryption for decrypting keys)
- [ ] Notes: Vendor API clients for Anthropic, OpenAI, Google

#### T26: Add model discovery endpoints
- [ ] Estimate: 1hr
- [ ] Tests: tests/unit/orchestrator/routes/test_llm_config_api.py
- [ ] Dependencies: T25
- [ ] Notes: GET/POST /api/llm/keys/{id}/models, /discover

#### T27: Update frontend model dropdown
- [ ] Estimate: 1hr
- [ ] Tests: Update AgentConfigRow tests
- [ ] Dependencies: T26
- [ ] Notes: Fetch models from API based on selected key

#### T28: Add model cache management
- [ ] Estimate: 30min
- [ ] Tests: Integration tests
- [ ] Dependencies: T26
- [ ] Notes: Redis TTL, cache invalidation on key update

### Phase 3B: Raw Config Editor

#### T29: Create RawConfigEditor component
- [ ] Estimate: 1.5hr
- [ ] Tests: src/components/llm/RawConfigEditor.test.tsx
- [ ] Dependencies: T04 (store)
- [ ] Notes: JSON editor with syntax highlighting, validation

#### T30: Create EnvExportDialog component
- [ ] Estimate: 1hr
- [ ] Tests: src/components/llm/EnvExportDialog.test.tsx
- [ ] Dependencies: T29
- [ ] Notes: Generate .env content, copy/download buttons

#### T31: Add config export/import endpoints
- [ ] Estimate: 1hr
- [ ] Tests: tests/unit/orchestrator/routes/test_llm_config_api.py
- [ ] Dependencies: T16
- [ ] Notes: GET /export, GET /export/env, POST /import, POST /validate

#### T32: Integrate raw config into AdvancedSettingsPanel
- [ ] Estimate: 30min
- [ ] Tests: Update AdvancedSettingsPanel tests
- [ ] Dependencies: T29, T30
- [ ] Notes: Add tabs for Parameters vs Raw Config

---

## 5. File Structure Updates

### Backend Additions

```
src/infrastructure/llm/
├── model_discovery.py      # NEW: Vendor API integration
└── env_exporter.py         # NEW: .env format generation
```

### Frontend Additions

```
docker/hitl-ui/src/components/llm/
├── RawConfigEditor.tsx     # NEW: JSON editor
├── EnvExportDialog.tsx     # NEW: .env export dialog
└── ConfigImportDialog.tsx  # NEW: Import dialog
```

---

## 6. Summary

| Feature | Backend Changes | Frontend Changes |
|---------|-----------------|------------------|
| Dynamic Models | model_discovery.py, new endpoints | Model dropdown fetches from API |
| Raw Config Editor | export/import endpoints | RawConfigEditor, EnvExportDialog |

This update integrates cleanly:
- Builds on existing encryption service (T14) for key decryption
- Extends existing API routes (T16)
- Adds to existing UI components (T09 AdvancedSettingsPanel)
- Maintains existing phase structure with sub-phases

---

## 7. Mock/Real Toggle

### Requirement

Add a toggle on the LLM Config page to switch between mock data and real backend API.

### UI Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LLM Configuration                                                       │
│                                                                          │
│  Data Source: [Mock ○ ● Real]                    [Save] [Reset]         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  (When Mock selected: Uses hardcoded mock data, no backend calls)       │
│  (When Real selected: Calls backend API, requires running orchestrator) │
│                                                                          │
```

### Implementation

```typescript
// In llmConfigStore.ts
interface LLMConfigStore {
  // ... existing state
  dataSource: 'mock' | 'real';
  setDataSource: (source: 'mock' | 'real') => void;
}

// In api/llmConfig.ts
export function shouldUseMocks(): boolean {
  // Check store preference first, fallback to env var
  const store = useLLMConfigStore.getState();
  if (store.dataSource === 'mock') return true;
  if (store.dataSource === 'real') return false;
  return import.meta.env.VITE_USE_MOCKS === 'true';
}
```

### New Component

```
docker/hitl-ui/src/components/llm/
├── DataSourceToggle.tsx    # NEW: Mock/Real toggle switch
```

### Task

#### T33: Add Mock/Real toggle to LLMConfigPage
- [ ] Estimate: 45min
- [ ] Tests: src/components/llm/DataSourceToggle.test.tsx
- [ ] Dependencies: T04, T11
- [ ] Notes: Toggle in header, persists to localStorage, affects all API calls

---

## 8. Updated Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | T01-T12 | ✅ Frontend with mocks |
| 2 | T13-T17 | ✅ Backend API |
| 3A | T25-T28 | Dynamic model discovery |
| 3B | T29-T32 | Raw config editor & .env export |
| 3C | T18-T19, T33 | Integration + Mock/Real toggle |
| 4 | T20-T21 | Wire Ideation Studio |
| 5 | T22-T23 | Wire P04-F03 Agents |
| 6 | T24 | Streaming Support |
