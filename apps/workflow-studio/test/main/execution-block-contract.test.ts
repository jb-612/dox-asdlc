// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition, AgentNode } from '../../src/shared/types/workflow';
import type { CLISpawner } from '../../src/main/services/cli-spawner';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as realUuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as BrowserWindow;
}

function createMockCLISpawner(): CLISpawner {
  return {
    spawn: vi.fn().mockReturnValue({
      id: 'cli-session-1',
      config: { command: 'claude', args: [], cwd: '/tmp' },
      status: 'running',
      pid: 9999,
      startedAt: new Date().toISOString(),
    }),
    kill: vi.fn().mockReturnValue(true),
    write: vi.fn().mockReturnValue(true),
    list: vi.fn().mockReturnValue([]),
    killAll: vi.fn(),
  } as unknown as CLISpawner;
}

function makeNode(overrides?: Partial<AgentNode>): AgentNode {
  return {
    id: 'node-1',
    type: 'coding',
    label: 'Coder',
    config: {},
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function createTwoNodeWorkflow(): WorkflowDefinition {
  return {
    id: 'workflow-1',
    metadata: {
      name: 'Test Workflow',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes: [
      {
        id: 'node-1',
        type: 'planner',
        label: 'Planner',
        config: { outputChecklist: ['Create a plan document', 'List all tasks'] },
        inputs: [],
        outputs: [],
        position: { x: 0, y: 0 },
        description: 'Plan the feature',
      },
      {
        id: 'node-2',
        type: 'backend',
        label: 'Backend',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 0, y: 100 },
        description: 'Implement the feature',
      },
    ],
    transitions: [
      {
        id: 'trans-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        condition: { type: 'always' },
      },
    ],
    gates: [],
    variables: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stateless agent block contract', () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let mockMainWindow: BrowserWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockMainWindow = createMockMainWindow();
    const mod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = mod.ExecutionEngine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // buildSystemPrompt: output deliverables instructions
  // -------------------------------------------------------------------------

  describe('buildSystemPrompt — output deliverables instructions', () => {
    it('should include output path instruction with the node ID', () => {
      const engine = new ExecutionEngine(mockMainWindow);
      const node = makeNode({
        id: 'node-abc',
        description: 'Write the code',
      });

      const prompt = engine.buildSystemPrompt(node);

      expect(prompt).toContain('.output/block-node-abc.json');
      expect(prompt).toContain('deliverables');
    });

    it('should include output checklist items when present', () => {
      const engine = new ExecutionEngine(mockMainWindow);
      const node = makeNode({
        id: 'node-1',
        description: 'Plan the feature',
        config: {
          outputChecklist: ['Create plan document', 'List all tasks'],
        },
      });

      const prompt = engine.buildSystemPrompt(node);

      expect(prompt).toContain('1. Create plan document');
      expect(prompt).toContain('2. List all tasks');
    });

    it('should not include output checklist section when checklist is empty', () => {
      const engine = new ExecutionEngine(mockMainWindow);
      const node = makeNode({
        id: 'node-1',
        description: 'Write code',
        config: { outputChecklist: [] },
      });

      const prompt = engine.buildSystemPrompt(node);

      expect(prompt).not.toContain('You must produce:');
    });
  });

  // -------------------------------------------------------------------------
  // buildSystemPrompt: previous block context
  // -------------------------------------------------------------------------

  describe('buildSystemPrompt — previous block results context', () => {
    it('should include previous block results when provided', () => {
      const engine = new ExecutionEngine(mockMainWindow);
      const node = makeNode({
        id: 'node-2',
        description: 'Implement the feature',
      });

      const previousResults = [
        {
          blockId: 'planner',
          nodeId: 'node-1',
          status: 'success' as const,
          deliverables: {
            blockType: 'plan' as const,
            taskList: ['T01: Setup', 'T02: Implement'],
          },
          outputPath: '.output/block-node-1.json',
        },
      ];

      const prompt = engine.buildSystemPrompt(node, undefined, previousResults);

      expect(prompt).toContain('Previous block results');
      expect(prompt).toContain('node-1');
      expect(prompt).toContain('success');
    });

    it('should not include previous results section when array is empty', () => {
      const engine = new ExecutionEngine(mockMainWindow);
      const node = makeNode({
        id: 'node-1',
        description: 'First block',
      });

      const prompt = engine.buildSystemPrompt(node, undefined, []);

      expect(prompt).not.toContain('Previous block results');
    });

    it('should not include previous results section when undefined', () => {
      const engine = new ExecutionEngine(mockMainWindow);
      const node = makeNode({
        id: 'node-1',
        description: 'First block',
      });

      const prompt = engine.buildSystemPrompt(node);

      expect(prompt).not.toContain('Previous block results');
    });
  });

  // -------------------------------------------------------------------------
  // readBlockResult
  // -------------------------------------------------------------------------

  describe('readBlockResult', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `block-contract-test-${realUuidv4()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should return parsed BlockResult when .output/block-<nodeId>.json exists', () => {
      const outputDir = join(tempDir, '.output');
      mkdirSync(outputDir, { recursive: true });

      const blockResult = {
        blockId: 'coding',
        nodeId: 'node-1',
        status: 'success',
        deliverables: {
          blockType: 'code',
          filesChanged: ['src/main.ts', 'src/utils.ts'],
          diffSummary: 'Added 50 lines',
        },
        outputPath: '.output/block-node-1.json',
      };

      writeFileSync(
        join(outputDir, 'block-node-1.json'),
        JSON.stringify(blockResult),
      );

      const engine = new ExecutionEngine(mockMainWindow);
      const result = engine.readBlockResult(tempDir, 'node-1');

      expect(result).not.toBeNull();
      expect(result!.nodeId).toBe('node-1');
      expect(result!.status).toBe('success');
      expect(result!.deliverables).toEqual({
        blockType: 'code',
        filesChanged: ['src/main.ts', 'src/utils.ts'],
        diffSummary: 'Added 50 lines',
      });
    });

    it('should return null when .output directory does not exist', () => {
      const engine = new ExecutionEngine(mockMainWindow);
      const result = engine.readBlockResult(tempDir, 'node-nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when block output file does not exist', () => {
      const outputDir = join(tempDir, '.output');
      mkdirSync(outputDir, { recursive: true });

      const engine = new ExecutionEngine(mockMainWindow);
      const result = engine.readBlockResult(tempDir, 'node-missing');

      expect(result).toBeNull();
    });

    it('should return null when file contains invalid JSON', () => {
      const outputDir = join(tempDir, '.output');
      mkdirSync(outputDir, { recursive: true });

      writeFileSync(
        join(outputDir, 'block-node-bad.json'),
        'not valid json {{{',
      );

      const engine = new ExecutionEngine(mockMainWindow);
      const result = engine.readBlockResult(tempDir, 'node-bad');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Integration: executeNodeReal stores block result after CLI exit
  // -------------------------------------------------------------------------

  describe('executeNodeReal stores block result on completion', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `block-contract-exec-${realUuidv4()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should read and store block result in nodeState.output after successful CLI exit', async () => {
      // Prepare the block output file that the "agent" would have written
      const outputDir = join(tempDir, '.output');
      mkdirSync(outputDir, { recursive: true });

      const blockResult = {
        blockId: 'backend',
        nodeId: 'node-1',
        status: 'success',
        deliverables: {
          blockType: 'code',
          filesChanged: ['src/server.ts'],
        },
      };

      writeFileSync(
        join(outputDir, 'block-node-1.json'),
        JSON.stringify(blockResult),
      );

      const mockSpawner = createMockCLISpawner();
      const engine = new ExecutionEngine(mockMainWindow, {
        mockMode: false,
        cliSpawner: mockSpawner,
        nodeTimeoutMs: 5000,
        workingDirectory: tempDir,
      });

      const workflow: WorkflowDefinition = {
        id: 'workflow-1',
        metadata: {
          name: 'Test',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
        nodes: [
          {
            id: 'node-1',
            type: 'backend',
            label: 'Backend',
            config: { timeoutSeconds: 5 },
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
            description: 'Build the backend',
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      const execPromise = engine.start(workflow);
      await new Promise((r) => setTimeout(r, 50));

      // Simulate the CLI exiting successfully
      engine.handleCLIExit('cli-session-1', 0);

      const execution = await execPromise;

      expect(execution.nodeStates['node-1'].status).toBe('completed');
      // The output should now contain the parsed block result
      const output = execution.nodeStates['node-1'].output as Record<string, unknown>;
      expect(output).toBeDefined();
      expect(output.blockResult).toEqual(blockResult);
    });

    it('should still complete successfully when no block result file exists', async () => {
      const mockSpawner = createMockCLISpawner();
      const engine = new ExecutionEngine(mockMainWindow, {
        mockMode: false,
        cliSpawner: mockSpawner,
        nodeTimeoutMs: 5000,
        workingDirectory: tempDir,
      });

      const workflow: WorkflowDefinition = {
        id: 'workflow-1',
        metadata: {
          name: 'Test',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
        nodes: [
          {
            id: 'node-1',
            type: 'backend',
            label: 'Backend',
            config: { timeoutSeconds: 5 },
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      const execPromise = engine.start(workflow);
      await new Promise((r) => setTimeout(r, 50));

      engine.handleCLIExit('cli-session-1', 0);

      const execution = await execPromise;

      expect(execution.nodeStates['node-1'].status).toBe('completed');
      // Output should just have cliSessionId and exitCode, no blockResult
      const output = execution.nodeStates['node-1'].output as Record<string, unknown>;
      expect(output.cliSessionId).toBe('cli-session-1');
      expect(output.blockResult).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Integration: buildSystemPrompt includes context from prior blocks
  // -------------------------------------------------------------------------

  describe('buildSystemPrompt gathers prior block results for multi-node workflow', () => {
    it('should include all prior completed block summaries in the second node prompt', () => {
      const engine = new ExecutionEngine(mockMainWindow);

      const priorResults = [
        {
          blockId: 'planner',
          nodeId: 'node-1',
          status: 'success' as const,
          deliverables: {
            blockType: 'plan' as const,
            taskList: ['T01: Setup', 'T02: Implement'],
          },
          outputPath: '.output/block-node-1.json',
        },
      ];

      const node2 = makeNode({
        id: 'node-2',
        description: 'Implement the feature',
        config: {
          outputChecklist: ['Write all tests', 'Implement the service'],
        },
      });

      const prompt = engine.buildSystemPrompt(node2, ['No force push'], priorResults);

      // Should contain workflow rules
      expect(prompt).toContain('No force push');
      // Should contain output instructions
      expect(prompt).toContain('.output/block-node-2.json');
      // Should contain output checklist
      expect(prompt).toContain('1. Write all tests');
      expect(prompt).toContain('2. Implement the service');
      // Should contain prior block context
      expect(prompt).toContain('Previous block results');
      expect(prompt).toContain('node-1');
    });
  });
});
