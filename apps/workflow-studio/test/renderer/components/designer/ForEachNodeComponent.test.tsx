import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock reactflow
vi.mock('reactflow', () => ({
  Handle: ({ type, id }: { type: string; position: string; id?: string }) => (
    <div data-testid={`handle-${type}${id ? `-${id}` : ''}`} />
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
}));

import ForEachNodeComponent from '../../../../src/renderer/components/designer/ForEachNodeComponent';
import type { ForEachNodeData } from '../../../../src/renderer/components/designer/ForEachNodeComponent';

function renderNode(data: Partial<ForEachNodeData> = {}) {
  const props = {
    id: 'fe-1',
    data: {
      collectionVariable: 'items',
      itemVariable: 'item',
      iterationCount: undefined,
      ...data,
    } as ForEachNodeData,
    selected: false,
    type: 'forEach',
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
  };
  return render(<ForEachNodeComponent {...props} />);
}

describe('ForEachNodeComponent', () => {
  it('renders loop icon and collection variable name', () => {
    renderNode({ collectionVariable: 'users' });
    expect(screen.getByText(/users/)).toBeInTheDocument();
    expect(screen.getByTestId('foreach-loop-icon')).toBeInTheDocument();
  });

  it('renders iteration badge during execution', () => {
    renderNode({ iterationCount: 3 });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders dashed body border', () => {
    const { container } = renderNode();
    const body = container.querySelector('[data-testid="foreach-body"]');
    expect(body).toBeInTheDocument();
  });

  it('renders input and output handles', () => {
    renderNode();
    expect(screen.getByTestId('handle-target')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source')).toBeInTheDocument();
  });
});
