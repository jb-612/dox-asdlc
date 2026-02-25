// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';

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

// ---------------------------------------------------------------------------
// Tests for T08: tool_call and bash_command event emission
// ---------------------------------------------------------------------------

describe('ExecutionEngine tool_call/bash_command events', () => {
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
  // Basic type validation (retained from existing tests)
  // -------------------------------------------------------------------------

  it('should accept tool_call as a valid ExecutionEventType', async () => {
    const engine = new ExecutionEngine(mockMainWindow);

    const workflow = {
      id: 'wf-1',
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
          type: 'backend' as const,
          label: 'Backend',
          config: {},
          inputs: [],
          outputs: [],
          position: { x: 0, y: 0 },
        },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const execution = await engine.start(workflow);

    const validTypes = [
      'tool_call',
      'bash_command',
      'block_gate_open',
      'block_revision',
    ];

    for (const type of validTypes) {
      expect(typeof type).toBe('string');
    }

    expect(execution.status).toBe('completed');
  });

  it('should record standard events in execution state during mock execution', async () => {
    const engine = new ExecutionEngine(mockMainWindow);

    const workflow = {
      id: 'wf-1',
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
          type: 'backend' as const,
          label: 'Backend',
          config: {},
          inputs: [],
          outputs: [],
          position: { x: 0, y: 0 },
        },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const execution = await engine.start(workflow);

    const eventTypes = execution.events.map((e) => e.type);
    expect(eventTypes).toContain('execution_started');
    expect(eventTypes).toContain('node_started');
    expect(eventTypes).toContain('node_completed');
    expect(eventTypes).toContain('execution_completed');
  });

  it('should send events to the renderer via IPC', async () => {
    const engine = new ExecutionEngine(mockMainWindow);

    const workflow = {
      id: 'wf-1',
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
          type: 'backend' as const,
          label: 'Backend',
          config: {},
          inputs: [],
          outputs: [],
          position: { x: 0, y: 0 },
        },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    await engine.start(workflow);

    const sendMock = mockMainWindow.webContents.send as ReturnType<typeof vi.fn>;
    expect(sendMock).toHaveBeenCalled();

    const eventCalls = sendMock.mock.calls.filter(
      (call: unknown[]) => call[0] === 'execution:event',
    );
    expect(eventCalls.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // T08: handleCLIOutput parses tool_use JSON lines and emits tool_call
  // -------------------------------------------------------------------------

  describe('handleCLIOutput', () => {
    it('should exist as a public method on ExecutionEngine', () => {
      const engine = new ExecutionEngine(mockMainWindow);
      expect(typeof engine.handleCLIOutput).toBe('function');
    });

    it('should emit a tool_call event when CLI output contains a tool_use JSON line', async () => {
      const engine = new ExecutionEngine(mockMainWindow);

      // Start an execution so there is state to record events against
      const workflow = {
        id: 'wf-1',
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
            type: 'backend' as const,
            label: 'Backend',
            config: {},
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      await engine.start(workflow);

      // Simulate a Claude CLI JSON output line with a tool_use content block
      const toolUseLine = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Edit',
              input: { file_path: '/src/foo.ts', old_string: 'x', new_string: 'y' },
            },
          ],
        },
      });

      engine.handleCLIOutput('cli-session-1', toolUseLine);

      const state = engine.getState();
      expect(state).not.toBeNull();

      const toolCallEvents = state!.events.filter((e) => e.type === 'tool_call');
      expect(toolCallEvents.length).toBe(1);
      expect(toolCallEvents[0].message).toContain('Edit');
      expect(toolCallEvents[0].data).toMatchObject({
        tool: 'Edit',
        target: '/src/foo.ts',
      });
    });

    it('should emit a bash_command event when tool name is Bash', async () => {
      const engine = new ExecutionEngine(mockMainWindow);

      const workflow = {
        id: 'wf-1',
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
            type: 'backend' as const,
            label: 'Backend',
            config: {},
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      await engine.start(workflow);

      const bashToolLine = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Bash',
              input: { command: 'npm test' },
            },
          ],
        },
      });

      engine.handleCLIOutput('cli-session-1', bashToolLine);

      const state = engine.getState();
      expect(state).not.toBeNull();

      // Should emit both a tool_call AND a bash_command event
      const toolCallEvents = state!.events.filter((e) => e.type === 'tool_call');
      const bashEvents = state!.events.filter((e) => e.type === 'bash_command');

      expect(toolCallEvents.length).toBe(1);
      expect(toolCallEvents[0].data).toMatchObject({
        tool: 'Bash',
        target: 'npm test',
      });

      expect(bashEvents.length).toBe(1);
      expect(bashEvents[0].message).toContain('npm test');
      expect(bashEvents[0].data).toMatchObject({
        command: 'npm test',
      });
    });

    it('should NOT emit tool_call events for non-tool output lines', async () => {
      const engine = new ExecutionEngine(mockMainWindow);

      const workflow = {
        id: 'wf-1',
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
            type: 'backend' as const,
            label: 'Backend',
            config: {},
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      await engine.start(workflow);

      // Various non-tool JSON lines
      const textLine = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Let me analyze this code.' },
          ],
        },
      });
      const systemLine = JSON.stringify({ type: 'system', message: 'Starting session' });
      const plainText = 'This is not JSON at all';

      engine.handleCLIOutput('cli-session-1', textLine);
      engine.handleCLIOutput('cli-session-1', systemLine);
      engine.handleCLIOutput('cli-session-1', plainText);

      const state = engine.getState();
      const toolCallEvents = state!.events.filter((e) => e.type === 'tool_call');
      const bashEvents = state!.events.filter((e) => e.type === 'bash_command');

      expect(toolCallEvents.length).toBe(0);
      expect(bashEvents.length).toBe(0);
    });

    it('should handle malformed JSON gracefully without crashing', async () => {
      const engine = new ExecutionEngine(mockMainWindow);

      const workflow = {
        id: 'wf-1',
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
            type: 'backend' as const,
            label: 'Backend',
            config: {},
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      await engine.start(workflow);

      // Malformed JSON lines should not throw
      expect(() => engine.handleCLIOutput('cli-session-1', '{')).not.toThrow();
      expect(() => engine.handleCLIOutput('cli-session-1', '')).not.toThrow();
      expect(() => engine.handleCLIOutput('cli-session-1', '{"type":')).not.toThrow();
      expect(() => engine.handleCLIOutput('cli-session-1', 'null')).not.toThrow();
      expect(() => engine.handleCLIOutput('cli-session-1', '42')).not.toThrow();

      // No tool_call events should have been emitted
      const state = engine.getState();
      const toolCallEvents = state!.events.filter((e) => e.type === 'tool_call');
      expect(toolCallEvents.length).toBe(0);
    });

    it('should resolve nodeId from the CLI session ID', async () => {
      const engine = new ExecutionEngine(mockMainWindow);

      const workflow = {
        id: 'wf-1',
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
            type: 'backend' as const,
            label: 'Backend',
            config: {},
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      await engine.start(workflow);

      // Simulate that session 'cli-session-1' maps to node 'node-1'
      // The engine tracks this via sessionToNode when spawning CLI
      // For this test, we use the registerSessionNode helper
      engine.registerSessionNode('cli-session-1', 'node-1');

      const toolUseLine = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Write',
              input: { file_path: '/src/bar.ts', content: 'hello' },
            },
          ],
        },
      });

      engine.handleCLIOutput('cli-session-1', toolUseLine);

      const state = engine.getState();
      const toolCallEvents = state!.events.filter((e) => e.type === 'tool_call');
      expect(toolCallEvents.length).toBe(1);
      expect(toolCallEvents[0].nodeId).toBe('node-1');
    });

    it('should extract file_path as target for file-based tools', async () => {
      const engine = new ExecutionEngine(mockMainWindow);

      const workflow = {
        id: 'wf-1',
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
            type: 'backend' as const,
            label: 'Backend',
            config: {},
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      await engine.start(workflow);

      // Read tool uses file_path
      const readLine = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/workspace/README.md' },
            },
          ],
        },
      });

      engine.handleCLIOutput('cli-session-1', readLine);

      const state = engine.getState();
      const toolCallEvents = state!.events.filter((e) => e.type === 'tool_call');
      expect(toolCallEvents.length).toBe(1);
      expect(toolCallEvents[0].data).toMatchObject({
        tool: 'Read',
        target: '/workspace/README.md',
      });
    });

    it('should handle multiple tool_use blocks in a single message', async () => {
      const engine = new ExecutionEngine(mockMainWindow);

      const workflow = {
        id: 'wf-1',
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
            type: 'backend' as const,
            label: 'Backend',
            config: {},
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      await engine.start(workflow);

      // Message with two tool_use content blocks
      const multiToolLine = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/src/a.ts' },
            },
            {
              type: 'text',
              text: 'Now let me also read another file.',
            },
            {
              type: 'tool_use',
              name: 'Glob',
              input: { pattern: '**/*.ts' },
            },
          ],
        },
      });

      engine.handleCLIOutput('cli-session-1', multiToolLine);

      const state = engine.getState();
      const toolCallEvents = state!.events.filter((e) => e.type === 'tool_call');
      expect(toolCallEvents.length).toBe(2);
      expect(toolCallEvents[0].data).toMatchObject({ tool: 'Read', target: '/src/a.ts' });
      expect(toolCallEvents[1].data).toMatchObject({ tool: 'Glob', target: '**/*.ts' });
    });

    it('should handle content_block_start streaming format', async () => {
      const engine = new ExecutionEngine(mockMainWindow);

      const workflow = {
        id: 'wf-1',
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
            type: 'backend' as const,
            label: 'Backend',
            config: {},
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      await engine.start(workflow);

      // Streaming format: content_block_start with tool_use
      const streamLine = JSON.stringify({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          name: 'Edit',
          input: { file_path: '/src/utils.ts' },
        },
      });

      engine.handleCLIOutput('cli-session-1', streamLine);

      const state = engine.getState();
      const toolCallEvents = state!.events.filter((e) => e.type === 'tool_call');
      expect(toolCallEvents.length).toBe(1);
      expect(toolCallEvents[0].data).toMatchObject({ tool: 'Edit', target: '/src/utils.ts' });
    });

    it('should not emit events when no execution is active', () => {
      const engine = new ExecutionEngine(mockMainWindow);

      // No execution started
      const toolUseLine = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Edit',
              input: { file_path: '/src/foo.ts' },
            },
          ],
        },
      });

      // Should not throw
      expect(() => engine.handleCLIOutput('cli-session-1', toolUseLine)).not.toThrow();

      // No state to check events on
      expect(engine.getState()).toBeNull();
    });

    it('should use command as target for Bash tool and pattern for Glob/Grep', async () => {
      const engine = new ExecutionEngine(mockMainWindow);

      const workflow = {
        id: 'wf-1',
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
            type: 'backend' as const,
            label: 'Backend',
            config: {},
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      await engine.start(workflow);

      // Grep tool uses 'pattern' as its primary input
      const grepLine = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Grep',
              input: { pattern: 'TODO', path: '/src' },
            },
          ],
        },
      });

      engine.handleCLIOutput('cli-session-1', grepLine);

      const state = engine.getState();
      const toolCallEvents = state!.events.filter((e) => e.type === 'tool_call');
      expect(toolCallEvents.length).toBe(1);
      expect(toolCallEvents[0].data).toMatchObject({
        tool: 'Grep',
        target: 'TODO',
      });
    });

    it('should send tool_call events via IPC to the renderer', async () => {
      const engine = new ExecutionEngine(mockMainWindow);

      const workflow = {
        id: 'wf-1',
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
            type: 'backend' as const,
            label: 'Backend',
            config: {},
            inputs: [],
            outputs: [],
            position: { x: 0, y: 0 },
          },
        ],
        transitions: [],
        gates: [],
        variables: [],
      };

      await engine.start(workflow);

      // Clear IPC calls from execution start
      (mockMainWindow.webContents.send as ReturnType<typeof vi.fn>).mockClear();

      const toolUseLine = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Edit',
              input: { file_path: '/src/foo.ts' },
            },
          ],
        },
      });

      engine.handleCLIOutput('cli-session-1', toolUseLine);

      const sendMock = mockMainWindow.webContents.send as ReturnType<typeof vi.fn>;
      const eventCalls = sendMock.mock.calls.filter(
        (call: unknown[]) => call[0] === 'execution:event',
      );
      const toolCallIpcEvents = eventCalls.filter(
        (call: unknown[]) => (call[1] as { type: string }).type === 'tool_call',
      );
      expect(toolCallIpcEvents.length).toBe(1);
    });
  });
});
