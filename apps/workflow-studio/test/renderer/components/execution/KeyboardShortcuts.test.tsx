import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContinueReviseBar from '../../../../src/renderer/components/execution/ContinueReviseBar';

describe('Keyboard shortcuts (ContinueReviseBar)', () => {
  const onContinue = vi.fn();
  const onRevise = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Ctrl+Enter triggers onContinue when gate is active', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
        gateActive={true}
      />,
    );

    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('Cmd+Enter triggers onContinue on macOS', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
        gateActive={true}
      />,
    );

    fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+R toggles revise textarea visibility', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
        gateActive={true}
      />,
    );

    // Initially no textarea
    expect(screen.queryByTestId('revise-textarea')).not.toBeInTheDocument();

    // First press: show textarea
    fireEvent.keyDown(document, { key: 'R', ctrlKey: true, shiftKey: true });
    expect(screen.getByTestId('revise-textarea')).toBeInTheDocument();

    // Second press: hide textarea
    fireEvent.keyDown(document, { key: 'R', ctrlKey: true, shiftKey: true });
    expect(screen.queryByTestId('revise-textarea')).not.toBeInTheDocument();
  });

  it('shortcuts do not fire when gateActive is false', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
        gateActive={false}
      />,
    );

    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    expect(onContinue).not.toHaveBeenCalled();
  });
});
