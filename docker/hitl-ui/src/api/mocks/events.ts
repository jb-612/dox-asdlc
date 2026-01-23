/**
 * Mock data for Event Stream
 */

// Event types matching backend event schema
export type EventType =
  | 'session.started'
  | 'session.completed'
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'gate.created'
  | 'gate.decided'
  | 'artifact.created'
  | 'artifact.approved'
  | 'worker.status'
  | 'error';

export interface StreamEvent {
  id: string;
  type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

// Helper functions
const now = new Date();
const secondsAgo = (seconds: number) =>
  new Date(now.getTime() - seconds * 1000).toISOString();

// Mock event history
export const mockEventHistory: StreamEvent[] = [
  {
    id: 'evt_001',
    type: 'session.started',
    timestamp: secondsAgo(300),
    data: {
      session_id: 'sess_001',
      epic_id: 'EPIC-001',
      repo: 'dox-asdlc',
    },
  },
  {
    id: 'evt_002',
    type: 'run.started',
    timestamp: secondsAgo(280),
    data: {
      run_id: 'run_001',
      agent_type: 'discovery_agent',
      model: 'sonnet',
    },
  },
  {
    id: 'evt_003',
    type: 'artifact.created',
    timestamp: secondsAgo(250),
    data: {
      artifact_id: 'art_001',
      name: 'auth-system.prd.md',
      type: 'file',
      created_by: 'discovery_agent',
    },
  },
  {
    id: 'evt_004',
    type: 'gate.created',
    timestamp: secondsAgo(240),
    data: {
      gate_id: 'gate_001',
      type: 'prd_review',
      session_id: 'sess_001',
    },
  },
  {
    id: 'evt_005',
    type: 'run.completed',
    timestamp: secondsAgo(200),
    data: {
      run_id: 'run_001',
      status: 'completed',
      tokens_used: 15000,
      cost_usd: 0.045,
    },
  },
  {
    id: 'evt_006',
    type: 'gate.decided',
    timestamp: secondsAgo(150),
    data: {
      gate_id: 'gate_001',
      decision: 'approve',
      decided_by: 'john.smith',
    },
  },
  {
    id: 'evt_007',
    type: 'artifact.approved',
    timestamp: secondsAgo(145),
    data: {
      artifact_id: 'art_001',
      approved_by: 'john.smith',
    },
  },
  {
    id: 'evt_008',
    type: 'run.started',
    timestamp: secondsAgo(120),
    data: {
      run_id: 'run_002',
      agent_type: 'design_agent',
      model: 'opus',
    },
  },
  {
    id: 'evt_009',
    type: 'worker.status',
    timestamp: secondsAgo(60),
    data: {
      worker_id: 'worker_003',
      status: 'idle',
      last_task: 'run_002',
    },
  },
  {
    id: 'evt_010',
    type: 'run.started',
    timestamp: secondsAgo(30),
    data: {
      run_id: 'run_005',
      agent_type: 'review_agent',
      model: 'sonnet',
    },
  },
];

// Mock event generator for simulating real-time events
let eventCounter = mockEventHistory.length;

export function generateMockEvent(): StreamEvent {
  eventCounter++;
  const eventTypes: EventType[] = [
    'run.started',
    'run.completed',
    'artifact.created',
    'gate.created',
    'worker.status',
  ];

  const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];

  const eventData: Record<string, unknown> = {};

  switch (type) {
    case 'run.started':
      eventData.run_id = `run_${String(eventCounter).padStart(3, '0')}`;
      eventData.agent_type = ['coding_agent', 'test_agent', 'review_agent'][
        Math.floor(Math.random() * 3)
      ];
      eventData.model = ['sonnet', 'opus', 'haiku'][Math.floor(Math.random() * 3)];
      break;
    case 'run.completed':
      eventData.run_id = `run_${String(eventCounter - 1).padStart(3, '0')}`;
      eventData.status = 'completed';
      eventData.tokens_used = Math.floor(Math.random() * 50000) + 5000;
      eventData.cost_usd = Math.random() * 0.5;
      break;
    case 'artifact.created':
      eventData.artifact_id = `art_${String(eventCounter).padStart(3, '0')}`;
      eventData.name = `generated-file-${eventCounter}.py`;
      eventData.type = 'file';
      eventData.created_by = 'coding_agent';
      break;
    case 'gate.created':
      eventData.gate_id = `gate_${String(eventCounter).padStart(3, '0')}`;
      eventData.type = ['code_review', 'test_review', 'design_review'][
        Math.floor(Math.random() * 3)
      ];
      eventData.session_id = 'sess_001';
      break;
    case 'worker.status':
      eventData.worker_id = `worker_${String(Math.floor(Math.random() * 5) + 1).padStart(3, '0')}`;
      eventData.status = ['idle', 'running'][Math.floor(Math.random() * 2)];
      break;
  }

  return {
    id: `evt_${String(eventCounter).padStart(3, '0')}`,
    type,
    timestamp: new Date().toISOString(),
    data: eventData,
  };
}

// Filter events by type
export function filterEventsByType(
  events: StreamEvent[],
  types: EventType[]
): StreamEvent[] {
  if (types.length === 0) return events;
  return events.filter((e) => types.includes(e.type));
}

// Get event description for display
export function getEventDescription(event: StreamEvent): string {
  switch (event.type) {
    case 'session.started':
      return `Session started for ${event.data.epic_id || 'unknown epic'}`;
    case 'session.completed':
      return `Session ${event.data.session_id} completed`;
    case 'run.started':
      return `${event.data.agent_type} started (${event.data.model})`;
    case 'run.completed':
      return `Run ${event.data.run_id} completed - ${event.data.tokens_used} tokens`;
    case 'run.failed':
      return `Run ${event.data.run_id} failed: ${event.data.error || 'Unknown error'}`;
    case 'gate.created':
      return `New ${event.data.type} gate awaiting decision`;
    case 'gate.decided':
      return `Gate ${event.data.decision} by ${event.data.decided_by}`;
    case 'artifact.created':
      return `Artifact created: ${event.data.name}`;
    case 'artifact.approved':
      return `Artifact ${event.data.artifact_id} approved`;
    case 'worker.status':
      return `Worker ${event.data.worker_id}: ${event.data.status}`;
    case 'error':
      return `Error: ${event.data.message || 'Unknown error'}`;
    default:
      return `Event: ${event.type}`;
  }
}

// Get event color for display
export function getEventColor(type: EventType): string {
  switch (type) {
    case 'session.started':
    case 'run.started':
      return 'text-status-info';
    case 'session.completed':
    case 'run.completed':
    case 'artifact.approved':
      return 'text-status-success';
    case 'run.failed':
    case 'error':
      return 'text-status-error';
    case 'gate.created':
    case 'artifact.created':
      return 'text-status-warning';
    case 'gate.decided':
      return 'text-accent-teal';
    case 'worker.status':
      return 'text-text-muted';
    default:
      return 'text-text-secondary';
  }
}

// Simulated WebSocket connection for mock mode
export class MockEventStream {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: ((event: StreamEvent) => void)[] = [];

  connect(): void {
    // Simulate events every 3-8 seconds
    this.intervalId = setInterval(() => {
      const event = generateMockEvent();
      this.listeners.forEach((listener) => listener(event));
    }, Math.random() * 5000 + 3000);
  }

  disconnect(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onEvent(listener: (event: StreamEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  isConnected(): boolean {
    return this.intervalId !== null;
  }
}

// Singleton mock event stream
export const mockEventStream = new MockEventStream();
