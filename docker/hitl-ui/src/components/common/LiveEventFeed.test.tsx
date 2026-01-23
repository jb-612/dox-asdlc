/**
 * Tests for LiveEventFeed component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LiveEventFeed from './LiveEventFeed';
import { useEventStore, type SystemEvent } from '../../stores/eventStore';

// Mock the eventStore
vi.mock('../../stores/eventStore', async () => {
  const actual = await vi.importActual('../../stores/eventStore');
  return {
    ...actual,
    useEventStore: vi.fn(),
  };
});

// Helper to create mock events
function createMockEvent(overrides: Partial<SystemEvent> = {}): SystemEvent {
  return {
    id: `evt_${Math.random().toString(36).substr(2, 9)}`,
    type: 'run.started',
    timestamp: new Date(),
    description: 'Test event',
    data: { agent_type: 'coding_agent', model: 'sonnet' },
    ...overrides,
  };
}

describe('LiveEventFeed', () => {
  const mockClearEvents = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
        selector({
          events: [],
          connected: true,
          connectionError: null,
          reconnecting: false,
          addEvent: vi.fn(),
          clearEvents: mockClearEvents,
          setConnected: vi.fn(),
          setConnectionError: vi.fn(),
        } as unknown as ReturnType<typeof useEventStore>)
    );
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<LiveEventFeed />);
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('shows connection status when enabled', () => {
      render(<LiveEventFeed showConnectionStatus />);
      expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('shows disconnected status when not connected', () => {
      (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
          selector({
            events: [],
            connected: false,
            connectionError: null,
            reconnecting: false,
            addEvent: vi.fn(),
            clearEvents: mockClearEvents,
            setConnected: vi.fn(),
            setConnectionError: vi.fn(),
            setReconnecting: vi.fn(),
          } as unknown as ReturnType<typeof useEventStore>)
      );

      render(<LiveEventFeed showConnectionStatus />);
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('hides connection status when disabled', () => {
      render(<LiveEventFeed showConnectionStatus={false} />);
      expect(screen.queryByTestId('connection-indicator')).not.toBeInTheDocument();
    });

    it('shows event count', () => {
      render(<LiveEventFeed />);
      expect(screen.getByTestId('event-count')).toHaveTextContent('0 events');
    });

    it('applies custom className', () => {
      const { container } = render(<LiveEventFeed className="my-custom-class" />);
      expect(container.firstChild).toHaveClass('my-custom-class');
    });
  });

  describe('Event Display', () => {
    it('displays events from eventStore', () => {
      const mockEvents = [
        createMockEvent({ id: 'evt_1', type: 'run.started' }),
        createMockEvent({ id: 'evt_2', type: 'run.completed' }),
      ];

      (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
          selector({
            events: mockEvents,
            connected: true,
            connectionError: null,
            reconnecting: false,
            addEvent: vi.fn(),
            clearEvents: mockClearEvents,
            setConnected: vi.fn(),
            setConnectionError: vi.fn(),
            setReconnecting: vi.fn(),
          } as unknown as ReturnType<typeof useEventStore>)
      );

      render(<LiveEventFeed />);
      expect(screen.getByTestId('event-count')).toHaveTextContent('2 events');
    });

    it('shows empty state when no events', () => {
      render(<LiveEventFeed />);
      expect(screen.getByText('No events yet')).toBeInTheDocument();
    });

    it('renders event descriptions correctly', () => {
      const mockEvents = [
        createMockEvent({
          id: 'evt_1',
          type: 'run.started',
          data: { agent_type: 'coding_agent', model: 'opus' },
        }),
      ];

      (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
          selector({
            events: mockEvents,
            connected: true,
            connectionError: null,
            reconnecting: false,
            addEvent: vi.fn(),
            clearEvents: mockClearEvents,
            setConnected: vi.fn(),
            setConnectionError: vi.fn(),
            setReconnecting: vi.fn(),
          } as unknown as ReturnType<typeof useEventStore>)
      );

      render(<LiveEventFeed />);
      expect(screen.getByText(/coding_agent started/)).toBeInTheDocument();
    });
  });

  describe('Event Expansion', () => {
    it('expands event to show metadata when clicked', () => {
      const mockEvents = [
        createMockEvent({
          id: 'evt_1',
          data: { custom_field: 'custom_value' },
        }),
      ];

      (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
          selector({
            events: mockEvents,
            connected: true,
            connectionError: null,
            reconnecting: false,
            addEvent: vi.fn(),
            clearEvents: mockClearEvents,
            setConnected: vi.fn(),
            setConnectionError: vi.fn(),
            setReconnecting: vi.fn(),
          } as unknown as ReturnType<typeof useEventStore>)
      );

      render(<LiveEventFeed />);

      // Click to expand
      const eventButton = screen.getByRole('button', { name: /started/ });
      fireEvent.click(eventButton);

      // Should show metadata
      expect(screen.getByText(/"custom_field"/)).toBeInTheDocument();
    });

    it('collapses event when clicked again', () => {
      const mockEvents = [
        createMockEvent({
          id: 'evt_1',
          data: { custom_field: 'custom_value' },
        }),
      ];

      (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
          selector({
            events: mockEvents,
            connected: true,
            connectionError: null,
            reconnecting: false,
            addEvent: vi.fn(),
            clearEvents: mockClearEvents,
            setConnected: vi.fn(),
            setConnectionError: vi.fn(),
            setReconnecting: vi.fn(),
          } as unknown as ReturnType<typeof useEventStore>)
      );

      render(<LiveEventFeed />);

      const eventButton = screen.getByRole('button', { name: /started/ });

      // Expand
      fireEvent.click(eventButton);
      expect(screen.getByText(/"custom_field"/)).toBeInTheDocument();

      // Collapse
      fireEvent.click(eventButton);
      expect(screen.queryByText(/"custom_field"/)).not.toBeInTheDocument();
    });

    it('calls onEventClick callback when event clicked', () => {
      const onEventClick = vi.fn();
      const mockEvent = createMockEvent({ id: 'evt_1' });

      (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
          selector({
            events: [mockEvent],
            connected: true,
            connectionError: null,
            reconnecting: false,
            addEvent: vi.fn(),
            clearEvents: mockClearEvents,
            setConnected: vi.fn(),
            setConnectionError: vi.fn(),
            setReconnecting: vi.fn(),
          } as unknown as ReturnType<typeof useEventStore>)
      );

      render(<LiveEventFeed onEventClick={onEventClick} />);

      fireEvent.click(screen.getByRole('button', { name: /started/ }));
      expect(onEventClick).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('Pause Functionality', () => {
    it('shows pause button by default', () => {
      render(<LiveEventFeed />);
      expect(screen.getByTestId('pause-button')).toBeInTheDocument();
    });

    it('toggles pause state when clicked', () => {
      render(<LiveEventFeed />);

      const pauseButton = screen.getByTestId('pause-button');

      // Click to pause
      fireEvent.click(pauseButton);
      expect(screen.getByText('Auto-scroll paused')).toBeInTheDocument();

      // Click to resume
      fireEvent.click(pauseButton);
      expect(screen.queryByText('Auto-scroll paused')).not.toBeInTheDocument();
    });

    it('shows pause indicator when paused', () => {
      render(<LiveEventFeed />);

      fireEvent.click(screen.getByTestId('pause-button'));
      expect(screen.getByText('Auto-scroll paused')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('shows filter button when enabled', () => {
      render(<LiveEventFeed showFilters />);
      expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument();
    });

    it('hides filter button when disabled', () => {
      render(<LiveEventFeed showFilters={false} />);
      expect(screen.queryByRole('button', { name: /filter/i })).not.toBeInTheDocument();
    });

    it('opens filter dropdown when clicked', () => {
      render(<LiveEventFeed showFilters />);

      fireEvent.click(screen.getByRole('button', { name: /filter/i }));
      expect(screen.getByText('Runs')).toBeInTheDocument();
      expect(screen.getByText('Gates')).toBeInTheDocument();
      expect(screen.getByText('Artifacts')).toBeInTheDocument();
    });

    it('filters events by type', () => {
      const mockEvents = [
        createMockEvent({ id: 'evt_1', type: 'run.started' }),
        createMockEvent({ id: 'evt_2', type: 'gate.created' }),
        createMockEvent({ id: 'evt_3', type: 'run.completed' }),
      ];

      (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
          selector({
            events: mockEvents,
            connected: true,
            connectionError: null,
            reconnecting: false,
            addEvent: vi.fn(),
            clearEvents: mockClearEvents,
            setConnected: vi.fn(),
            setConnectionError: vi.fn(),
            setReconnecting: vi.fn(),
          } as unknown as ReturnType<typeof useEventStore>)
      );

      render(<LiveEventFeed showFilters />);

      // Initially shows all events
      expect(screen.getByTestId('event-count')).toHaveTextContent('3 events');

      // Filter to runs only
      fireEvent.click(screen.getByRole('button', { name: /filter/i }));
      fireEvent.click(screen.getByText('Runs'));

      // Should only show run events
      expect(screen.getByTestId('event-count')).toHaveTextContent('2 events');
    });

    it('respects initial filter prop', () => {
      const mockEvents = [
        createMockEvent({ id: 'evt_1', type: 'run.started' }),
        createMockEvent({ id: 'evt_2', type: 'gate.created' }),
      ];

      (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
          selector({
            events: mockEvents,
            connected: true,
            connectionError: null,
            reconnecting: false,
            addEvent: vi.fn(),
            clearEvents: mockClearEvents,
            setConnected: vi.fn(),
            setConnectionError: vi.fn(),
            setReconnecting: vi.fn(),
          } as unknown as ReturnType<typeof useEventStore>)
      );

      render(<LiveEventFeed showFilters initialFilter="gates" />);

      // Should only show gate events
      expect(screen.getByTestId('event-count')).toHaveTextContent('1 events');
    });
  });

  describe('Clear Events', () => {
    it('shows clear button', () => {
      render(<LiveEventFeed />);
      expect(screen.getByTestId('clear-button')).toBeInTheDocument();
    });

    it('calls clearEvents when clear button clicked', () => {
      render(<LiveEventFeed />);

      fireEvent.click(screen.getByTestId('clear-button'));
      expect(mockClearEvents).toHaveBeenCalled();
    });
  });

  describe('Event Limit', () => {
    it('limits displayed events to MAX_EVENTS (100)', () => {
      // Create 150 events
      const mockEvents = Array.from({ length: 150 }, (_, i) =>
        createMockEvent({ id: `evt_${i}` })
      );

      (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
          selector({
            events: mockEvents,
            connected: true,
            connectionError: null,
            reconnecting: false,
            addEvent: vi.fn(),
            clearEvents: mockClearEvents,
            setConnected: vi.fn(),
            setConnectionError: vi.fn(),
            setReconnecting: vi.fn(),
          } as unknown as ReturnType<typeof useEventStore>)
      );

      render(<LiveEventFeed />);

      // Should show only 100 events
      expect(screen.getByTestId('event-count')).toHaveTextContent('100 events');
    });
  });

  describe('Event Types', () => {
    it.each([
      ['run.started', /started/],
      ['run.completed', /completed/],
      ['run.failed', /failed/],
      ['gate.created', /awaiting decision/],
      ['gate.decided', /Gate/],
      ['artifact.created', /Artifact created/],
      ['session.started', /Session started/],
      ['error', /Error/],
    ])('renders %s event correctly', (type, pattern) => {
      const mockEvent = createMockEvent({
        id: 'evt_1',
        type,
        data: {
          agent_type: 'test_agent',
          model: 'sonnet',
          name: 'test.py',
          error: 'Test error',
          decision: 'approved',
          decided_by: 'user',
        },
      });

      (useEventStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: ReturnType<typeof useEventStore>) => unknown) =>
          selector({
            events: [mockEvent],
            connected: true,
            connectionError: null,
            reconnecting: false,
            addEvent: vi.fn(),
            clearEvents: mockClearEvents,
            setConnected: vi.fn(),
            setConnectionError: vi.fn(),
            setReconnecting: vi.fn(),
          } as unknown as ReturnType<typeof useEventStore>)
      );

      render(<LiveEventFeed />);
      expect(screen.getByText(pattern)).toBeInTheDocument();
    });
  });
});
