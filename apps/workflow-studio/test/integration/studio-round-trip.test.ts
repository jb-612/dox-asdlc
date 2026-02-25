import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type {
  WorkflowDefinition,
  AgentNode,
  ParallelGroup,
} from '../../src/shared/types/workflow';
import { WorkflowDefinitionSchema } from '../../src/main/schemas/workflow-schema';
import { BLOCK_TYPE_METADATA } from '../../src/shared/constants';
import { ExecutionEngine } from '../../src/main/services/execution-engine';
import { BrowserWindow } from 'electron';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlanNode(overrides?: Partial<AgentNode>): AgentNode {
  const meta = BLOCK_TYPE_METADATA.plan;
  return {
    id: uuidv4(),
    type: meta.agentNodeType,
    label: 'Plan Phase',
    config: {
      systemPromptPrefix: meta.defaultSystemPromptPrefix,
      outputChecklist: [...meta.defaultOutputChecklist],
      backend: 'claude',
    },
    inputs: [],
    outputs: [],
    position: { x: 100, y: 100 },
    description: 'Gather requirements and create a task plan',
    ...overrides,
  };
}

function makeWorkflow(
  nodes: AgentNode[],
  opts?: {
    rules?: string[];
    parallelGroups?: ParallelGroup[];
  },
): WorkflowDefinition {
  return {
    id: uuidv4(),
    metadata: {
      name: 'Studio Round-Trip Test',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['studio-block-composer'],
    },
    nodes,
    transitions: [],
    gates: [],
    variables: [],
    rules: opts?.rules,
    parallelGroups: opts?.parallelGroups,
  };
}

