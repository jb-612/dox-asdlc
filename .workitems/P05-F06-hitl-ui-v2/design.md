# P05-F06: HITL UI v2 (Full SPA) - Technical Design

## Overview

Expand the P05-F01 basic HITL UI into a comprehensive aSDLC SPA implementing the Information Architecture specification. This represents the complete web interface for the aSDLC system, providing interactive documentation, agent monitoring, chat-driven workflows, HITL approvals, artifact management, budget tracking, and system administration.

**Scope:** MVP Phase 1 (P0 priority pages)
- Documentation (Interactive aSDLC Methodology)
- Agent Cockpit (Utilization and Workflow)
- Discovery & Design Studio (Discovery chat only)
- HITL Gates (enhanced from P05-F01)
- Artifacts (read-only browser)

## Dependencies

### Required Features
- **P05-F01**: HITL UI foundation (React, Vite, TypeScript, Tailwind stack)
- **P03-F02**: Repo Mapper (context pack generation)
- **P02-F02**: Manager Agent (orchestrator API)
- **P01-F03**: KnowledgeStore (ChromaDB/Pinecone integration)

### External Dependencies
- API endpoints from orchestrator service (see contracts/current/hitl_api.json)
- WebSocket support for real-time updates
- ChromaDB/Pinecone for context pack queries

## Interfaces

### Provided Interfaces

**SPA Routes:**
```
/docs                          # Documentation page
/cockpit                       # Agent Cockpit
/cockpit/runs/:run_id         # Run detail view
/studio/discovery             # Discovery chat
/studio/design                # Design chat (Phase 2)
/studio/context               # Context inquiry (Phase 2)
/gates                        # HITL gates queue (from P05-F01)
/gates/:gate_id               # Gate detail (from P05-F01)
/artifacts                    # Artifact explorer
/artifacts/spec-index         # Spec index browser
/artifacts/:artifact_id       # Artifact detail
/budget                       # Budget dashboard (Phase 2)
/admin                        # Admin config (Phase 2)
```

**Component Exports:**
```typescript
// Shared components for other features
export { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
export { EvidenceBundleViewer } from '@/components/evidence/EvidenceBundleViewer';
export { RunTimeline } from '@/components/runs/RunTimeline';
export { RLMTrajectoryViewer } from '@/components/runs/RLMTrajectoryViewer';
export { ContextPackPreview } from '@/components/artifacts/ContextPackPreview';
```

### Required Interfaces

**API Endpoints (from orchestrator):**
```
# Agent Cockpit
GET  /api/runs                    # List runs with filters
GET  /api/runs/:run_id            # Run detail with timeline
GET  /api/workers                 # Worker pool status
GET  /api/workflow/graph          # Workflow visualization data
WS   /api/events/stream           # Live event feed

# Studio
POST /api/studio/discovery/chat   # Discovery chat message
POST /api/studio/context/query    # Context pack query
GET  /api/studio/templates        # PRD/acceptance templates

# Artifacts
GET  /api/artifacts               # List artifacts with filters
GET  /api/artifacts/:id           # Artifact detail
GET  /api/artifacts/:id/history   # Version history
GET  /api/artifacts/:id/provenance # Creation provenance
GET  /api/spec-index/:epic_id     # Spec index for epic

# Existing from P05-F01
GET  /api/gates/pending           # Gates queue
GET  /api/gates/:gate_id          # Gate detail
POST /api/gates/:gate_id/decide   # Submit decision
```

**Context Pack Query Interface:**
```typescript
interface ContextPackQuery {
  query: string;
  max_files?: number;
  max_tokens?: number;
  include_tests?: boolean;
}

interface ContextPackResponse {
  id: string;
  files: ContextFile[];
  total_tokens: number;
  cache_key: string;
  created_at: string;
}
```

## Technical Approach

### Architecture Updates

Extend P05-F01 architecture with new pages and shared components:

