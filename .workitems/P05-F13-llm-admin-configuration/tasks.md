# P05-F13: LLM Admin Configuration - Tasks

## Progress
- Started: 2026-01-29
- Tasks Complete: 33/33
- Percentage: 100%
- Status: COMPLETE

---

## Phase 1: Frontend Foundation (Mock-First)

### T01: Create types/llmConfig.ts
- [x] Estimate: 30min
- [x] Tests: N/A (type definitions)
- [x] Dependencies: None
- [x] Notes: LLMProvider, APIKey, AgentRole, AgentLLMConfig interfaces

### T02: Create api/mocks/llmConfig.ts
- [x] Estimate: 45min
- [x] Tests: N/A
- [x] Dependencies: T01
- [x] Notes: Mock providers, models, keys, agent configs

### T03: Create api/llmConfig.ts
- [x] Estimate: 30min
- [x] Tests: src/api/llmConfig.test.ts
- [x] Dependencies: T01, T02
- [x] Notes: API client with mock fallback

### T04: Create stores/llmConfigStore.ts
- [x] Estimate: 1hr
- [x] Tests: src/stores/llmConfigStore.test.ts
- [x] Dependencies: T01, T03
- [x] Notes: Zustand store for config state

### T05: Create APIKeyTable component
- [x] Estimate: 1hr
- [x] Tests: src/components/llm/APIKeyTable.test.tsx
- [x] Dependencies: T01
- [x] Notes: Table with masked keys, status, actions

### T06: Create AddAPIKeyDialog component
- [x] Estimate: 1hr
- [x] Tests: src/components/llm/AddAPIKeyDialog.test.tsx
- [x] Dependencies: T01
- [x] Notes: Modal with provider select, key input, name field

### T07: Create APIKeysSection component
- [x] Estimate: 30min
- [x] Tests: src/components/llm/APIKeysSection.test.tsx
- [x] Dependencies: T05, T06
- [x] Notes: Container with table and add button

### T08: Create AgentConfigRow component
- [x] Estimate: 1hr
- [x] Tests: src/components/llm/AgentConfigRow.test.tsx
- [x] Dependencies: T01
- [x] Notes: Row with provider/model dropdowns, settings button

### T09: Create AdvancedSettingsPanel component
- [x] Estimate: 1hr
- [x] Tests: src/components/llm/AdvancedSettingsPanel.test.tsx
- [x] Dependencies: T01
- [x] Notes: Temperature slider, max tokens, top_p/k inputs

### T10: Create AgentConfigSection component
- [x] Estimate: 30min
- [x] Tests: src/components/llm/AgentConfigSection.test.tsx
- [x] Dependencies: T08, T09
- [x] Notes: Table of agent rows with expandable settings

### T11: Create LLMConfigPage
- [x] Estimate: 1hr
- [x] Tests: src/pages/LLMConfigPage.test.tsx
- [x] Dependencies: T04, T07, T10
- [x] Notes: Full page with both sections, save/reset buttons

### T12: Add route and nav link
- [x] Estimate: 15min
- [x] Tests: N/A
- [x] Dependencies: T11
- [x] Notes: /admin/llm route, Admin menu link

---

## >>> HITL GATE: UI Review <<<

**Stop here for user review of the UI.**
- Run frontend with mocks: `VITE_USE_MOCKS=true npm run dev`
- Navigate to /admin/llm
- Review layout, interactions, component styling
- Provide feedback for adjustments

---

## Phase 2: Backend Implementation (Parallel with Phase 1)

### T13: Create api/models/llm_config.py
- [x] Estimate: 30min
- [x] Tests: tests/unit/orchestrator/api/models/test_llm_config.py (22 tests passing)
- [x] Dependencies: None
- [x] Notes: Pydantic models for LLMProvider, AgentRole, APIKey, LLMModel, AgentSettings, AgentLLMConfig

### T14: Create utils/encryption.py
- [x] Estimate: 1hr
- [x] Tests: tests/unit/orchestrator/utils/test_encryption.py (19 tests passing)
- [x] Dependencies: None
- [x] Notes: Fernet encryption, encrypt/decrypt, mask_key, env key support

### T15: Create services/llm_config_service.py
- [x] Estimate: 2hr
- [x] Tests: tests/unit/orchestrator/services/test_llm_config_service.py (46 tests passing)
- [x] Dependencies: T13, T14
- [x] Notes: CRUD for keys and configs, Redis storage, static model lists, model cache, export/import

### T16: Create routes/llm_config_api.py
- [x] Estimate: 1.5hr
- [x] Tests: tests/unit/orchestrator/routes/test_llm_config_api.py (28 tests passing)
- [x] Dependencies: T13, T15
- [x] Notes: All REST endpoints implemented including discovery and export/import

### T17: Register routes in main.py
- [x] Estimate: 15min
- [x] Tests: N/A
- [x] Dependencies: T16
- [x] Notes: Added llm_config_router to FastAPI app

---

## Phase 3: Integration

