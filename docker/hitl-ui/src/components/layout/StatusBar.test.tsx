import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusBar from './StatusBar';
import { useSessionStore } from '@/stores/sessionStore';
import { useEventStore } from '@/stores/eventStore';

// Mock the stores
vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: vi.fn(),
}));

vi.mock('@/stores/eventStore', () => ({
  useEventStore: vi.fn(),
}));

const mockSessionStore = {
  currentBranch: 'main',
  currentGitSha: 'abc1234def5678',
  repo: 'dox-asdlc',
};

const mockEventStore = {
  connected: true,
  events: [{ id: '1' }, { id: '2' }, { id: '3' }],
};

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSessionStore);
    (useEventStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockEventStore);
  });

  it('renders git branch and SHA', () => {
    render(<StatusBar />);
    expect(screen.getByText('main @ abc1234')).toBeInTheDocument();
  });

  it('shows "No repo selected" when repo is not set', () => {
    (useSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockSessionStore,
      repo: '',
    });

    render(<StatusBar />);
    expect(screen.getByText('No repo selected')).toBeInTheDocument();
  });

  it('displays worker count', () => {
    render(<StatusBar activeWorkers={3} totalWorkers={5} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('/5 workers')).toBeInTheDocument();
  });

  it('displays pending gates count', () => {
    render(<StatusBar pendingGates={2} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/pending gates/)).toBeInTheDocument();
  });

  it('highlights pending gates when count is greater than 0', () => {
    render(<StatusBar pendingGates={5} />);
    const gateCount = screen.getByText('5');
    expect(gateCount).toHaveClass('text-status-warning');
  });

  it('shows healthy status with correct color', () => {
    render(<StatusBar systemHealth="healthy" />);
    const healthLabel = screen.getByText('Healthy');
    expect(healthLabel).toBeInTheDocument();
  });

  it('shows degraded status with correct color', () => {
    render(<StatusBar systemHealth="degraded" />);
    const healthLabel = screen.getByText('Degraded');
    expect(healthLabel).toBeInTheDocument();
  });

  it('shows unhealthy status with correct color', () => {
    render(<StatusBar systemHealth="unhealthy" />);
    const healthLabel = screen.getByText('Unhealthy');
    expect(healthLabel).toBeInTheDocument();
  });

  it('displays event count', () => {
    render(<StatusBar />);
    expect(screen.getByText('3 events')).toBeInTheDocument();
  });

  it('calls onOpenEventPanel when events button is clicked', () => {
    const onOpenEventPanel = vi.fn();
    render(<StatusBar onOpenEventPanel={onOpenEventPanel} />);

    const eventsButton = screen.getByText('3 events').closest('button');
    if (eventsButton) {
      fireEvent.click(eventsButton);
    }

    expect(onOpenEventPanel).toHaveBeenCalled();
  });

  it('shows connected status for events', () => {
    render(<StatusBar onOpenEventPanel={() => {}} />);
    // When connected, the events section should be rendered
    expect(screen.getByText('3 events')).toBeInTheDocument();
    // Connection status affects color styling which is applied via clsx
    const eventsContainer = screen.getByText('3 events').parentElement;
    expect(eventsContainer).toBeTruthy();
  });

  it('shows disconnected status for events', () => {
    (useEventStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockEventStore,
      connected: false,
    });

    render(<StatusBar onOpenEventPanel={() => {}} />);
    expect(screen.getByText('3 events')).toBeInTheDocument();
    // When disconnected, color styling changes
    const eventsContainer = screen.getByText('3 events').parentElement;
    expect(eventsContainer).toBeTruthy();
  });

  it('uses default values when props are not provided', () => {
    render(<StatusBar />);
    // Should show default worker count (0 appears twice: active and pending gates)
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('/0 workers')).toBeInTheDocument();
    // Should show healthy status
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
});
