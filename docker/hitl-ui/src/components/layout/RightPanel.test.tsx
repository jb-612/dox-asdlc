import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RightPanel from './RightPanel';
import { useEventStore, SystemEvent } from '@/stores/eventStore';

// Mock the event store
vi.mock('@/stores/eventStore', () => ({
  useEventStore: vi.fn(),
}));

const mockEvents: SystemEvent[] = [
  {
    id: 'event-1',
    type: 'run_started',
    description: 'Run started for epic EPIC-001',
    timestamp: new Date(),
    epicId: 'EPIC-001',
    agentType: 'discovery',
  },
  {
    id: 'event-2',
    type: 'gate_pending',
    description: 'Gate pending approval',
    timestamp: new Date(),
    epicId: 'EPIC-001',
  },
];

const mockEventStore = {
  events: mockEvents,
  connected: true,
  reconnecting: false,
  connectionError: null,
  autoScroll: true,
  setAutoScroll: vi.fn(),
  getFilteredEvents: vi.fn(() => mockEvents),
  clearEvents: vi.fn(),
  filter: null,
  setFilter: vi.fn(),
};

describe('RightPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useEventStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockEventStore);
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <RightPanel isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders panel when isOpen is true', () => {
    render(<RightPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Live Events')).toBeInTheDocument();
  });

  it('shows connected indicator when connected', () => {
    render(<RightPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows disconnected indicator when not connected', () => {
    (useEventStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockEventStore,
      connected: false,
    });

    render(<RightPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('shows reconnecting indicator when reconnecting', () => {
    (useEventStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockEventStore,
      connected: false,
      reconnecting: true,
    });

    render(<RightPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('renders events in the feed', () => {
    render(<RightPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Run started for epic EPIC-001')).toBeInTheDocument();
    expect(screen.getByText('Gate pending approval')).toBeInTheDocument();
  });

  it('displays event count', () => {
    render(<RightPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('2 events')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<RightPanel isOpen={true} onClose={onClose} />);

    const closeButton = screen.getByTitle('Close panel');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('calls clearEvents when clear button is clicked', () => {
    render(<RightPanel isOpen={true} onClose={vi.fn()} />);

    const clearButton = screen.getByTitle('Clear events');
    fireEvent.click(clearButton);

    expect(mockEventStore.clearEvents).toHaveBeenCalled();
  });

  it('toggles auto-scroll when pause/play button is clicked', () => {
    render(<RightPanel isOpen={true} onClose={vi.fn()} />);

    const autoScrollButton = screen.getByTitle('Pause auto-scroll');
    fireEvent.click(autoScrollButton);

    expect(mockEventStore.setAutoScroll).toHaveBeenCalledWith(false);
  });

  it('shows filter dropdown when filter button is clicked', () => {
    render(<RightPanel isOpen={true} onClose={vi.fn()} />);

    const filterButton = screen.getByTitle('Filter events');
    fireEvent.click(filterButton);

    expect(screen.getByText('Filter by event type')).toBeInTheDocument();
  });

  it('shows connection error when present', () => {
    (useEventStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockEventStore,
      connectionError: 'Failed to connect to server',
    });

    render(<RightPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
  });

  it('shows empty state when no events', () => {
    (useEventStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockEventStore,
      events: [],
      getFilteredEvents: vi.fn(() => []),
    });

    render(<RightPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('No events yet')).toBeInTheDocument();
  });

  it('expands event details on click', () => {
    const eventsWithMetadata: SystemEvent[] = [
      {
        id: 'event-1',
        type: 'run_started',
        description: 'Run started',
        timestamp: new Date(),
        metadata: { runId: 'run-123', agent: 'discovery' },
      },
    ];

    (useEventStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockEventStore,
      events: eventsWithMetadata,
      getFilteredEvents: vi.fn(() => eventsWithMetadata),
    });

    render(<RightPanel isOpen={true} onClose={vi.fn()} />);

    const eventItem = screen.getByText('Run started');
    fireEvent.click(eventItem);

    // Should show metadata in expanded view
    expect(screen.getByText(/"runId": "run-123"/)).toBeInTheDocument();
  });
});
