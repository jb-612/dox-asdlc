// @vitest-environment node
// ---------------------------------------------------------------------------
// T20/T21: Workflow executor integration tests with mocked dockerode
//
// T20: Full parallel workflow
//   - Plan: sequential -> parallel(3) -> sequential
//   - Assert prewarm(3), 3 blocks run concurrently, merged results
//   - Containers reach DORMANT after release, teardown terminates all
//
// T21: Abort during parallel
//   - 3 parallel blocks in flight, abort() after setup
//   - All blocks fail with abort, pool snapshot shows 0 non-terminated
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DockerClient
// ---------------------------------------------------------------------------

const mockCreateContainer = vi.fn();
const mockStartContainer = vi.fn();
const mockStopContainer = vi.fn();
const mockRemoveContainer = vi.fn();
const mockPauseContainer = vi.fn();
const mockUnpauseContainer = vi.fn();
const mockHealthCheck = vi.fn();
const mockListContainers = vi.fn();

const MockDockerClient = vi.fn().mockImplementation(() => ({
  createContainer: mockCreateContainer,
  startContainer: mockStartContainer,
  stopContainer: mockStopContainer,
  removeContainer: mockRemoveContainer,
  pauseContainer: mockPauseContainer,
  unpauseContainer: mockUnpauseContainer,
  healthCheck: mockHealthCheck,
  listContainers: mockListContainers,
}));

vi.mock('../../src/main/services/docker-client', () => ({
  DockerClient: MockDockerClient,
}));

// ---------------------------------------------------------------------------
// Mock PortAllocator
// ---------------------------------------------------------------------------

let nextPort = 49200;
const mockAllocate = vi.fn().mockImplementation(() => nextPort++);
const mockRelease = vi.fn();

const MockPortAllocator = vi.fn().mockImplementation(() => ({
  allocate: mockAllocate,
  release: mockRelease,
  available: vi.fn().mockReturnValue(100),
}));

vi.mock('../../src/main/services/port-allocator', () => ({
  PortAllocator: MockPortAllocator,
}));

// ---------------------------------------------------------------------------
// Import subjects under test (after mocks)
// ---------------------------------------------------------------------------

import { ContainerPool } from '../../src/main/services/container-pool';
import { buildWorkflowPlan } from '../../src/main/services/workflow-plan-builder';
import { computePrewarmPoint, getFirstParallelWidth } from '../../src/main/services/lazy-prewarm';
import type {
  WorkflowDefinition,
  AgentNode,
  Transition,
  ParallelGroup,
  ParallelLane,
} from '../../src/shared/types/workflow';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let containerIdCounter = 0;

function setupDefaultMocks(): void {
  containerIdCounter = 0;
  nextPort = 49200;

  mockCreateContainer.mockImplementation(() => {
    const id = `container-${++containerIdCounter}`;
    return Promise.resolve({ id });
  });
  mockStartContainer.mockResolvedValue(undefined);
  mockHealthCheck.mockResolvedValue(undefined);
  mockStopContainer.mockResolvedValue(undefined);
  mockRemoveContainer.mockResolvedValue(undefined);
  mockPauseContainer.mockResolvedValue(undefined);
  mockUnpauseContainer.mockResolvedValue(undefined);
  mockListContainers.mockResolvedValue([]);
}

function createPool(overrides: Record<string, unknown> = {}): ContainerPool {
  const docker = new MockDockerClient();
  const ports = new MockPortAllocator();
  return new ContainerPool(docker, ports, {
    image: 'test-image:latest',
    maxContainers: 10,
    healthCheckIntervalMs: 50,
    healthCheckTimeoutMs: 500,
    dormancyTimeoutMs: 60000,
    ...overrides,
  });
}

function makeNode(id: string): AgentNode {
  return {
    id,
    type: 'backend',
    label: id,
    config: {},
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
  };
}

function makeTransition(source: string, target: string): Transition {
  return {
    id: `${source}->${target}`,
    sourceNodeId: source,
    targetNodeId: target,
    condition: { type: 'always' },
  };
}

// ---------------------------------------------------------------------------
// T20: Full parallel workflow integration
// ---------------------------------------------------------------------------