```
src/
├── main.tsx
├── App.tsx (updated with new routes)
├── index.css
├── api/
│   ├── client.ts (existing)
│   ├── types.ts (extended)
│   ├── gates.ts (from P05-F01)
│   ├── runs.ts (NEW - agent cockpit)
│   ├── workers.ts (updated)
│   ├── studio.ts (NEW - chat workflows)
│   ├── artifacts.ts (NEW - artifact management)
│   └── websocket.ts (NEW - event stream)
├── components/
│   ├── layout/ (from P05-F01, updated)
│   │   ├── Sidebar.tsx (updated with new nav)
│   │   ├── Header.tsx (updated)
│   │   └── RightPanel.tsx (NEW - evidence drawer, live feed)
│   ├── gates/ (from P05-F01)
│   ├── common/ (expanded)
│   │   ├── MarkdownRenderer.tsx (NEW)
│   │   ├── CodeDiff.tsx (NEW)
│   │   ├── LiveEventFeed.tsx (NEW)
│   │   └── StatusBadge.tsx
│   ├── docs/ (NEW)
│   │   ├── BlueprintMap.tsx
│   │   ├── MethodologyStepper.tsx
│   │   └── InteractiveGlossary.tsx
│   ├── cockpit/ (NEW)
│   │   ├── KPIHeader.tsx
│   │   ├── WorkerUtilizationPanel.tsx
│   │   ├── WorkflowGraphView.tsx
│   │   ├── RunsTable.tsx
│   │   └── GitIntegrationPanel.tsx
│   ├── runs/ (NEW)
│   │   ├── RunTimeline.tsx
│   │   ├── RunInputsTab.tsx
│   │   ├── RunOutputsTab.tsx
│   │   ├── EvidenceTab.tsx
│   │   └── RLMTrajectoryViewer.tsx
│   ├── studio/ (NEW)
│   │   ├── ChatInterface.tsx
│   │   ├── WorkingOutlinePanel.tsx
│   │   ├── OutputQuickviewPanel.tsx
│   │   └── ModelCostSelector.tsx
│   └── artifacts/ (NEW)
│       ├── ArtifactExplorer.tsx
│       ├── SpecIndexBrowser.tsx
│       ├── ArtifactDetailView.tsx
│       └── ContextPackPreview.tsx
├── pages/ (expanded)
│   ├── Dashboard.tsx (from P05-F01)
│   ├── DocsPage.tsx (NEW)
│   ├── CockpitPage.tsx (NEW)
│   ├── RunDetailPage.tsx (NEW)
│   ├── StudioDiscoveryPage.tsx (NEW)
│   ├── GatesPage.tsx (from P05-F01)
│   ├── GateDetailPage.tsx (from P05-F01)
│   ├── ArtifactsPage.tsx (NEW)
│   └── ArtifactDetailPage.tsx (NEW)
├── stores/ (expanded)
│   ├── uiStore.ts (from P05-F01)
│   ├── sessionStore.ts (NEW - epic/env selection)
│   ├── studioStore.ts (NEW - chat state)
│   └── eventStore.ts (NEW - WebSocket events)
└── utils/
    ├── formatters.ts
    ├── markdown.ts (NEW)
    ├── diff.ts (NEW)
    └── websocket.ts (NEW)
```

### Data Flow

**1. Real-Time Updates (WebSocket)**
```
API WebSocket → eventStore (Zustand) → Component Subscriptions
                      ↓
             Live Event Feed (right panel)
             Run Status Updates
             Gate Queue Changes
```

**2. Chat Workflow (Studio)**
```
User Input → ChatInterface
              ↓
         POST /api/studio/discovery/chat
              ↓
         studioStore updates
              ↓
         WorkingOutlinePanel updates
         OutputQuickviewPanel updates
```

**3. Context Pack Query**
```
Natural Language Query → POST /api/studio/context/query
                              ↓
                         Repo Mapper generates pack
                              ↓
                         ContextPackPreview displays
                              ↓
                         "Add to session" action
```

### Key Components

