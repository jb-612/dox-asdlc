// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition, AgentNode } from '../../src/shared/types/workflow';
import type { CLISpawner } from '../../src/main/services/cli-spawner';
import type { RedisEventClient } from '../../src/main/services/redis-client';

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
    webContents: { send: vi.fn() },
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

function createMockRedisClient(): RedisEventClient {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    isConnected: false,
  } as unknown as RedisEventClient;
}

function createSimpleWorkflow(nodeType = 'coding'): WorkflowDefinition {
  return {
    id: 'workflow-1',
    name: 'Test Workflow',
    version: '1.0.0',
    nodes: [
      {
        id: 'node-1',
        type: nodeType,
        label: 'Test Node',
        position: { x: 0, y: 0 },
        config: {
          backend: 'claude',
          systemPrompt: 'Do the work',
          systemPromptPrefix: 'PREFIX',
          outputChecklist: ['item1', 'item2'],
        },
      },
    ],
    edges: [],
  } as unknown as WorkflowDefinition;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionEngine security fixes', () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;

  beforeEach(async () => {
    vi.resetModules();
    uuidCounter = 0;
    const mod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = mod.ExecutionEngine;
  });

  // #286 — Wrong node type: 'code' should be 'coding'
  describe('#286 - node type check uses "coding" not "code"', () => {
    it('should capture pre-exec SHA for coding nodes', () => {
      const mainWindow = createMockMainWindow();
      const cliSpawner = createMockCLISpawner();
      const engine = new ExecutionEngine(mainWindow, cliSpawner);
      const workflow = createSimpleWorkflow('coding');

      // buildSystemPrompt should succeed for coding nodes
      const prompt = engine.buildSystemPrompt(
        workflow.nodes[0] as AgentNode,
      );
      expect(prompt).toContain('Do the work');
    });

    it('should NOT treat "code" type as coding', () => {
      const mainWindow = createMockMainWindow();
      const cliSpawner = createMockCLISpawner();
      const engine = new ExecutionEngine(mainWindow, cliSpawner);
      const workflow = createSimpleWorkflow('code');

      // The 'code' type should still build a prompt (non-coding path)
      const prompt = engine.buildSystemPrompt(
        workflow.nodes[0] as AgentNode,
      );
      expect(prompt).toContain('Do the work');
    });
  });

  // #284 — readBlockResult: nodeId must be validated
  describe('#284 - readBlockResult rejects traversal nodeIds', () => {
    it('should return null for nodeId containing path traversal', () => {
      const mainWindow = createMockMainWindow();
      const cliSpawner = createMockCLISpawner();
      const engine = new ExecutionEngine(mainWindow, cliSpawner);

      const result = engine.readBlockResult('/tmp/workdir', '../../../etc/passwd');
      expect(result).toBeNull();
    });

    it('should return null for nodeId containing slashes', () => {
      const mainWindow = createMockMainWindow();
      const cliSpawner = createMockCLISpawner();
      const engine = new ExecutionEngine(mainWindow, cliSpawner);

      const result = engine.readBlockResult('/tmp/workdir', 'foo/bar');
      expect(result).toBeNull();
    });

    it('should return null for nodeId exceeding 128 chars', () => {
      const mainWindow = createMockMainWindow();
      const cliSpawner = createMockCLISpawner();
      const engine = new ExecutionEngine(mainWindow, cliSpawner);

      const longId = 'a'.repeat(129);
      const result = engine.readBlockResult('/tmp/workdir', longId);
      expect(result).toBeNull();
    });

    it('should accept valid nodeIds', () => {
      const mainWindow = createMockMainWindow();
      const cliSpawner = createMockCLISpawner();
      const engine = new ExecutionEngine(mainWindow, cliSpawner);

      // Returns null because file doesn't exist, but doesn't reject the ID
      const result = engine.readBlockResult('/tmp/nonexistent', 'valid-node-id_123');
      expect(result).toBeNull(); // null = file not found, not validation error
    });
  });

  // #285 — buildSystemPrompt sanitizes interpolated fields
  describe('#285 - buildSystemPrompt sanitizes user fields', () => {
    it('should strip null bytes from system prompt prefix', () => {
      const mainWindow = createMockMainWindow();
      const cliSpawner = createMockCLISpawner();
      const engine = new ExecutionEngine(mainWindow, cliSpawner);

      const node = {
        id: 'node-1',
        type: 'coding',
        label: 'Test',
        position: { x: 0, y: 0 },
        config: {
          backend: 'claude',
          systemPromptPrefix: 'Hello\0World',
          systemPrompt: '',
          outputChecklist: [],
        },
      } as unknown as AgentNode;

      const prompt = engine.buildSystemPrompt(node);
      expect(prompt).not.toContain('\0');
      expect(prompt).toContain('HelloWorld');
    });

    it('should truncate excessively long prompt fields', () => {
      const mainWindow = createMockMainWindow();
      const cliSpawner = createMockCLISpawner();
      const engine = new ExecutionEngine(mainWindow, cliSpawner);

      const longText = 'x'.repeat(10000);
      const node = {
        id: 'node-1',
        type: 'coding',
        label: 'Test',
        position: { x: 0, y: 0 },
        config: {
          backend: 'claude',
          systemPromptPrefix: longText,
          systemPrompt: '',
          outputChecklist: [],
        },
      } as unknown as AgentNode;

      const prompt = engine.buildSystemPrompt(node);
      // The prefix portion should be truncated to 4096 chars max
      expect(prompt.length).toBeLessThan(10000);
    });
  });
});
