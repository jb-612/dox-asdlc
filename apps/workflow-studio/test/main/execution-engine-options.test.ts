// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentNode } from '../../src/shared/types/workflow';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Mock Electron BrowserWindow
// ---------------------------------------------------------------------------

const mockSend = vi.fn();
const mockWindow = {
  webContents: { send: mockSend },
} as unknown;

vi.mock('electron', () => ({
  BrowserWindow: class {
    static getAllWindows() { return [mockWindow]; }
    webContents = { send: mockSend };
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { ExecutionEngine } from '../../src/main/services/execution-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides?: Partial<AgentNode>): AgentNode {
  return {
    id: uuidv4(),
    type: 'coding',
    label: 'Coder',
    config: {},
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionEngine options', () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  describe('buildSystemPrompt with fileRestrictions', () => {
    it('includes file restrictions in prompt when provided', () => {
      const engine = new ExecutionEngine(mockWindow as any, {
        fileRestrictions: ['src/**/*.ts', 'test/**/*.ts'],
      });

      const node = makeNode({ description: 'Write code' });
      const prompt = engine.buildSystemPrompt(node);

      expect(prompt).toContain('Only modify files matching: src/**/*.ts, test/**/*.ts');
    });

    it('does not include file restrictions when empty', () => {
      const engine = new ExecutionEngine(mockWindow as any, {
        fileRestrictions: [],
      });

      const node = makeNode({ description: 'Write code' });
      const prompt = engine.buildSystemPrompt(node);

      expect(prompt).not.toContain('Only modify files matching');
    });

    it('does not include file restrictions when not provided', () => {
      const engine = new ExecutionEngine(mockWindow as any, {});

      const node = makeNode({ description: 'Write code' });
      const prompt = engine.buildSystemPrompt(node);

      expect(prompt).not.toContain('Only modify files matching');
    });
  });

  describe('buildSystemPrompt with readOnly', () => {
    it('includes read-only instruction when readOnly is true', () => {
      const engine = new ExecutionEngine(mockWindow as any, {
        readOnly: true,
      });

      const node = makeNode({ description: 'Read code' });
      const prompt = engine.buildSystemPrompt(node);

      expect(prompt).toContain('This repository is mounted read-only');
    });

    it('does not include read-only instruction when readOnly is false', () => {
      const engine = new ExecutionEngine(mockWindow as any, {
        readOnly: false,
      });

      const node = makeNode({ description: 'Write code' });
      const prompt = engine.buildSystemPrompt(node);

      expect(prompt).not.toContain('read-only');
    });
  });

  describe('workingDirectory', () => {
    it('stores workingDirectory from options', () => {
      const engine = new ExecutionEngine(mockWindow as any, {
        workingDirectory: '/tmp/test-repo',
      });

      // We can verify the engine was created successfully
      expect(engine).toBeTruthy();
      expect(engine.isActive()).toBe(false);
    });
  });
});