#### 1. MarkdownRenderer
```typescript
interface MarkdownRendererProps {
  content: string;
  mode?: 'view' | 'diff' | 'side-by-side';
  oldContent?: string; // for diff mode
  syntaxHighlight?: boolean;
  showLineNumbers?: boolean;
}

// Features:
// - GitHub-flavored markdown
// - Syntax highlighting (Prism.js or Shiki)
// - Diff visualization
// - Table of contents navigation
// - Copy code blocks
```

#### 2. RLMTrajectoryViewer
```typescript
interface RLMTrajectoryViewerProps {
  invocation: AgentInvocation; // with nested subcalls
  expanded?: boolean;
}

// Features:
// - Hierarchical tree view
// - Expandable subcalls
// - Tool call display
// - Token/cost metrics per subcall
// - Visual indicators for success/failure
```

#### 3. LiveEventFeed
```typescript
interface LiveEventFeedProps {
  filter?: EventFilter;
  maxEvents?: number;
}

// Features:
// - WebSocket connection
// - Real-time event stream
// - Filterable by type/epic/agent
// - Auto-scroll with pause option
// - Event detail expansion
```

#### 4. ChatInterface (Studio)
```typescript
interface ChatInterfaceProps {
  mode: 'discovery' | 'design' | 'context';
  epic_id?: string;
}

// Features:
// - Message history
// - Streaming responses
// - Artifact preview cards
// - "Working..." indicators
// - Context pack suggestions
// - Validation warnings
```

### State Management Strategy

**Zustand Stores:**

```typescript
// sessionStore - global session state
interface SessionStore {
  environment: 'dev' | 'staging' | 'prod';
  repo: string;
  epic_id?: string;
  currentGitSha: string;
  currentBranch: string;
  setEnvironment: (env: string) => void;
  setEpic: (epicId: string) => void;
}

// studioStore - chat workflow state
interface StudioStore {
  messages: ChatMessage[];
  workingOutline: OutlineSection[];
  artifacts: ArtifactCard[];
  addMessage: (msg: ChatMessage) => void;
  updateOutline: (section: OutlineSection) => void;
  addArtifact: (artifact: ArtifactCard) => void;
}

// eventStore - live event feed
interface EventStore {
  events: SystemEvent[];
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  addEvent: (event: SystemEvent) => void;
}
```

**TanStack Query:**
- Server state for runs, gates, artifacts
- Polling for non-WebSocket updates
- Cache invalidation on mutations
- Optimistic updates for decisions

### Navigation Structure

**Updated Sidebar:**
```tsx
<Sidebar>
  <NavSection title="Workflow">
    <NavItem icon={DocumentIcon} to="/docs">Documentation</NavItem>
    <NavItem icon={CpuChipIcon} to="/cockpit">Agent Cockpit</NavItem>
    <NavItem icon={ChatBubbleIcon} to="/studio/discovery">Discovery Studio</NavItem>
    <NavItem icon={ClipboardCheckIcon} to="/gates">HITL Gates</NavItem>
    <NavItem icon={FolderIcon} to="/artifacts">Artifacts</NavItem>
  </NavSection>

  <NavSection title="Operations" collapsed>
    <NavItem icon={ChartBarIcon} to="/budget">Budget</NavItem>
    <NavItem icon={CogIcon} to="/admin">Admin</NavItem>
  </NavSection>
</Sidebar>
```

**Bottom Status Bar:**
```tsx
<StatusBar>
  <StatusItem icon={GitBranchIcon}>{currentBranch} @ {gitSha}</StatusItem>
  <StatusItem icon={UserGroupIcon}>{activeWorkers} workers</StatusItem>
  <StatusItem icon={BellIcon}>{pendingGates} pending gates</StatusItem>
  <StatusItem icon={CheckCircleIcon} color={healthColor}>System {health}</StatusItem>
</StatusBar>
```

## File Structure

Updated from P05-F01:

