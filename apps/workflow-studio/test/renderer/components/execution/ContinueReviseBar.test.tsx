import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContinueReviseBar from '../../../../src/renderer/components/execution/ContinueReviseBar';

describe('ContinueReviseBar', () => {
  const onContinue = vi.fn();
  const onRevise = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Continue and Revise buttons', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
      />,
    );
    expect(screen.getByTestId('continue-btn')).toBeInTheDocument();
    expect(screen.getByTestId('revise-btn')).toBeInTheDocument();
  });

  it('calls onContinue when Continue is clicked', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
      />,
    );
    fireEvent.click(screen.getByTestId('continue-btn'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows textarea when Revise is clicked', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
      />,
    );
    // Textarea should not be visible initially
    expect(screen.queryByTestId('revise-textarea')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('revise-btn'));
    expect(screen.getByTestId('revise-textarea')).toBeInTheDocument();
  });

  it('submit button is disabled when feedback is less than 10 chars', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
      />,
    );
    fireEvent.click(screen.getByTestId('revise-btn'));

    const textarea = screen.getByTestId('revise-textarea');
    fireEvent.change(textarea, { target: { value: 'short' } });

    const submitBtn = screen.getByTestId('revise-submit-btn');
    expect(submitBtn).toBeDisabled();
  });

  it('submit button is enabled when feedback is at least 10 chars', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
      />,
    );
    fireEvent.click(screen.getByTestId('revise-btn'));

    const textarea = screen.getByTestId('revise-textarea');
    fireEvent.change(textarea, { target: { value: 'This is long enough feedback' } });

    const submitBtn = screen.getByTestId('revise-submit-btn');
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls onRevise with feedback text when Submit is clicked', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
      />,
    );
    fireEvent.click(screen.getByTestId('revise-btn'));

    const textarea = screen.getByTestId('revise-textarea');
    fireEvent.change(textarea, { target: { value: 'Please revise the output' } });

    fireEvent.click(screen.getByTestId('revise-submit-btn'));
    expect(onRevise).toHaveBeenCalledWith('Please revise the output');
  });

  it('hides textarea after submit', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
      />,
    );
    fireEvent.click(screen.getByTestId('revise-btn'));
    const textarea = screen.getByTestId('revise-textarea');
    fireEvent.change(textarea, { target: { value: 'Please revise the output' } });
    fireEvent.click(screen.getByTestId('revise-submit-btn'));

    expect(screen.queryByTestId('revise-textarea')).not.toBeInTheDocument();
  });

  it('shows revision badge when revisionCount > 0', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={3}
      />,
    );
    expect(screen.getByTestId('revision-badge')).toHaveTextContent('3');
  });

  it('does not show revision badge when revisionCount is 0', () => {
    render(
      <ContinueReviseBar
        onContinue={onContinue}
        onRevise={onRevise}
        revisionCount={0}
      />,
    );
    expect(screen.queryByTestId('revision-badge')).not.toBeInTheDocument();
  });
});
