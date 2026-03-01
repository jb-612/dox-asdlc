// @vitest-environment node
// ---------------------------------------------------------------------------
// F15-T13: Control-flow validation
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { validateWorkflow, type ValidationResult } from '../../src/main/services/workflow-validator';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

function baseWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: 'wf-test',
    metadata: { name: 'Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
    nodes: [],
    transitions: [],
    gates: [],
    variables: [],
    ...overrides,
  };
}

describe('F15-T13: validateWorkflow', () => {
  it('condition node with < 2 outgoing edges warns', () => {
    const wf = baseWorkflow({
      nodes: [
        { id: 'cond-1', type: 'backend', kind: 'control', label: 'Cond', config: {
          blockType: 'condition',
          conditionConfig: { expression: 'x > 0', trueBranchNodeId: 'a', falseBranchNodeId: 'b' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'a', type: 'backend', label: 'A', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'cond-1', targetNodeId: 'a', condition: { type: 'always' } },
      ],
    });

    const result = validateWorkflow(wf);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => w.includes('cond-1'))).toBe(true);
  });

  it('forEach with empty bodyNodeIds warns', () => {
    const wf = baseWorkflow({
      nodes: [
        { id: 'fe-1', type: 'backend', kind: 'control', label: 'FE', config: {
          blockType: 'forEach',
          forEachConfig: { collectionVariable: 'items', itemVariable: 'item', bodyNodeIds: [] },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
    });

    const result = validateWorkflow(wf);
    expect(result.warnings.some((w) => w.includes('fe-1'))).toBe(true);
  });

  it('subWorkflow with non-existent workflowId errors', () => {
    const wf = baseWorkflow({
      nodes: [
        { id: 'sw-1', type: 'backend', kind: 'control', label: 'SW', config: {
          blockType: 'subWorkflow',
          subWorkflowConfig: { workflowId: '' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
    });

    const result = validateWorkflow(wf);
    expect(result.errors.some((e) => e.includes('sw-1'))).toBe(true);
  });

  it('valid workflow has no errors', () => {
    const wf = baseWorkflow({
      nodes: [
        { id: 'n1', type: 'backend', label: 'Step 1', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
    });

    const result = validateWorkflow(wf);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });
});
