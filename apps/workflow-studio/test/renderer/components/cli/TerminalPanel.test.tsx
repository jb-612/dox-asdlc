import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mock xterm.js — it requires a real DOM with canvas, which jsdom lacks
// ---------------------------------------------------------------------------

const mockWrite = vi.fn();
const mockWriteln = vi.fn();
const mockClear = vi.fn();
const mockOpen = vi.fn();
const mockDispose = vi.fn();
const mockLoadAddon = vi.fn();

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: mockOpen,
    write: mockWrite,
    writeln: mockWriteln,
    clear: mockClear,
    dispose: mockDispose,
    loadAddon: mockLoadAddon,
  })),
}));

const mockFit = vi.fn();

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: mockFit,
    dispose: vi.fn(),
  })),
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

import TerminalPanel from '../../../../src/renderer/components/cli/TerminalPanel';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TerminalPanel', () => {
  const defaultProps = {
    outputLines: [] as string[],
    hasSession: true,
    isRunning: true,
    onWrite: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<TerminalPanel {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('shows empty state when hasSession is false', () => {
    render(
      <TerminalPanel
        outputLines={[]}
        hasSession={false}
        isRunning={false}
        onWrite={vi.fn()}
      />,
    );
    expect(screen.getByText('No session selected')).toBeInTheDocument();
  });

  it('does not show empty state when hasSession is true', () => {
    render(<TerminalPanel {...defaultProps} />);
    expect(screen.queryByText('No session selected')).not.toBeInTheDocument();
  });

  it('shows stdin input when isRunning is true', () => {
    render(<TerminalPanel {...defaultProps} isRunning={true} />);
    expect(screen.getByPlaceholderText('Type command...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('hides stdin input when isRunning is false', () => {
    render(<TerminalPanel {...defaultProps} isRunning={false} />);
    expect(screen.queryByPlaceholderText('Type command...')).not.toBeInTheDocument();
  });

  it('calls onWrite with input text plus newline on submit', () => {
    const onWrite = vi.fn();
    render(<TerminalPanel {...defaultProps} onWrite={onWrite} />);

    const input = screen.getByPlaceholderText('Type command...');
    fireEvent.change(input, { target: { value: 'hello world' } });
    fireEvent.submit(input.closest('form')!);

    expect(onWrite).toHaveBeenCalledWith('hello world\n');
  });

  it('clears input after submit', () => {
    render(<TerminalPanel {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type command...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.submit(input.closest('form')!);

    expect(input.value).toBe('');
  });

  it('does not call onWrite for whitespace-only input', () => {
    const onWrite = vi.fn();
    render(<TerminalPanel {...defaultProps} onWrite={onWrite} />);

    const input = screen.getByPlaceholderText('Type command...');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form')!);

    expect(onWrite).not.toHaveBeenCalled();
  });
});
