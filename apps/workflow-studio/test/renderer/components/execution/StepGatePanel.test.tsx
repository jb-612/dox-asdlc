import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StepGatePanel from '../../../../src/renderer/components/execution/StepGatePanel';
import type { NodeExecutionState, PlanBlockDeliverables } from '../../../../src/shared/types/execution';

describe('StepGatePanel', () => {
  const onContinue = vi.fn();
  const onRevise = vi.fn();

  const waitingNode: NodeExecutionState = {
    nodeId: 'node-1',
    status: 'waiting_gate',
    revisionCount: 0,
  };

  const planDeliverables: PlanBlockDeliverables = {
    blockType: 'plan',
    markdownDocument: '# Plan\n\nThis is the plan.',
    taskList: ['Task A', 'Task B'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the panel container', () => {
    render(
      <StepGatePanel
        node={waitingNode}
        nodeLabel="Planner"
        deliverables={planDeliverables}
        onContinue={onContinue}
        onRevise={onRevise}
      />,
    );
    expect(screen.getByTestId('step-gate-panel')).toBeInTheDocument();
  });

  it('shows node label in header', () => {
    render(
      <StepGatePanel
        node={waitingNode}
        nodeLabel="Planner"
        deliverables={planDeliverables}
        onContinue={onContinue}
        onRevise={onRevise}
      />,
    );
    expect(screen.getByText('Planner')).toBeInTheDocument();
  });

  it('renders scrutiny level selector', () => {
    render(
      <StepGatePanel
        node={waitingNode}
        nodeLabel="Planner"
        deliverables={planDeliverables}
        onContinue={onContinue}
        onRevise={onRevise}
      />,
    );
    expect(screen.getByTestId('scrutiny-selector')).toBeInTheDocument();
  });

  it('renders deliverables viewer', () => {
    render(
      <StepGatePanel
        node={waitingNode}
        nodeLabel="Planner"
        deliverables={planDeliverables}
        onContinue={onContinue}
        onRevise={onRevise}
      />,
    );
    expect(screen.getByTestId('deliverables-viewer')).toBeInTheDocument();
  });

  it('renders continue and revise buttons', () => {
    render(
      <StepGatePanel
        node={waitingNode}
        nodeLabel="Planner"
        deliverables={planDeliverables}
        onContinue={onContinue}
        onRevise={onRevise}
      />,
    );
    expect(screen.getByTestId('continue-btn')).toBeInTheDocument();
    expect(screen.getByTestId('revise-btn')).toBeInTheDocument();
  });

  it('changes scrutiny level when clicking options', () => {
    render(
      <StepGatePanel
        node={waitingNode}
        nodeLabel="Planner"
        deliverables={planDeliverables}
        onContinue={onContinue}
        onRevise={onRevise}
      />,
    );

    // Default is summary
    expect(screen.getByTestId('deliverables-summary')).toBeInTheDocument();

    // Switch to file_list
    fireEvent.click(screen.getByTestId('scrutiny-option-file_list'));
    expect(screen.getByTestId('deliverables-file-list')).toBeInTheDocument();
  });

  it('shows revision badge when revisionCount > 0', () => {
    const revisedNode: NodeExecutionState = {
      ...waitingNode,
      revisionCount: 2,
    };
    render(
      <StepGatePanel
        node={revisedNode}
        nodeLabel="Planner"
        deliverables={planDeliverables}
        onContinue={onContinue}
        onRevise={onRevise}
      />,
    );
    expect(screen.getByTestId('revision-badge')).toHaveTextContent('2');
  });

  it('renders at full_detail level with plan deliverables', () => {
    render(
      <StepGatePanel
        node={waitingNode}
        nodeLabel="Planner"
        deliverables={planDeliverables}
        onContinue={onContinue}
        onRevise={onRevise}
      />,
    );

    fireEvent.click(screen.getByTestId('scrutiny-option-full_detail'));
    // At full_detail level the "Document" summary label should be visible
    expect(screen.getByText('Document')).toBeInTheDocument();
  });
});
