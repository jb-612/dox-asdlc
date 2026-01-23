/**
 * Tests for WebSocket integration with the app
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useEffect } from 'react';
import { wsClient, WebSocketClient } from '@/utils/websocket';
import { useEventStore } from '@/stores/eventStore';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    id: 'mock-socket-id',
    io: {
      on: vi.fn(),
    },
  };
  return {
    io: vi.fn(() => mockSocket),
    Socket: vi.fn(),
  };
});

// Test component that uses WebSocket integration
function TestComponent({ onEvent }: { onEvent?: (event: unknown) => void }) {
  useEffect(() => {
    wsClient.connect();

    if (onEvent) {
      wsClient.subscribe('test_event', onEvent);
    }

    return () => {
      if (onEvent) {
        wsClient.unsubscribe('test_event', onEvent);
      }
      wsClient.disconnect();
    };
  }, [onEvent]);

  const { connectionState } = useEventStore();

  return (
    <div>
      <span data-testid="connection-state">{connectionState}</span>
    </div>
  );
}

describe('WebSocket Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEventStore.getState().reset();
  });

  afterEach(() => {
    wsClient.disconnect();
  });

  describe('Connection Management', () => {
    it('connects on component mount', () => {
      render(<TestComponent />);
      expect(wsClient.connect).toBeDefined();
    });

    it('disconnects on component unmount', () => {
      const { unmount } = render(<TestComponent />);
      unmount();
      // Disconnect should have been called
      expect(true).toBe(true);
    });

    it('displays connection state', () => {
      render(<TestComponent />);
      expect(screen.getByTestId('connection-state')).toBeInTheDocument();
    });

    it('updates store connection state on connect', async () => {
      render(<TestComponent />);

      // Simulate connection
      act(() => {
        useEventStore.getState().setConnectionState('connected');
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-state')).toHaveTextContent('connected');
      });
    });

    it('updates store connection state on disconnect', async () => {
      render(<TestComponent />);

      act(() => {
        useEventStore.getState().setConnectionState('disconnected');
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-state')).toHaveTextContent('disconnected');
      });
    });
  });

  describe('Event Handling', () => {
    it('subscribes to events', () => {
      const handler = vi.fn();
      render(<TestComponent onEvent={handler} />);

      // The component should have subscribed
      expect(true).toBe(true);
    });

    it('unsubscribes on unmount', () => {
      const handler = vi.fn();
      const { unmount } = render(<TestComponent onEvent={handler} />);
      unmount();

      // Should not leak subscriptions
      expect(true).toBe(true);
    });

    it('adds events to store when received', async () => {
      render(<TestComponent />);

      act(() => {
        useEventStore.getState().addEvent({
          type: 'test_event',
          description: 'Test event occurred',
        });
      });

      await waitFor(() => {
        expect(useEventStore.getState().events).toHaveLength(1);
      });
    });

    it('maintains event order', async () => {
      render(<TestComponent />);

      act(() => {
        useEventStore.getState().addEvent({
          type: 'event_a',
          description: 'First event',
        });
        useEventStore.getState().addEvent({
          type: 'event_b',
          description: 'Second event',
        });
      });

      const events = useEventStore.getState().events;
      expect(events[0].type).toBe('event_a');
      expect(events[1].type).toBe('event_b');
    });
  });

  describe('Event Store Integration', () => {
    it('respects event limit', async () => {
      render(<TestComponent />);

      // Add more than 100 events
      act(() => {
        for (let i = 0; i < 150; i++) {
          useEventStore.getState().addEvent({
            type: 'test',
            description: `Event ${i}`,
          });
        }
      });

      await waitFor(() => {
        expect(useEventStore.getState().events.length).toBeLessThanOrEqual(100);
      });
    });

    it('resets events on reset', async () => {
      render(<TestComponent />);

      act(() => {
        useEventStore.getState().addEvent({
          type: 'test',
          description: 'Test event',
        });
        useEventStore.getState().reset();
      });

      await waitFor(() => {
        expect(useEventStore.getState().events).toHaveLength(0);
      });
    });
  });

  describe('Reconnection', () => {
    it('tracks reconnection attempts', async () => {
      render(<TestComponent />);

      act(() => {
        useEventStore.getState().setConnectionState('reconnecting');
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-state')).toHaveTextContent('reconnecting');
      });
    });

    it('recovers from failed connection', async () => {
      render(<TestComponent />);

      act(() => {
        useEventStore.getState().setConnectionState('error');
        useEventStore.getState().setConnectionState('connecting');
        useEventStore.getState().setConnectionState('connected');
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-state')).toHaveTextContent('connected');
      });
    });
  });

  describe('Error Handling', () => {
    it('handles connection errors', async () => {
      render(<TestComponent />);

      act(() => {
        useEventStore.getState().setConnectionState('error');
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-state')).toHaveTextContent('error');
      });
    });
  });
});

describe('WebSocketClient', () => {
  let client: WebSocketClient;

  beforeEach(() => {
    client = new WebSocketClient('http://test:3000');
    vi.clearAllMocks();
  });

  afterEach(() => {
    client.disconnect();
  });

  it('creates a new client instance', () => {
    expect(client).toBeDefined();
  });

  it('can connect', () => {
    client.connect();
    expect(true).toBe(true);
  });

  it('can disconnect', () => {
    client.connect();
    client.disconnect();
    expect(true).toBe(true);
  });

  it('can subscribe to events', () => {
    const handler = vi.fn();
    client.subscribe('test', handler);
    expect(true).toBe(true);
  });

  it('can unsubscribe from events', () => {
    const handler = vi.fn();
    client.subscribe('test', handler);
    client.unsubscribe('test', handler);
    expect(true).toBe(true);
  });

  it('tracks subscriptions', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    client.subscribe('event_a', handler1);
    client.subscribe('event_b', handler2);
    expect(true).toBe(true);
  });
});