### T18: Connect frontend to backend API
- [x] Estimate: 1hr
- [x] Tests: src/api/llmConfig.integration.test.ts (42 tests passing)
- [x] Dependencies: T11, T16, HITL Gate passed
- [x] Notes: Updated api/llmConfig.ts to check dataSource before API calls. When 'real', calls backend at /api/llm/*. Added error handling with user-friendly messages. Hooks refetch when dataSource changes.

### T19: Add API key test endpoint
- [x] Estimate: 1hr
- [x] Tests: tests/unit/orchestrator/routes/test_llm_config_api.py (33 tests passing)
- [x] Dependencies: T18
- [x] Notes: POST /api/llm/keys/{id}/test - verify key works. Also added 6 service tests.

---

## Phase 4: Wire Ideation Studio

### T20: Create LLM client factory
- [x] Estimate: 1.5hr
- [x] Tests: tests/unit/infrastructure/llm/test_factory.py
- [x] Dependencies: T15
- [x] Notes: Created BaseLLMClient, AnthropicClient, OpenAIClient, GoogleClient, LLMClientFactory with caching (17 tests passing)

### T21: Update Ideation Studio to use config
- [x] Estimate: 1.5hr
- [x] Tests: Update existing ideation tests
- [x] Dependencies: T20
- [x] Notes: Created IdeationServiceImpl with factory integration, updated IdeationService to delegate (19 API tests + 42 agent tests passing)

---

## Phase 5: Wire P04-F03 Agents

### T22: Update DevelopmentConfig to use LLM config
- [x] Estimate: 1hr
- [x] Tests: tests/unit/workers/agents/development/test_config.py (3 new tests passing)
- [x] Dependencies: T20
- [x] Notes: Added from_llm_config() async classmethod to DevelopmentConfig that reads model settings from LLMConfigService

### T23: Update each dev agent to use factory
- [x] Estimate: 1.5hr
- [x] Tests: tests/unit/workers/agents/development/test_agent_factory.py (10 tests passing)
- [x] Dependencies: T22
- [x] Notes: Created agent_factory.py with async create functions that use LLMClientFactory. Supports fallback to stub client on error.

---

## Phase 6: Streaming Support

### T24: Add SSE streaming for LLM responses
- [x] Estimate: 2hr
- [x] Tests: tests/unit/orchestrator/routes/test_llm_streaming.py (12 tests passing)
- [x] Dependencies: T21
- [x] Notes: Created llm_streaming_api.py with POST /api/llm/stream endpoint. Uses SSE format with format_sse_event() helper. Supports system_prompt. Registered in main.py.

---

## Task Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | T01-T12 | Frontend with mocks - **COMPLETE** |
| HITL | - | UI Review gate |
| 2 | T13-T17 | Backend (parallel) - **COMPLETE** |
| 3 | T18-T19 | Integration - **COMPLETE** |
| 4 | T20-T21 | Ideation Studio - **COMPLETE** |
| 5 | T22-T23 | P04-F03 Agents - **COMPLETE** |
| 6 | T24 | Streaming - **COMPLETE** |

---

## Phase 3A: Dynamic Model Discovery

### T25: Create model_discovery.py service
- [x] Estimate: 2hr
- [x] Tests: tests/unit/infrastructure/llm/test_model_discovery.py (17 tests passing)
- [x] Dependencies: T14
- [x] Notes: Vendor API clients for Anthropic, OpenAI, Google model listing

### T26: Add model discovery endpoints
- [x] Estimate: 1hr
- [x] Tests: tests/unit/orchestrator/routes/test_llm_config_api.py (updated with 5 new tests)
- [x] Dependencies: T25
- [x] Notes: GET/POST /api/llm/keys/{id}/models, /discover

### T27: Update frontend model dropdown
- [x] Estimate: 1hr
- [x] Tests: Update AgentConfigRow tests
- [x] Dependencies: T26
- [x] Notes: Added useKeyModels hook in api/llmConfig.ts for fetching models based on selected API key

### T28: Add model cache management
- [x] Estimate: 30min
- [x] Tests: tests/unit/orchestrator/services/test_llm_config_service.py (updated with 4 new tests)
- [x] Dependencies: T26
- [x] Notes: Redis TTL 24hr, cache invalidation

---

## Phase 3B: Raw Config Editor

### T29: Create RawConfigEditor component
- [x] Estimate: 1.5hr
- [x] Tests: src/components/llm/RawConfigEditor.test.tsx (10 tests passing)
- [x] Dependencies: T04
- [x] Notes: JSON editor with syntax highlighting, validation, warning banner

### T30: Create EnvExportDialog component
- [x] Estimate: 1hr
- [x] Tests: src/components/llm/EnvExportDialog.test.tsx (11 tests passing)
- [x] Dependencies: T29
- [x] Notes: Generate .env format, copy/download buttons

### T31: Add config export/import endpoints
- [x] Estimate: 1hr
- [x] Tests: tests/unit/orchestrator/routes/test_llm_config_api.py (updated with 6 new tests)
- [x] Dependencies: T16
- [x] Notes: /export, /export/env, /import, /validate - all implemented

### T32: Integrate raw config into AdvancedSettingsPanel
- [x] Estimate: 30min
- [x] Tests: Update AdvancedSettingsPanel tests
- [x] Dependencies: T29, T30
- [x] Notes: Add tabs: Parameters | Raw Config with Export to .env button

---

## Phase 3C: Integration + Toggle

### T33: Add Mock/Real toggle to LLMConfigPage
- [x] Estimate: 45min
- [x] Tests: src/components/llm/DataSourceToggle.test.tsx (8 tests passing)
- [x] Dependencies: T04, T11
- [x] Notes: Toggle in header, persists to localStorage, affects all API calls

---

## Updated Task Summary

| Phase | Tasks | Count | Status |
|-------|-------|-------|--------|
| 1 | T01-T12 | 12 | Complete |
| 2 | T13-T17 | 5 | Complete |
| 3A | T25-T28 | 4 | Complete |
| 3B | T29-T32 | 4 | Complete |
| 3C | T18-T19, T33 | 3 | Complete |
| 4 | T20-T21 | 2 | Complete |
| 5 | T22-T23 | 2 | Complete |
| 6 | T24 | 1 | Complete |

**Total: 33 tasks (33 complete, 0 remaining)**
