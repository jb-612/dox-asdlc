import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock reactflow
vi.mock('reactflow', () => ({
  Handle: ({ type }: { type: string; position: string }) => (
    <div data-testid={`handle-${type}`} />
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
}));

import SubWorkflowNodeComponent from '../../../../src/renderer/components/designer/SubWorkflowNodeComponent';
import type { SubWorkflowNodeData } from '../../../../src/renderer/components/designer/SubWorkflowNodeComponent';

function renderNode(data: Partial<SubWorkflowNodeData> = {}) {
  const props = {
    id: 'sw-1',
    data: {
      workflowName: 'Child Workflow',
      mappingCount: 2,
      ...data,
    } as SubWorkflowNodeData,
    selected: false,
    type: 'subWorkflow',
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
  };
  return render(<SubWorkflowNodeComponent {...props} />);
}

describe('SubWorkflowNodeComponent', () => {
  it('renders workflow name', () => {
    renderNode({ workflowName: 'Deploy Pipeline' });
    expect(screen.getByText('Deploy Pipeline')).toBeInTheDocument();
  });

  it('renders nested-workflow icon', () => {
    renderNode();
    expect(screen.getByTestId('subworkflow-icon')).toBeInTheDocument();
  });

  it('shows mapping count badge', () => {
    renderNode({ mappingCount: 5 });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders input and output handles', () => {
    renderNode();
    expect(screen.getByTestId('handle-target')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source')).toBeInTheDocument();
  });
});
