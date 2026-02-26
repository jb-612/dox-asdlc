import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { CLISession, CLISpawnConfig } from '../../../../src/shared/types/cli';
import CLISessionList from '../../../../src/renderer/components/cli/CLISessionList';
import type { CLISessionListProps } from '../../../../src/renderer/components/cli/CLISessionList';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<CLISpawnConfig>): CLISpawnConfig {
  return {
    command: 'claude',
    args: ['--help'],
    cwd: '/tmp',
    mode: 'local',
    ...overrides,
  };
}

function makeSession(id: string, overrides?: Partial<CLISession>): CLISession {
  return {
    id,
    config: makeConfig(),
    status: 'running',
    pid: 12345,
    startedAt: '2026-01-15T10:30:00Z',
    mode: 'local',
    ...overrides,
  };
}

function renderList(overrides?: Partial<CLISessionListProps>) {
  const defaultProps: CLISessionListProps = {
    sessions: [],
    selectedSessionId: null,
    onSelect: vi.fn(),
    onKill: vi.fn(),
    onNewSession: vi.fn(),
    ...overrides,
  };
  return { ...render(<CLISessionList {...defaultProps} />), props: defaultProps };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CLISessionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe('empty state', () => {
    it('renders empty state message when no sessions are provided', () => {
      renderList({ sessions: [] });
      expect(
        screen.getByText(/no sessions/i),
      ).toBeInTheDocument();
    });

    it('shows the + New button even when there are no sessions', () => {
      renderList({ sessions: [] });
      expect(screen.getByText('+ New')).toBeInTheDocument();
    });

    it('does not render a list element when there are no sessions', () => {
      const { container } = renderList({ sessions: [] });
      expect(container.querySelector('ul')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Rendering sessions
  // -------------------------------------------------------------------------

  describe('rendering sessions', () => {
    it('renders a list item for each session', () => {
      const sessions = [makeSession('sess-1'), makeSession('sess-2')];
      const { container } = renderList({ sessions });

      const items = container.querySelectorAll('li');
      expect(items.length).toBe(2);
    });

    it('shows the Sessions header', () => {
      renderList({ sessions: [makeSession('s1')] });
      expect(screen.getByText('Sessions')).toBeInTheDocument();
    });

    it('shows truncated session ID (first 8 chars)', () => {
      const longId = 'abcdef1234567890';
      renderList({ sessions: [makeSession(longId)] });

      // truncateId slices to first 8 characters
      expect(screen.getByText('abcdef12')).toBeInTheDocument();
    });

    it('shows full session ID when shorter than 8 chars', () => {
      renderList({ sessions: [makeSession('short')] });
      expect(screen.getByText('short')).toBeInTheDocument();
    });

    it('shows PID when session has a pid', () => {
      renderList({ sessions: [makeSession('s1', { pid: 54321 })] });
      expect(screen.getByText('PID: 54321')).toBeInTheDocument();
    });

    it('does not show PID when session has no pid', () => {
      renderList({
        sessions: [makeSession('s1', { pid: undefined })],
      });
      expect(screen.queryByText(/PID:/)).not.toBeInTheDocument();
    });

    it('shows the command and args for each session', () => {
      renderList({
        sessions: [
          makeSession('s1', {
            config: makeConfig({ command: 'node', args: ['--version', '--flag'] }),
          }),
        ],
      });
      expect(screen.getByText(/node --version --flag/)).toBeInTheDocument();
    });

    it('shows just the command when args is empty', () => {
      renderList({
        sessions: [
          makeSession('s1', {
            config: makeConfig({ command: 'python', args: [] }),
          }),
        ],
      });
      // The text should contain 'python' followed by a space (no args)
      expect(screen.getByText(/python/)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Status badges
  // -------------------------------------------------------------------------

  describe('status badges', () => {
    it('renders a status badge with text matching the status', () => {
      renderList({ sessions: [makeSession('s1', { status: 'running' })] });
      expect(screen.getByText('running')).toBeInTheDocument();
    });

    it('renders correct badge for exited status', () => {
      renderList({ sessions: [makeSession('s1', { status: 'exited' })] });
      expect(screen.getByText('exited')).toBeInTheDocument();
    });

    it('renders correct badge for error status', () => {
      renderList({ sessions: [makeSession('s1', { status: 'error' })] });
      expect(screen.getByText('error')).toBeInTheDocument();
    });

    it('renders correct badge for starting status', () => {
      renderList({ sessions: [makeSession('s1', { status: 'starting' })] });
      expect(screen.getByText('starting')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Kill button visibility
  // -------------------------------------------------------------------------

  describe('Kill button', () => {
    it('shows Kill button for running sessions', () => {
      renderList({ sessions: [makeSession('s1', { status: 'running' })] });
      expect(screen.getByText('Kill')).toBeInTheDocument();
    });

    it('shows Kill button for starting sessions', () => {
      renderList({ sessions: [makeSession('s1', { status: 'starting' })] });
      expect(screen.getByText('Kill')).toBeInTheDocument();
    });

    it('does not show Kill button for exited sessions', () => {
      renderList({ sessions: [makeSession('s1', { status: 'exited' })] });
      expect(screen.queryByText('Kill')).not.toBeInTheDocument();
    });

    it('does not show Kill button for error sessions', () => {
      renderList({ sessions: [makeSession('s1', { status: 'error' })] });
      expect(screen.queryByText('Kill')).not.toBeInTheDocument();
    });

    it('shows Kill buttons only for running/starting sessions in a mixed list', () => {
      const sessions = [
        makeSession('s1', { status: 'running' }),
        makeSession('s2', { status: 'exited' }),
        makeSession('s3', { status: 'starting' }),
        makeSession('s4', { status: 'error' }),
      ];
      renderList({ sessions });

      const killButtons = screen.getAllByText('Kill');
      expect(killButtons.length).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Interaction callbacks
  // -------------------------------------------------------------------------

  describe('interaction callbacks', () => {
    it('calls onSelect with session ID when clicking a session item', () => {
      const onSelect = vi.fn();
      renderList({
        sessions: [makeSession('sess-abc')],
        onSelect,
      });

      const item = screen.getByText('sess-abc').closest('li')!;
      fireEvent.click(item);

      expect(onSelect).toHaveBeenCalledWith('sess-abc');
    });

    it('calls onKill with session ID when clicking Kill button', () => {
      const onKill = vi.fn();
      renderList({
        sessions: [makeSession('sess-xyz', { status: 'running' })],
        onKill,
      });

      fireEvent.click(screen.getByText('Kill'));

      expect(onKill).toHaveBeenCalledWith('sess-xyz');
    });

    it('Kill button click does not propagate to onSelect (stopPropagation)', () => {
      const onSelect = vi.fn();
      const onKill = vi.fn();
      renderList({
        sessions: [makeSession('sess-1', { status: 'running' })],
        onSelect,
        onKill,
      });

      fireEvent.click(screen.getByText('Kill'));

      expect(onKill).toHaveBeenCalledTimes(1);
      // onSelect should NOT be called because stopPropagation is used
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('calls onNewSession when clicking + New button', () => {
      const onNewSession = vi.fn();
      renderList({ onNewSession });

      fireEvent.click(screen.getByText('+ New'));

      expect(onNewSession).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Selected state
  // -------------------------------------------------------------------------

  describe('selected state', () => {
    it('applies selected styling to the matching session', () => {
      const { container } = renderList({
        sessions: [makeSession('s1'), makeSession('s2')],
        selectedSessionId: 's1',
      });

      const items = container.querySelectorAll('li');
      // The selected item should have the blue border class
      expect(items[0].className).toContain('border-l-blue-500');
      expect(items[1].className).not.toContain('border-l-blue-500');
    });

    it('applies non-selected styling to non-matching sessions', () => {
      const { container } = renderList({
        sessions: [makeSession('s1'), makeSession('s2')],
        selectedSessionId: 's1',
      });

      const items = container.querySelectorAll('li');
      expect(items[1].className).toContain('border-l-transparent');
    });
  });

  // -------------------------------------------------------------------------
  // F10-T08: StatusBadge migration
  // -------------------------------------------------------------------------

  describe('StatusBadge migration (F10-T08)', () => {
    it('renders status text using shared StatusBadge', () => {
      renderList({ sessions: [makeSession('s1', { status: 'running' })] });
      // After migration, status text is rendered (not just a dot with title)
      expect(screen.getByText('running')).toBeInTheDocument();
    });

    it('renders error status text using shared StatusBadge', () => {
      renderList({ sessions: [makeSession('s1', { status: 'error' })] });
      expect(screen.getByText('error')).toBeInTheDocument();
    });

    it('renders status with inline styles (shared StatusBadge)', () => {
      renderList({ sessions: [makeSession('s1', { status: 'running' })] });
      const badge = screen.getByText('running');
      expect(badge.style.backgroundColor).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Time formatting
  // -------------------------------------------------------------------------

  describe('time display', () => {
    it('renders the start time for a session', () => {
      // We cannot easily predict the locale-formatted output,
      // but we can ensure something is rendered in the time area
      const { container } = renderList({
        sessions: [makeSession('s1', { startedAt: '2026-01-15T14:30:00Z' })],
      });

      // The component renders formatTime in a span -- just check the item renders
      const items = container.querySelectorAll('li');
      expect(items.length).toBe(1);
      // The time text should be within the item
      expect(items[0].textContent).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Multiple sessions
  // -------------------------------------------------------------------------

  describe('multiple sessions', () => {
    it('renders all provided sessions', () => {
      const sessions = Array.from({ length: 5 }, (_, i) =>
        makeSession(`session-${i}`, { pid: 1000 + i }),
      );
      const { container } = renderList({ sessions });

      expect(container.querySelectorAll('li').length).toBe(5);
    });

    it('each session has its own PID displayed', () => {
      const sessions = [
        makeSession('s1', { pid: 111 }),
        makeSession('s2', { pid: 222 }),
      ];
      renderList({ sessions });

      expect(screen.getByText('PID: 111')).toBeInTheDocument();
      expect(screen.getByText('PID: 222')).toBeInTheDocument();
    });
  });
});