// ---------------------------------------------------------------------------
// Mock BrowserWindow to avoid Electron dependency in test
// ---------------------------------------------------------------------------
vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation(() => ({
    webContents: { send: vi.fn() },
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Studio workflow round-trip', () => {
  describe('T12-1: Serialization — WorkflowDefinition with harness fields', () => {
    it('should create a valid workflow with systemPromptPrefix, outputChecklist, rules, and parallelGroup', () => {
      const planNode = makePlanNode();
      const devNode: AgentNode = {
        id: uuidv4(),
        type: 'coding',
        label: 'Dev Phase',
        config: {
          systemPromptPrefix: 'You are a senior developer.',
          outputChecklist: ['Implementation code', 'Unit tests'],
          backend: 'claude',
        },
        inputs: [],
        outputs: [],
        position: { x: 300, y: 100 },
        description: 'Implement the feature',
      };

      const group: ParallelGroup = {
        id: uuidv4(),
        label: 'Parallel Dev',
        laneNodeIds: [devNode.id],
      };

      const workflow = makeWorkflow([planNode, devNode], {
        rules: ['Follow TDD protocol', 'Commit to feature branch only'],
        parallelGroups: [group],
      });

      // Verify structure
      expect(workflow.rules).toHaveLength(2);
      expect(workflow.parallelGroups).toHaveLength(1);
      expect(workflow.parallelGroups![0].laneNodeIds).toContain(devNode.id);
      expect(planNode.config.systemPromptPrefix).toBeTruthy();
      expect(planNode.config.outputChecklist).toHaveLength(4);
    });
  });

  describe('T12-2: Zod schema validation', () => {
    it('should accept a workflow with all new optional fields', () => {
      const planNode = makePlanNode();
      const workflow = makeWorkflow([planNode], {
        rules: ['Always write tests first'],
        parallelGroups: [
          { id: uuidv4(), label: 'Group A', laneNodeIds: [planNode.id] },
        ],
      });

      const result = WorkflowDefinitionSchema.safeParse(workflow);
      expect(result.success).toBe(true);
    });

    it('should accept a workflow without new fields (backward compat)', () => {
      const node: AgentNode = {
        id: uuidv4(),
        type: 'planner',
        label: 'Legacy Plan',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 0, y: 0 },
      };

      const workflow: WorkflowDefinition = {
        id: uuidv4(),
        metadata: {
          name: 'Legacy Workflow',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
        nodes: [node],
        transitions: [],
        gates: [],
        variables: [],
        // No rules, no parallelGroups — backward compatible
      };

      const result = WorkflowDefinitionSchema.safeParse(workflow);
      expect(result.success).toBe(true);
    });
  });

  describe('T12-3: Execution engine buildSystemPrompt', () => {
    let engine: ExecutionEngine;

    beforeEach(() => {
      const mockWindow = new BrowserWindow() as unknown as BrowserWindow;
      engine = new ExecutionEngine(mockWindow, { mockMode: true });
    });

    it('should compose prompt with prefix only', () => {
      const node = makePlanNode({
        config: {
          systemPromptPrefix: 'You are an expert planner.',
          outputChecklist: [],
        },
        description: 'Create a feature plan',
      });

      const prompt = engine.buildSystemPrompt(node, []);
      expect(prompt).toContain('You are an expert planner.');
      expect(prompt).toContain('Create a feature plan');
      expect(prompt).not.toContain('You must produce:');
    });

    it('should compose prompt with checklist only', () => {
      const node = makePlanNode({
        config: {
          outputChecklist: ['Design doc', 'Task breakdown'],
        },
        description: 'Plan the feature',
      });

      const prompt = engine.buildSystemPrompt(node, []);
      expect(prompt).toContain('Plan the feature');
      expect(prompt).toContain('You must produce:');
      expect(prompt).toContain('1. Design doc');
      expect(prompt).toContain('2. Task breakdown');
    });

    it('should compose prompt with both prefix and checklist', () => {
      const node = makePlanNode({
        config: {
          systemPromptPrefix: 'Focus on API design.',
          outputChecklist: ['API spec', 'Schema definitions'],
        },
        description: 'Design the API',
      });

      const prompt = engine.buildSystemPrompt(node, []);
      expect(prompt).toContain('Focus on API design.');
      expect(prompt).toContain('Design the API');
      expect(prompt).toContain('1. API spec');
      expect(prompt).toContain('2. Schema definitions');

      // Verify order: prefix before task instruction before checklist
      const prefixIdx = prompt.indexOf('Focus on API design.');
      const taskIdx = prompt.indexOf('Design the API');
      const checklistIdx = prompt.indexOf('You must produce:');
      expect(prefixIdx).toBeLessThan(taskIdx);
      expect(taskIdx).toBeLessThan(checklistIdx);
    });

    it('should compose prompt with neither prefix nor checklist (backward compat)', () => {
      const node = makePlanNode({
        config: {},
        description: 'Just run the planner',
      });

      const prompt = engine.buildSystemPrompt(node, []);
      expect(prompt).toContain('Just run the planner');
      // Agent contract always appends output deliverables instruction
      expect(prompt).toContain('.output/block-');
    });

    it('should prepend workflow rules before everything else', () => {
      const node = makePlanNode({
        config: {
          systemPromptPrefix: 'Be thorough.',
          outputChecklist: ['Deliverable A'],
        },
        description: 'Execute task',
      });

      const rules = ['Always follow TDD', 'No force pushes'];
      const prompt = engine.buildSystemPrompt(node, rules);

      expect(prompt).toContain('Rules:');
      expect(prompt).toContain('- Always follow TDD');
      expect(prompt).toContain('- No force pushes');

      // Rules should come first
      const rulesIdx = prompt.indexOf('Rules:');
      const prefixIdx = prompt.indexOf('Be thorough.');
      expect(rulesIdx).toBeLessThan(prefixIdx);
    });
  });

  describe('T12-4: BLOCK_TYPE_METADATA defaults', () => {
    it('should have Plan block with full defaults', () => {
      const plan = BLOCK_TYPE_METADATA.plan;
      expect(plan.agentNodeType).toBe('planner');
      expect(plan.label).toBe('Plan');
      expect(plan.defaultSystemPromptPrefix).toBeTruthy();
      expect(plan.defaultOutputChecklist.length).toBeGreaterThan(0);
      expect(plan.phase).toBe(1);
    });

    it('should have stub entries for future blocks', () => {
      for (const blockType of ['dev', 'test', 'review', 'devops'] as const) {
        const meta = BLOCK_TYPE_METADATA[blockType];
        expect(meta.agentNodeType).toBeTruthy();
        expect(meta.label).toBeTruthy();
        expect(meta.phase).toBe(2);
      }
    });
  });
});
