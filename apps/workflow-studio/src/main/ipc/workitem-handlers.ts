import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { WorkItem, WorkItemType } from '../../shared/types/workitem';

// ---------------------------------------------------------------------------
// Sample work items for development
// ---------------------------------------------------------------------------

const SAMPLE_WORK_ITEMS: WorkItem[] = [
  {
    id: uuidv4(),
    type: 'prd',
    source: 'filesystem',
    title: 'P05-F01 Workflow Studio MVP',
    description: 'Build the visual workflow builder for agentic SDLC',
    path: '.workitems/P05-F01-workflow-studio/',
    labels: ['p05', 'frontend', 'mvp'],
    content:
      '# Workflow Studio MVP\n\nVisual drag-and-drop builder for aSDLC workflows.\n\n## Goals\n- Canvas-based node editor\n- HITL gate configuration\n- Workflow validation\n- CLI session management',
    metadata: { priority: 'high', epic: 'P05' },
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-10T14:30:00Z',
  },
  {
    id: uuidv4(),
    type: 'prd',
    source: 'filesystem',
    title: 'P04-F02 Review Swarm',
    description: 'Implement multi-agent code review with swarm coordination',
    path: '.workitems/P04-F02-review-swarm/',
    labels: ['p04', 'backend', 'review'],
    content:
      '# Review Swarm\n\nMulti-agent code review using diverse model routing.\n\n## Goals\n- Multiple reviewer agents\n- Consensus aggregation\n- Heuristic diversity',
    metadata: { priority: 'medium', epic: 'P04' },
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-02-05T11:00:00Z',
  },
  {
    id: uuidv4(),
    type: 'issue',
    source: 'github',
    title: 'Fix TDD engine test ordering',
    description: 'Tests run in non-deterministic order causing flaky failures',
    url: 'https://github.com/org/dox-asdlc/issues/42',
    labels: ['bug', 'tdd-engine'],
    content:
      '## Problem\nTests run in non-deterministic order.\n\n## Steps to Reproduce\n1. Run test suite 10 times\n2. Observe intermittent failures\n\n## Expected\nDeterministic test ordering.',
    metadata: { priority: 'high', assignee: 'backend' },
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-02-15T16:00:00Z',
  },
  {
    id: uuidv4(),
    type: 'issue',
    source: 'github',
    title: 'Add metrics dashboard filters',
    description: 'Allow filtering metrics by service name and time range',
    url: 'https://github.com/org/dox-asdlc/issues/58',
    labels: ['enhancement', 'monitoring'],
    content:
      '## Feature\nAdd dropdown filters for service name and time range selector.\n\n## Acceptance Criteria\n- Service dropdown with all active services\n- Time range: 5m, 15m, 1h, 6h, 24h, 7d\n- Auto-refresh toggle',
    metadata: { priority: 'low', assignee: 'frontend' },
    createdAt: '2026-02-10T12:00:00Z',
    updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: uuidv4(),
    type: 'idea',
    source: 'manual',
    title: 'Workflow template marketplace',
    description: 'Community-shared workflow templates with ratings',
    labels: ['idea', 'future'],
    content:
      '# Idea: Template Marketplace\n\nAllow users to share and discover workflow templates.\n\n- Browse community templates\n- Rate and review\n- One-click import\n- Version compatibility checks',
    createdAt: '2026-02-12T15:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// IPC handler registration
// ---------------------------------------------------------------------------

export function registerWorkItemHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.WORKITEM_LIST,
    async (_event, type?: string) => {
      if (type && type !== 'all') {
        return SAMPLE_WORK_ITEMS.filter((item) => item.type === type);
      }
      return SAMPLE_WORK_ITEMS;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKITEM_GET,
    async (_event, id: string) => {
      return SAMPLE_WORK_ITEMS.find((item) => item.id === id) ?? null;
    },
  );
}