```
docker/hitl-ui/
├── src/
│   ├── main.tsx
│   ├── App.tsx (updated routes)
│   ├── index.css (expanded with new colors)
│   ├── api/ (6 modules: client, types, gates, runs, studio, artifacts, websocket)
│   ├── components/ (7 folders: layout, common, gates, docs, cockpit, runs, studio, artifacts)
│   ├── pages/ (9 pages)
│   ├── stores/ (4 stores)
│   └── utils/ (4 utilities)
├── public/
│   ├── favicon.svg
│   └── blueprint-diagram.svg (NEW - for docs page)
├── index.html
├── package.json (updated dependencies)
├── vite.config.ts
├── tailwind.config.js (extended colors)
├── tsconfig.json
└── Dockerfile
```

## Dependencies

### New Dependencies

**Runtime:**
```json
{
  "@tanstack/react-query-devtools": "^5.8.0",
  "prismjs": "^1.29.0",
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "diff": "^5.1.0",
  "socket.io-client": "^4.6.0",
  "react-d3-tree": "^3.6.0",
  "recharts": "^2.10.0"
}
```

**Dev:**
```json
{
  "@types/prismjs": "^1.26.0",
  "@types/diff": "^5.0.8"
}
```

## Environment Variables

Extended from P05-F01:

```bash
VITE_API_BASE_URL=http://orchestrator:8080/api
VITE_WS_URL=ws://orchestrator:8080/ws
VITE_MULTI_TENANCY_ENABLED=false
VITE_ALLOWED_TENANTS=default
VITE_POLLING_INTERVAL=10000
VITE_USE_MOCKS=false
VITE_MAX_CONTEXT_PACK_SIZE=100000
VITE_RLM_SUBCALL_LIMIT=10
VITE_ENABLE_WEBSOCKET=true
```

## Security Considerations

- WebSocket authentication (JWT in handshake)
- CORS handling for WebSocket connections
- Rate limiting on chat endpoints
- Sanitization of markdown content (prevent XSS)
- Context pack size limits (prevent DoS)
- No eval() or dangerouslySetInnerHTML without sanitization

## Testing Strategy

### Unit Tests (Vitest)
- Component rendering (all new components)
- Store actions (sessionStore, studioStore, eventStore)
- Markdown rendering edge cases
- Diff algorithm correctness
- WebSocket reconnection logic

### Integration Tests
- Chat workflow (send message → update outline → generate artifact)
- Context pack query (query → results → add to session)
- Gate approval with artifact validation
- Real-time event handling

### E2E Tests (Playwright - Phase 2)
- Full discovery workflow
- HITL approval workflow
- Artifact browsing and detail view
- WebSocket connection resilience

## Performance Considerations

- Code splitting by route (lazy loading)
- Virtual scrolling for long lists (runs, artifacts, events)
- Markdown rendering memoization
- WebSocket message batching
- Context pack preview pagination
- Syntax highlighting lazy loading

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| API endpoints not ready | Mock data layer, incremental integration |
| WebSocket instability | Polling fallback, reconnection logic |
| Large markdown artifacts | Lazy rendering, virtualization |
| Complex diff rendering | Use battle-tested library (diff package) |
| Chat response latency | Streaming responses, loading indicators |
| Context pack generation slow | Loading states, cost estimates, caching |

## Migration from P05-F01

**Backward Compatibility:**
- All P05-F01 routes remain functional
- Gates page enhanced but not breaking
- Shared components extracted to common/

**Migration Steps:**
1. Add new routes to App.tsx
2. Update Sidebar navigation
3. Implement new API modules
4. Build new pages incrementally
5. Test integration with existing gates workflow
6. Deploy with feature flags for new pages

## Open Questions

1. **WebSocket vs Polling:** Should we support both or WebSocket-only for MVP?
   - Recommendation: WebSocket with polling fallback
2. **Context Pack Caching:** Client-side caching strategy?
   - Recommendation: Use TanStack Query cache with TTL from server
3. **Chat Message History:** Persist to backend or client-only?
   - Recommendation: Backend persistence for audit trail
4. **Markdown Security:** Sanitization library choice?
   - Recommendation: DOMPurify + react-markdown built-in escaping
5. **RLM Trajectory Size:** Max depth/breadth limits for visualization?
   - Recommendation: Max 10 subcalls, expandable with pagination