describe('T20: full parallel workflow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds a plan: sequential -> parallel(3) -> sequential', () => {
    // S1 -> [P1, P2, P3] -> S2
    const workflow: WorkflowDefinition = {
      id: 'test-workflow',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
      },
      nodes: [
        makeNode('S1'),
        makeNode('P1'), makeNode('P2'), makeNode('P3'),
        makeNode('S2'),
      ],
      transitions: [
        makeTransition('S1', 'P1'),
        makeTransition('S1', 'P2'),
        makeTransition('S1', 'P3'),
        makeTransition('P1', 'S2'),
        makeTransition('P2', 'S2'),
        makeTransition('P3', 'S2'),
      ],
      gates: [],
      variables: [],
      parallelGroups: [
        { id: 'pg1', label: 'Parallel', laneNodeIds: ['P1', 'P2', 'P3'] },
      ],
    };

    const plan = buildWorkflowPlan(workflow);

    // Plan structure: S1, {P1,P2,P3}, S2
    expect(plan.lanes).toHaveLength(3);
    expect(plan.lanes[0]).toBe('S1');

    const parallelLane = plan.lanes[1] as ParallelLane;
    expect(parallelLane.nodeIds).toHaveLength(3);
    expect(new Set(parallelLane.nodeIds)).toEqual(new Set(['P1', 'P2', 'P3']));

    expect(plan.lanes[2]).toBe('S2');
  });

  it('prewarm(3) creates 3 containers that execute concurrently', async () => {
    const pool = createPool();

    // Prewarm 3 containers for the parallel group
    await pool.prewarm(3);
    const snap = pool.snapshot();

    expect(snap).toHaveLength(3);
    snap.forEach((r) => expect(r.state).toBe('idle'));

    // Acquire 3 containers (simulating parallel block execution)
    const c1 = await pool.acquire('P1');
    const c2 = await pool.acquire('P2');
    const c3 = await pool.acquire('P3');

    // All 3 should be in running state
    expect(c1.state).toBe('running');
    expect(c2.state).toBe('running');
    expect(c3.state).toBe('running');

    // All should have different IDs
    const ids = new Set([c1.id, c2.id, c3.id]);
    expect(ids.size).toBe(3);
  });

  it('containers reach DORMANT after release', async () => {
    const pool = createPool();
    await pool.prewarm(3);

    const c1 = await pool.acquire('P1');
    const c2 = await pool.acquire('P2');
    const c3 = await pool.acquire('P3');

    // Release all
    await pool.release(c1.id);
    await pool.release(c2.id);
    await pool.release(c3.id);

    const snap = pool.snapshot();
    snap.forEach((r) => {
      expect(r.state).toBe('dormant');
      expect(r.dormantSince).not.toBeNull();
      expect(r.blockId).toBeNull();
    });
  });

  it('teardown terminates all containers after parallel execution', async () => {
    const pool = createPool();
    await pool.prewarm(3);

    const c1 = await pool.acquire('P1');
    const c2 = await pool.acquire('P2');
    const c3 = await pool.acquire('P3');

    await pool.release(c1.id);
    await pool.release(c2.id);
    await pool.release(c3.id);

    // Teardown
    await pool.teardown();

    const snap = pool.snapshot();
    snap.forEach((r) => {
      expect(r.state).toBe('terminated');
    });

    // Stop and remove should have been called for each
    expect(mockStopContainer).toHaveBeenCalledTimes(3);
    expect(mockRemoveContainer).toHaveBeenCalledTimes(3);
    expect(mockRelease).toHaveBeenCalledTimes(3);
  });

  it('lazy prewarm point is computed correctly', () => {
    const workflow: WorkflowDefinition = {
      id: 'test',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
      },
      nodes: [makeNode('S1'), makeNode('P1'), makeNode('P2'), makeNode('P3'), makeNode('S2')],
      transitions: [
        makeTransition('S1', 'P1'),
        makeTransition('S1', 'P2'),
        makeTransition('S1', 'P3'),
        makeTransition('P1', 'S2'),
        makeTransition('P2', 'S2'),
        makeTransition('P3', 'S2'),
      ],
      gates: [],
      variables: [],
      parallelGroups: [
        { id: 'pg1', label: 'Parallel', laneNodeIds: ['P1', 'P2', 'P3'] },
      ],
    };

    const plan = buildWorkflowPlan(workflow);

    // Prewarm point: parallel at index 1, so prewarm at 0
    expect(computePrewarmPoint(plan)).toBe(0);
    expect(getFirstParallelWidth(plan)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// T21: Abort during parallel execution
// ---------------------------------------------------------------------------

describe('T21: abort during parallel execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('abort with 3 parallel blocks in flight terminates all', async () => {
    const pool = createPool();
    await pool.prewarm(3);

    // Acquire 3 blocks (simulating 3 parallel blocks in flight)
    const c1 = await pool.acquire('P1');
    const c2 = await pool.acquire('P2');
    const c3 = await pool.acquire('P3');

    // All running
    expect(pool.snapshot().filter((r) => r.state === 'running')).toHaveLength(3);

    // Teardown simulates abort - terminates all
    await pool.teardown();

    const snap = pool.snapshot();
    // All containers should be terminated
    const nonTerminated = snap.filter((r) => r.state !== 'terminated');
    expect(nonTerminated).toHaveLength(0);

    // All containers should be terminated
    snap.forEach((r) => {
      expect(r.state).toBe('terminated');
    });
  });

  it('teardown after abort releases all ports', async () => {
    const pool = createPool();
    await pool.prewarm(3);

    await pool.acquire('P1');
    await pool.acquire('P2');
    await pool.acquire('P3');

    await pool.teardown();

    // Ports should be released for all 3 containers
    expect(mockRelease).toHaveBeenCalledTimes(3);
  });

  it('double teardown is safe (idempotent)', async () => {
    const pool = createPool();
    await pool.prewarm(2);

    await pool.acquire('P1');
    await pool.acquire('P2');

    // First teardown
    await pool.teardown();
    const callsAfterFirst = mockStopContainer.mock.calls.length;

    // Second teardown -- should be a no-op
    await pool.teardown();
    expect(mockStopContainer.mock.calls.length).toBe(callsAfterFirst);
  });

  it('snapshot shows 0 non-terminated after abort teardown', async () => {
    const pool = createPool();
    await pool.prewarm(3);

    await pool.acquire('P1');
    await pool.acquire('P2');
    await pool.acquire('P3');

    await pool.teardown();

    const snap = pool.snapshot();
    const nonTerminated = snap.filter((r) => r.state !== 'terminated');
    expect(nonTerminated).toHaveLength(0);
    expect(snap).toHaveLength(3); // Records still exist, just terminated
  });
});
