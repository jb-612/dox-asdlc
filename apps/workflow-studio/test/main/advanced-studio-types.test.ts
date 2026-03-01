// @vitest-environment node
// ---------------------------------------------------------------------------
// F15-T01: Control-flow type extensions for workflow.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

describe('F15-T01: Control-flow types', () => {
  it('BlockType includes condition, forEach, subWorkflow', async () => {
    const blockType1: import('../../src/shared/types/workflow').BlockType = 'condition';
    const blockType2: import('../../src/shared/types/workflow').BlockType = 'forEach';
    const blockType3: import('../../src/shared/types/workflow').BlockType = 'subWorkflow';
    expect(blockType1).toBe('condition');
    expect(blockType2).toBe('forEach');
    expect(blockType3).toBe('subWorkflow');
  });

  it('AgentNode accepts kind field with agent or control', async () => {
    const node: import('../../src/shared/types/workflow').AgentNode = {
      id: 'n1',
      type: 'backend',
      label: 'Test',
      kind: 'control',
      config: {},
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
    };
    expect(node.kind).toBe('control');

    const agentNode: import('../../src/shared/types/workflow').AgentNode = {
      id: 'n2',
      type: 'backend',
      label: 'Test2',
      kind: 'agent',
      config: {},
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
    };
    expect(agentNode.kind).toBe('agent');
  });

  it('AgentNode kind defaults to undefined (backward compat)', async () => {
    const node: import('../../src/shared/types/workflow').AgentNode = {
      id: 'n1',
      type: 'backend',
      label: 'Test',
      config: {},
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
    };
    expect(node.kind).toBeUndefined();
  });

  it('ConditionConfig interface exists with required fields', async () => {
    const config: import('../../src/shared/types/workflow').ConditionConfig = {
      expression: 'status == "success"',
      trueBranchNodeId: 'node-a',
      falseBranchNodeId: 'node-b',
    };
    expect(config.expression).toBe('status == "success"');
    expect(config.trueBranchNodeId).toBe('node-a');
    expect(config.falseBranchNodeId).toBe('node-b');
  });

  it('ForEachConfig interface exists with required and optional fields', async () => {
    const config: import('../../src/shared/types/workflow').ForEachConfig = {
      collectionVariable: 'repos',
      itemVariable: 'repo',
      bodyNodeIds: ['node-a', 'node-b'],
    };
    expect(config.collectionVariable).toBe('repos');
    expect(config.bodyNodeIds).toHaveLength(2);
    expect(config.maxIterations).toBeUndefined();

    const configWithMax: import('../../src/shared/types/workflow').ForEachConfig = {
      collectionVariable: 'items',
      itemVariable: 'item',
      bodyNodeIds: ['n1'],
      maxIterations: 50,
    };
    expect(configWithMax.maxIterations).toBe(50);
  });

  it('SubWorkflowConfig interface exists with required and optional fields', async () => {
    const config: import('../../src/shared/types/workflow').SubWorkflowConfig = {
      workflowId: 'wf-child',
    };
    expect(config.workflowId).toBe('wf-child');
    expect(config.inputMappings).toBeUndefined();

    const configWithMappings: import('../../src/shared/types/workflow').SubWorkflowConfig = {
      workflowId: 'wf-child',
      inputMappings: { parentVar: 'childVar' },
      outputMappings: { childResult: 'parentResult' },
    };
    expect(configWithMappings.inputMappings).toEqual({ parentVar: 'childVar' });
    expect(configWithMappings.outputMappings).toEqual({ childResult: 'parentResult' });
  });

  it('AgentNodeConfig accepts optional control-flow configs', async () => {
    const config: import('../../src/shared/types/workflow').AgentNodeConfig = {
      conditionConfig: {
        expression: 'x > 0',
        trueBranchNodeId: 'a',
        falseBranchNodeId: 'b',
      },
    };
    expect(config.conditionConfig!.expression).toBe('x > 0');

    const config2: import('../../src/shared/types/workflow').AgentNodeConfig = {
      forEachConfig: {
        collectionVariable: 'items',
        itemVariable: 'item',
        bodyNodeIds: ['n1'],
      },
    };
    expect(config2.forEachConfig!.collectionVariable).toBe('items');

    const config3: import('../../src/shared/types/workflow').AgentNodeConfig = {
      subWorkflowConfig: {
        workflowId: 'wf-child',
      },
    };
    expect(config3.subWorkflowConfig!.workflowId).toBe('wf-child');
  });

  it('WorkflowVariable.type includes array', async () => {
    const variable: import('../../src/shared/types/workflow').WorkflowVariable = {
      name: 'items',
      type: 'array',
      required: true,
    };
    expect(variable.type).toBe('array');
  });
});
