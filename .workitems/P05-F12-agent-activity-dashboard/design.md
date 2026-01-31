# P05-F12: Agent Activity Dashboard

## Overview
Real-time dashboard showing agent execution status, logs, and metrics. Consumes the Agent Telemetry API (P02-F08).

## Dependencies
- P02-F08: Agent Telemetry API (backend endpoints)
- P05-F01: HITL UI base components

## Interfaces

### Required API Endpoints (from P02-F08)

| Endpoint | Used By | Status |
|----------|---------|--------|
| GET /api/agents/status | AgentStatusGrid | Working |
| GET /api/agents/{id}/logs | AgentLogsPanel | Working |
| GET /api/agents/{id}/detail | AgentStatusCard (expanded) | **Backend missing** |
| GET /api/agents/metrics | AgentMetricsChart | Working (struct mismatch) |
| GET /api/agents/timeline | AgentTimelineView | **Backend missing** |
| WS /ws/agents | Real-time updates | Partial |

### Data Model Contract

**IMPORTANT:** Frontend types MUST use canonical field names from P02-F08 design.md.

Current mismatches that need fixing:

| Frontend Field | Backend Field | Action Required |
|---------------|---------------|-----------------|
| `id` | `agent_id` | Change frontend to `agent_id` |
| `type` | `agent_type` | Change frontend to `agent_type` |
| `'failed'` status | `'error'` status | Change frontend to `'error'` |

**Canonical Types (align with P02-F08):**

```typescript
// types/agents.ts - MUST match P02-F08 design.md

export type AgentStatusEnum = 'idle' | 'running' | 'blocked' | 'error' | 'completed';

export type AgentTypeEnum =
  | 'worker'
  | 'orchestrator'
  | 'validator'
  | 'discovery'
  | 'coding'
  | 'test'
  | 'design';

export type AgentLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AgentStatus {
  agent_id: string;           // NOT "id"
  agent_type: AgentTypeEnum;  // NOT "type"
  status: AgentStatusEnum;
  current_task: string | null;
  progress: number;
  last_updated: string;
  error_message?: string;
  session_id?: string;
  started_at?: string;
  last_heartbeat?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentLog {
  timestamp: string;
  level: AgentLogLevel;
  message: string;
  agent_id: string;
  task_id?: string;
  context?: Record<string, unknown>;
}

export interface AgentMetrics {
  agent_type: AgentTypeEnum;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  avg_duration_ms: number;
  total_tokens_used: number;
}

export interface AgentTimelineEntry {
  agent_id: string;
  agent_type: AgentTypeEnum;
  task_id: string;
  task_name: string;
  status: AgentStatusEnum;
  start_time: string;
  end_time?: string;
  duration_ms?: number;
}
```

### Components

| Component | Purpose | Props |
|-----------|---------|-------|
| AgentsDashboardPage | Main page layout, 3-column grid | - |
| AgentStatusGrid | Responsive grid of status cards | agents, onSelect |
| AgentStatusCard | Individual agent card | agent, selected, onClick |
| AgentLogsPanel | Scrollable log viewer | logs, agentId, onFilter |
| AgentMetricsChart | Bar/line charts | metrics, timeRange |
| AgentTimelineView | Gantt-style timeline | entries, timeRange |

## Technical Approach

### State Management (Zustand)

```typescript
interface AgentsStore {
  // State
  agents: AgentStatus[];
  selectedAgentId: string | null;
  logs: AgentLog[];
  metrics: AgentMetrics[];
  timeline: AgentTimelineEntry[];
  wsConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAgents: () => Promise<void>;
  fetchLogs: (agentId: string, level?: AgentLogLevel) => Promise<void>;
  fetchMetrics: (timeRange?: string) => Promise<void>;
  fetchTimeline: (timeRange?: string) => Promise<void>;
  selectAgent: (agentId: string | null) => void;

  // WebSocket
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
}
```

### WebSocket Integration
- Auto-connect on page mount
- Reconnect with exponential backoff (max 5 retries)
- Subscribe to `status` channel for real-time updates
- Update agent status in store on `status_update` messages
- Show connection indicator in UI

### API Client Pattern

```typescript
// api/agents.ts
const API_BASE = '/api/agents';

// Use mock data when VITE_USE_MOCKS=true
function shouldUseMocks(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}

export async function fetchAgentStatus(): Promise<AgentStatus[]> {
  if (shouldUseMocks()) return getMockAgents();
  const res = await fetch(`${API_BASE}/status`);
  const data = await res.json();
  return data.agents;
}
```

## File Structure
```
docker/hitl-ui/src/
├── pages/
│   ├── AgentsDashboardPage.tsx
│   └── AgentsDashboardPage.test.tsx
├── components/agents/
│   ├── index.ts
│   ├── AgentStatusGrid.tsx
│   ├── AgentStatusGrid.test.tsx
│   ├── AgentStatusCard.tsx
│   ├── AgentStatusCard.test.tsx
│   ├── AgentLogsPanel.tsx
│   ├── AgentLogsPanel.test.tsx
│   ├── AgentMetricsChart.tsx
│   ├── AgentMetricsChart.test.tsx
│   ├── AgentTimelineView.tsx
│   └── AgentTimelineView.test.tsx
├── stores/
│   ├── agentsStore.ts
│   └── agentsStore.test.ts
├── api/
│   ├── agents.ts
│   ├── agents.test.ts
│   └── mocks/agents.ts
└── types/
    └── agents.ts
```

## Implementation Gaps

| Gap | Priority | Action |
|-----|----------|--------|
| Field name mismatch (`id` vs `agent_id`) | Critical | Update types/agents.ts and all components |
| Status enum mismatch (`failed` vs `error`) | Critical | Update types and selectors |
| Timeline endpoint missing | Critical | Blocked on P02-F08 |
| Metrics response structure | Warning | Update response handling |
| WebSocket doesn't receive broadcasts | Warning | Blocked on P02-F08 |

## Styling

- Use existing Tailwind CSS classes from P05-F01
- Status colors:
  - idle: `bg-gray-100 text-gray-600`
  - running: `bg-blue-100 text-blue-600`
  - blocked: `bg-yellow-100 text-yellow-600`
  - error: `bg-red-100 text-red-600`
  - completed: `bg-green-100 text-green-600`

## Route Configuration

```typescript
// App.tsx
<Route path="/agents" element={<AgentsDashboardPage />} />
```

## Accessibility

- All interactive elements have proper ARIA labels
- Status cards are keyboard navigable
- Log panel supports keyboard scrolling
- Color is not the only indicator of status (icons + text)
