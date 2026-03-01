import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock reactflow
vi.mock('reactflow', () => ({
  Handle: ({ type, id }: { type: string; position: string; id?: string }) => (
    <div data-testid={`handle-${type}${id ? `-${id}` : ''}`} />
  ),
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

import ConditionNodeComponent from '../../../../src/renderer/components/designer/ConditionNodeComponent';
import type { ConditionNodeData } from '../../../../src/renderer/components/designer/ConditionNodeComponent';

function renderNode(data: Partial<ConditionNodeData> = {}, selected = false) {
  const props = {
    id: 'cond-1',
    data: {
      expression: 'status == "success"',
      trueBranchLabel: 'True',
      falseBranchLabel: 'False',
      ...data,
    } as ConditionNodeData,
    selected,
    type: 'condition',
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
  };
  return render(<ConditionNodeComponent {...props} />);
}

describe('ConditionNodeComponent', () => {
  it('renders expression text', () => {
    renderNode({ expression: 'count > 5' });
    expect(screen.getByText('count > 5')).toBeInTheDocument();
  });

  it('renders diamond shape container', () => {
    const { container } = renderNode();
    // Diamond shape uses a rotated element or SVG
    const diamond = container.querySelector('[data-testid="condition-diamond"]');
    expect(diamond).toBeInTheDocument();
  });

  it('renders true and false output handles', () => {
    renderNode();
    expect(screen.getByTestId('handle-source-true')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-false')).toBeInTheDocument();
  });

  it('truncates long expressions', () => {
    const longExpr = 'a'.repeat(60);
    renderNode({ expression: longExpr });
    // Should not show the full 60-char string
    const displayed = screen.getByTestId('condition-expression').textContent ?? '';
    expect(displayed.length).toBeLessThan(60);
  });
});
