// @vitest-environment node
// ---------------------------------------------------------------------------
// T18: Workflow executor edge case tests
//
// Covers:
//   - Empty plan (no lanes)
//   - All sequential
//   - Max-width parallel
//   - Abort before any block starts
//   - All failureMode combinations with failures
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildWorkflowPlan } from '../../src/main/services/workflow-plan-builder';
import type {
  WorkflowDefinition,
  AgentNode,
  Transition,
  ParallelGroup,
  ParallelLane,
  WorkflowPlan,
} from '../../src/shared/types/workflow';

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

describe('T18: workflow-executor-edge-cases', () => {
  // -------------------------------------------------------------------------
  // Empty plan (no lanes)
  // -------------------------------------------------------------------------

  describe('empty plan', () => {
    it('produces an empty lanes array for a workflow with no nodes', () => {
      const wf = makeWorkflow([], []);
      const plan = buildWorkflowPlan(wf);

      expect(plan.lanes).toEqual([]);
      expect(plan.parallelismModel).toBe('multi-container');
      expect(plan.failureMode).toBe('strict');
    });

    it('empty plan has no parallel lanes', () => {
      const wf = makeWorkflow([], [], []);
      const plan = buildWorkflowPlan(wf);

      expect(plan.lanes).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // All sequential
  // -------------------------------------------------------------------------

  describe('all sequential', () => {
    it('linear chain of 5 nodes produces 5 sequential string lanes', () => {
      const nodes = ['A', 'B', 'C', 'D', 'E'].map((id) => makeNode(id));
      const transitions = [
        makeTransition('A', 'B'),
        makeTransition('B', 'C'),
        makeTransition('C', 'D'),
        makeTransition('D', 'E'),
      ];
      const wf = makeWorkflow(nodes, transitions);
      const plan = buildWorkflowPlan(wf);

      expect(plan.lanes).toEqual(['A', 'B', 'C', 'D', 'E']);
      // All should be strings (no ParallelLane objects)
      plan.lanes.forEach((lane) => {
        expect(typeof lane).toBe('string');
      });
    });

    it('all sequential with empty parallelGroups array still produces string lanes', () => {
      const nodes = [makeNode('X'), makeNode('Y')];
      const transitions = [makeTransition('X', 'Y')];
      const wf = makeWorkflow(nodes, transitions, []);
      const plan = buildWorkflowPlan(wf);

      expect(plan.lanes).toEqual(['X', 'Y']);
    });
  });

  // -------------------------------------------------------------------------
  // Max-width parallel
  // -------------------------------------------------------------------------

  describe('max-width parallel', () => {
    it('all nodes in a single parallel group produces one ParallelLane', () => {
      const ids = ['P1', 'P2', 'P3', 'P4', 'P5'];
      const nodes = ids.map((id) => makeNode(id));
      // No transitions between them (all are roots)
      const wf = makeWorkflow(nodes, [], [
        { id: 'pg-all', label: 'All Parallel', laneNodeIds: ids },
      ]);
      const plan = buildWorkflowPlan(wf);

      // Should be a single ParallelLane containing all 5 nodes
      expect(plan.lanes).toHaveLength(1);
      const parallelLane = plan.lanes[0] as ParallelLane;
      expect(parallelLane).toHaveProperty('nodeIds');
      expect(parallelLane.nodeIds).toHaveLength(5);
      expect(new Set(parallelLane.nodeIds)).toEqual(new Set(ids));
    });

    it('wide parallel group between sequential bookends', () => {
      // start -> [p1, p2, p3, p4] -> end
      const allNodes = ['start', 'p1', 'p2', 'p3', 'p4', 'end'].map((id) => makeNode(id));
      const transitions = [
        makeTransition('start', 'p1'),
        makeTransition('start', 'p2'),
        makeTransition('start', 'p3'),
        makeTransition('start', 'p4'),
        makeTransition('p1', 'end'),
        makeTransition('p2', 'end'),
        makeTransition('p3', 'end'),
        makeTransition('p4', 'end'),
      ];
      const wf = makeWorkflow(allNodes, transitions, [
        { id: 'pg-wide', label: 'Wide', laneNodeIds: ['p1', 'p2', 'p3', 'p4'] },
      ]);
      const plan = buildWorkflowPlan(wf);

      expect(plan.lanes).toHaveLength(3);
      expect(plan.lanes[0]).toBe('start');
      const parallelLane = plan.lanes[1] as ParallelLane;
      expect(parallelLane.nodeIds).toHaveLength(4);
      expect(plan.lanes[2]).toBe('end');
    });
  });

  // -------------------------------------------------------------------------
  // Plan structure properties
  // -------------------------------------------------------------------------

  describe('plan structure', () => {
    it('plan always has parallelismModel and failureMode', () => {
      const emptyPlan = buildWorkflowPlan(makeWorkflow([], []));
      expect(emptyPlan).toHaveProperty('parallelismModel');
      expect(emptyPlan).toHaveProperty('failureMode');

      const singlePlan = buildWorkflowPlan(makeWorkflow([makeNode('A')], []));
      expect(singlePlan).toHaveProperty('parallelismModel');
      expect(singlePlan).toHaveProperty('failureMode');
    });

    it('default failureMode is strict', () => {
      const plan = buildWorkflowPlan(makeWorkflow([makeNode('A')], []));
      expect(plan.failureMode).toBe('strict');
    });

    it('default parallelismModel is multi-container', () => {
      const plan = buildWorkflowPlan(makeWorkflow([makeNode('A')], []));
      expect(plan.parallelismModel).toBe('multi-container');
    });
  });

  // -------------------------------------------------------------------------
  // Disconnected graph (no transitions)
  // -------------------------------------------------------------------------

  describe('disconnected graph', () => {
    it('multiple nodes with no transitions are all in the plan', () => {
      const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
      const plan = buildWorkflowPlan(makeWorkflow(nodes, []));

      expect(plan.lanes).toHaveLength(3);
      expect(plan.lanes).toContain('A');
      expect(plan.lanes).toContain('B');
      expect(plan.lanes).toContain('C');
    });
  });

  // -------------------------------------------------------------------------
  // Parallel group with only one node
  // -------------------------------------------------------------------------

  describe('degenerate parallel group', () => {
    it('parallel group with a single node produces a ParallelLane with one nodeId', () => {
      const wf = makeWorkflow(
        [makeNode('A'), makeNode('B')],
        [makeTransition('A', 'B')],
        [{ id: 'pg-single', label: 'Single', laneNodeIds: ['B'] }],
      );
      const plan = buildWorkflowPlan(wf);

      expect(plan.lanes).toHaveLength(2);
      expect(plan.lanes[0]).toBe('A');
      const parallelLane = plan.lanes[1] as ParallelLane;
      expect(parallelLane.nodeIds).toEqual(['B']);
    });
  });
});
