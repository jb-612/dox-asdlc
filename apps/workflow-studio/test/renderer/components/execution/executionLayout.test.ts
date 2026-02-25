import { describe, it, expect } from 'vitest';
import { computeDagreLayout } from '../../../../src/renderer/components/execution/executionLayout';
import type { AgentNode, Transition, HITLGateDefinition } from '../../../../src/shared/types/workflow';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, type: string = 'backend'): AgentNode {
  return {
    id,
    type: type as AgentNode['type'],
    label: id,
    config: {},
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
  };
}

function makeTransition(id: string, source: string, target: string): Transition {
  return {
    id,
    sourceNodeId: source,
    targetNodeId: target,
    condition: { type: 'always' },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeDagreLayout', () => {
  it('returns a position for every node', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const transitions = [makeTransition('t1', 'a', 'b')];

    const positions = computeDagreLayout(nodes, transitions, []);

    expect(positions.size).toBe(2);
    expect(positions.has('a')).toBe(true);
    expect(positions.has('b')).toBe(true);
  });

  it('places sequential nodes in top-to-bottom order (a above b)', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const transitions = [makeTransition('t1', 'a', 'b')];

    const positions = computeDagreLayout(nodes, transitions, []);

    const posA = positions.get('a')!;
    const posB = positions.get('b')!;

    // In TB layout, source has smaller y than target
    expect(posA.y).toBeLessThan(posB.y);
  });

  it('places parallel siblings at the same rank (same y, different x)', () => {
    // fork: a -> b, a -> c
    // join: b -> d, c -> d
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const transitions = [
      makeTransition('t1', 'a', 'b'),
      makeTransition('t2', 'a', 'c'),
      makeTransition('t3', 'b', 'd'),
      makeTransition('t4', 'c', 'd'),
    ];

    const positions = computeDagreLayout(nodes, transitions, []);

    const posB = positions.get('b')!;
    const posC = positions.get('c')!;

    // Same rank: y values should be very close (within rounding tolerance)
    expect(Math.abs(posB.y - posC.y)).toBeLessThan(1);
    // Different columns: x values should differ
    expect(Math.abs(posB.x - posC.x)).toBeGreaterThan(20);
  });

  it('places fork above and join below parallel siblings', () => {
    const nodes = [makeNode('fork'), makeNode('left'), makeNode('right'), makeNode('join')];
    const transitions = [
      makeTransition('t1', 'fork', 'left'),
      makeTransition('t2', 'fork', 'right'),
      makeTransition('t3', 'left', 'join'),
      makeTransition('t4', 'right', 'join'),
    ];

    const positions = computeDagreLayout(nodes, transitions, []);

    const yFork = positions.get('fork')!.y;
    const yLeft = positions.get('left')!.y;
    const yRight = positions.get('right')!.y;
    const yJoin = positions.get('join')!.y;

    expect(yFork).toBeLessThan(yLeft);
    expect(yFork).toBeLessThan(yRight);
    expect(yJoin).toBeGreaterThan(yLeft);
    expect(yJoin).toBeGreaterThan(yRight);
  });

  it('handles a single node with no transitions', () => {
    const nodes = [makeNode('solo')];
    const positions = computeDagreLayout(nodes, [], []);

    expect(positions.size).toBe(1);
    const pos = positions.get('solo')!;
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  it('includes gate nodes in the layout', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const transitions = [makeTransition('t1', 'a', 'b')];
    const gates: HITLGateDefinition[] = [
      {
        id: 'gate-1',
        nodeId: 'a',
        gateType: 'approval',
        prompt: 'Approve?',
        options: [],
        required: true,
      },
    ];

    const positions = computeDagreLayout(nodes, transitions, gates);

    expect(positions.size).toBe(3);
    expect(positions.has('gate-1')).toBe(true);
  });
});
