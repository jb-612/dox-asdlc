# P05-F13: LLM Admin Configuration

## Overview

Admin UI and backend service for configuring LLM providers and per-agent model assignments. Enables Ideation Studio and Development Agents (P04-F03) to use configurable models instead of hardcoded defaults.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LLM Configuration System                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐ │
│  │   Admin UI       │────►│  Config API      │────►│  Config Store   │ │
│  │   (React)        │     │  (FastAPI)       │     │  (Redis)        │ │
│  └──────────────────┘     └──────────────────┘     └─────────────────┘ │
│           │                        │                        │           │
│           │                        ▼                        │           │
│           │               ┌──────────────────┐              │           │
│           │               │  API Key Vault   │              │           │
│           │               │  (Encrypted)     │              │           │
│           │               └──────────────────┘              │           │
│           │                        │                        │           │
│           ▼                        ▼                        ▼           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     LLM Config Service                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │  │
│  │  │ Anthropic   │  │ OpenAI      │  │ Google      │               │  │
│  │  │ Client      │  │ Client      │  │ Client      │               │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│           ┌────────────────────────┼────────────────────────┐          │
│           ▼                        ▼                        ▼          │
│  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐│
│  │ Ideation Studio  │     │ P04-F03 Agents   │     │ Other Agents    ││
│  │ (Discovery/Design│     │ (UTest/Coding/   │     │ (Future)        ││
│  │  agent configs)  │     │  Debug/Review)   │     │                 ││
│  └──────────────────┘     └──────────────────┘     └─────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## Dependencies

| Dependency | Source | Purpose |
|------------|--------|---------|
| P05-F01 | HITL UI base | React components, routing |
| P05-F11 | Ideation Studio | Consumer of discovery/design configs |
| P04-F03 | Development Agents | Consumer of dev agent configs |
| P01-F01 | Redis | Config persistence |

## Interfaces

### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/llm/providers | GET | List supported LLM providers |
| /api/llm/providers/{id}/models | GET | List models for a provider |
| /api/llm/keys | GET | List API keys (masked) |
| /api/llm/keys | POST | Add new API key |
| /api/llm/keys/{id} | DELETE | Remove API key |
| /api/llm/keys/{id}/test | POST | Test API key connectivity |
| /api/llm/agents | GET | List agent role configurations |
| /api/llm/agents/{role} | GET | Get config for specific agent role |
| /api/llm/agents/{role} | PUT | Update agent role configuration |

### Data Models

```typescript
// Supported LLM Providers
type LLMProvider = 'anthropic' | 'openai' | 'google';

// API Key (stored encrypted, returned masked)
interface APIKey {
  id: string;
  provider: LLMProvider;
  name: string;           // User-friendly name
  keyMasked: string;      // "sk-ant-...xyz"
  createdAt: string;
  lastUsed: string | null;
  isValid: boolean;       // Last test result
}

// Agent roles that can be configured
type AgentRole =
  | 'discovery'    // Ideation: initial exploration
  | 'design'       // Ideation: architecture/planning
  | 'utest'        // P04-F03: test writing
  | 'coding'       // P04-F03: implementation
  | 'debugger'     // P04-F03: failure analysis
  | 'reviewer'     // P04-F03: code review
  | 'ideation';    // Ideation orchestrator

// Per-agent configuration
interface AgentLLMConfig {
  role: AgentRole;
  provider: LLMProvider;
  model: string;          // Model ID
  apiKeyId: string;       // Reference to stored key
  settings: {
    temperature: number;  // 0.0 - 1.0
    maxTokens: number;    // 1024 - 32768
    topP?: number;
    topK?: number;
  };
  enabled: boolean;
}
```

## UI Components

```
LLMConfigPage
├── APIKeysSection
│   ├── APIKeyTable
│   │   └── APIKeyRow (per key)
│   ├── AddAPIKeyDialog
│   └── TestKeyButton
├── AgentConfigSection
│   ├── AgentConfigTable
│   │   └── AgentConfigRow (per role)
│   └── AdvancedSettingsPanel
└── ActionBar (Save/Reset)
```

## Security

- Keys encrypted at rest (AES-256-GCM)
- Keys never returned in plaintext after entry
- Masked format: first 7 + last 3 characters
- Admin-only access
- Audit logging for key operations

## File Structure

### Frontend
```
docker/hitl-ui/src/
├── pages/LLMConfigPage.tsx
├── components/llm/
│   ├── APIKeysSection.tsx
│   ├── APIKeyTable.tsx
│   ├── AddAPIKeyDialog.tsx
│   ├── AgentConfigSection.tsx
│   ├── AgentConfigRow.tsx
│   └── AdvancedSettingsPanel.tsx
├── api/llmConfig.ts
├── api/mocks/llmConfig.ts
├── stores/llmConfigStore.ts
└── types/llmConfig.ts
```

### Backend
```
src/orchestrator/
├── routes/llm_config_api.py
├── services/llm_config_service.py
└── api/models/llm_config.py

src/infrastructure/llm/
├── clients/ (anthropic, openai, google)
├── encryption.py
└── factory.py
```

## Phases

| Phase | Scope | Gate |
|-------|-------|------|
| 1 | Frontend: Types, mocks, components, page | **HITL: UI Review** |
| 2 | Backend: API, service, encryption | - |
| 3 | Integration: Connect frontend to backend | - |
| 4 | Wire Ideation Studio | - |
| 5 | Wire P04-F03 agents | - |
