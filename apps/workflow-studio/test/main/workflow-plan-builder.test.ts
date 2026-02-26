// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildWorkflowPlan } from '../../src/main/services/workflow-plan-builder';
import type { WorkflowDefinition, AgentNode, Transition, ParallelGroup, ParallelLane } from '../../src/shared/types/workflow';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, label?: string): AgentNode {
  return {
    id,
    type: 'backend',
    label: label ?? id,
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

function makeWorkflow(
  nodes: AgentNode[],
  transitions: Transition[],
  parallelGroups?: ParallelGroup[],
): WorkflowDefinition {
  return {
    id: 'test-workflow',
    metadata: {
      name: 'Test',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes,
    transitions,
    gates: [],
    variables: [],
    parallelGroups,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildWorkflowPlan', () => {
  // -----------------------------------------------------------------------
  // All-sequential workflows (no parallel groups)
  // -----------------------------------------------------------------------

  describe('sequential workflows', () => {
    it('produces a plan with all string lanes for a linear chain', () => {
      //  A -> B -> C
      const workflow = makeWorkflow(
        [makeNode('A'), makeNode('B'), makeNode('C')],
        [makeTransition('A', 'B'), makeTransition('B', 'C')],
      );

      const plan = buildWorkflowPlan(workflow);

      expect(plan.lanes).toEqual(['A', 'B', 'C']);
      expect(plan.parallelismModel).toBe('multi-container');
      expect(plan.failureMode).toBe('strict');
    });

    it('handles a single-node workflow', () => {
      const workflow = makeWorkflow([makeNode('only')], []);

      const plan = buildWorkflowPlan(workflow);

      expect(plan.lanes).toEqual(['only']);
    });

    it('handles an empty workflow (no nodes)', () => {
      const workflow = makeWorkflow([], []);

      const plan = buildWorkflowPlan(workflow);

      expect(plan.lanes).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Workflows with parallel groups
  // -----------------------------------------------------------------------

  describe('parallel group workflows', () => {
    it('converts parallel groups into ParallelLane objects', () => {
      // A -> [B, C] -> D
      const workflow = makeWorkflow(
        [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')],
        [
          makeTransition('A', 'B'),
          makeTransition('A', 'C'),
          makeTransition('B', 'D'),
          makeTransition('C', 'D'),
        ],
        [{ id: 'pg1', label: 'Parallel 1', laneNodeIds: ['B', 'C'] }],
      );

      const plan = buildWorkflowPlan(workflow);

      // Should be: sequential A, parallel {B,C}, sequential D
      expect(plan.lanes.length).toBe(3);
      expect(plan.lanes[0]).toBe('A');

      const parallelLane = plan.lanes[1] as ParallelLane;
      expect(parallelLane).toHaveProperty('nodeIds');
      expect(parallelLane.nodeIds).toContain('B');
      expect(parallelLane.nodeIds).toContain('C');

      expect(plan.lanes[2]).toBe('D');
    });

    it('handles multiple parallel groups in sequence', () => {
      // A -> [B1, B2] -> C -> [D1, D2] -> E
      const workflow = makeWorkflow(
        [
          makeNode('A'),
          makeNode('B1'), makeNode('B2'),
          makeNode('C'),
          makeNode('D1'), makeNode('D2'),
          makeNode('E'),
        ],
        [
          makeTransition('A', 'B1'),
          makeTransition('A', 'B2'),
          makeTransition('B1', 'C'),
          makeTransition('B2', 'C'),
          makeTransition('C', 'D1'),
          makeTransition('C', 'D2'),
          makeTransition('D1', 'E'),
          makeTransition('D2', 'E'),
        ],
        [
          { id: 'pg1', label: 'Group 1', laneNodeIds: ['B1', 'B2'] },
          { id: 'pg2', label: 'Group 2', laneNodeIds: ['D1', 'D2'] },
        ],
      );

      const plan = buildWorkflowPlan(workflow);

      // A, {B1,B2}, C, {D1,D2}, E
      expect(plan.lanes.length).toBe(5);
      expect(plan.lanes[0]).toBe('A');
      expect((plan.lanes[1] as ParallelLane).nodeIds).toEqual(
        expect.arrayContaining(['B1', 'B2']),
      );
      expect(plan.lanes[2]).toBe('C');
      expect((plan.lanes[3] as ParallelLane).nodeIds).toEqual(
        expect.arrayContaining(['D1', 'D2']),
      );
      expect(plan.lanes[4]).toBe('E');
    });
  });

  // -----------------------------------------------------------------------
  // Defaults
  // -----------------------------------------------------------------------

  describe('defaults', () => {
    it('defaults parallelismModel to multi-container', () => {
      const workflow = makeWorkflow([makeNode('A')], []);
      const plan = buildWorkflowPlan(workflow);
      expect(plan.parallelismModel).toBe('multi-container');
    });

    it('defaults failureMode to strict', () => {
      const workflow = makeWorkflow([makeNode('A')], []);
      const plan = buildWorkflowPlan(workflow);
      expect(plan.failureMode).toBe('strict');
    });
  });

  // -----------------------------------------------------------------------
  // Topological ordering
  // -----------------------------------------------------------------------

  describe('topological ordering', () => {
    it('respects transition order for a diamond shape', () => {
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D
      const workflow = makeWorkflow(
        [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')],
        [
          makeTransition('A', 'B'),
          makeTransition('A', 'C'),
          makeTransition('B', 'D'),
          makeTransition('C', 'D'),
        ],
      );

      const plan = buildWorkflowPlan(workflow);

      // Without parallel groups, A should come first, D last, B and C in middle
      const aIdx = plan.lanes.indexOf('A');
      const dIdx = plan.lanes.indexOf('D');
      expect(aIdx).toBe(0);
      expect(dIdx).toBe(plan.lanes.length - 1);
    });
  });
});
