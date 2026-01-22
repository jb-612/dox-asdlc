import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { io, Socket } from 'socket.io-client';
import { wsClient } from './websocket';
import { useEventStore } from '@/stores/eventStore';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

type EventHandler = (data: unknown) => void;

describe('WebSocketClient', () => {
  let mockSocket: Partial<Socket>;
  let eventHandlers: Record<string, EventHandler>;

  beforeEach(() => {
    // Reset event store
    useEventStore.setState({
      connected: false,
      reconnecting: false,
      connectionError: null,
      events: [],
    });

    // Create mock socket with event handling
    eventHandlers = {};
    mockSocket = {
      on: vi.fn((event: string, handler: EventHandler) => {
        eventHandlers[event] = handler;
        return mockSocket as Socket;
      }),
      off: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };

    // Mock io() to return our mock socket
    (io as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should initialize socket with correct configuration', () => {
      const url = 'ws://localhost:8080/ws';
      wsClient.connect(url);

      expect(io).toHaveBeenCalledWith(url, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        transports: ['websocket', 'polling'],
        autoConnect: false,
      });
    });

    it('should update eventStore on connection', () => {
      wsClient.connect('ws://localhost:8080/ws');

      // Simulate connection event
      eventHandlers['connect']?.();

      const state = useEventStore.getState();
      expect(state.connected).toBe(true);
      expect(state.reconnecting).toBe(false);
      expect(state.connectionError).toBeNull();
    });

    it('should update eventStore on disconnection', () => {
      wsClient.connect('ws://localhost:8080/ws');
      eventHandlers['connect']?.();

      // Simulate disconnect event
      eventHandlers['disconnect']?.();

      const state = useEventStore.getState();
      expect(state.connected).toBe(false);
    });

    it('should update eventStore on connection error', () => {
      wsClient.connect('ws://localhost:8080/ws');

      const error = new Error('Connection failed');
      eventHandlers['connect_error']?.(error);

      const state = useEventStore.getState();
      expect(state.connectionError).toBe('Connection failed');
      expect(state.connected).toBe(false);
    });

    it('should handle manual disconnect', () => {
      wsClient.connect('ws://localhost:8080/ws');
      eventHandlers['connect']?.();

      wsClient.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      const state = useEventStore.getState();
      expect(state.connected).toBe(false);
      expect(state.reconnecting).toBe(false);
    });

    it('should be idempotent on multiple disconnect calls', () => {
      wsClient.connect('ws://localhost:8080/ws');

      wsClient.disconnect();
      wsClient.disconnect();
      wsClient.disconnect();

      // Should only call disconnect once on the socket
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should track connection state correctly', () => {
      expect(wsClient.isConnected()).toBe(false);

      wsClient.connect('ws://localhost:8080/ws');

      // Simulate socket.io updating the connected property
      mockSocket.connected = true;
      eventHandlers['connect']?.();

      expect(wsClient.isConnected()).toBe(true);

      mockSocket.connected = false;
      wsClient.disconnect();
      expect(wsClient.isConnected()).toBe(false);
    });
  });

  describe('Reconnection Logic', () => {
    it('should update eventStore on reconnect attempt', () => {
      wsClient.connect('ws://localhost:8080/ws');

      eventHandlers['reconnect_attempt']?.(1);

      const state = useEventStore.getState();
      expect(state.reconnecting).toBe(true);
    });

    it('should track reconnection attempts', () => {
      wsClient.connect('ws://localhost:8080/ws');

      eventHandlers['reconnect_attempt']?.(1);
      expect(wsClient.getReconnectAttempts()).toBe(1);

      eventHandlers['reconnect_attempt']?.(2);
      expect(wsClient.getReconnectAttempts()).toBe(2);

      eventHandlers['connect']?.();
      expect(wsClient.getReconnectAttempts()).toBe(0);
    });

    it('should update eventStore on successful reconnect', () => {
      wsClient.connect('ws://localhost:8080/ws');
      eventHandlers['reconnect_attempt']?.(1);

      eventHandlers['reconnect']?.();

      const state = useEventStore.getState();
      expect(state.connected).toBe(true);
      expect(state.reconnecting).toBe(false);
    });

    it('should handle reconnection failure', () => {
      wsClient.connect('ws://localhost:8080/ws');

      eventHandlers['reconnect_failed']?.();

      const state = useEventStore.getState();
      expect(state.connectionError).toBe(
        'Failed to reconnect after maximum attempts'
      );
      expect(state.connected).toBe(false);
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to events and forward to eventStore', () => {
      wsClient.connect('ws://localhost:8080/ws');
      eventHandlers['connect']?.();

      const handler = vi.fn();
      wsClient.subscribe('agent:completed', handler);

      // Simulate event from server
      const eventData = {
        type: 'agent:completed',
        agentType: 'coder',
        runId: 'run-123',
        description: 'Coding task completed',
        metadata: { tokens: 1000 },
      };

      eventHandlers['agent:completed']?.(eventData);

      // Should call handler
      expect(handler).toHaveBeenCalledWith(eventData);

      // Should add to eventStore
      const state = useEventStore.getState();
      expect(state.events).toHaveLength(1);
      expect(state.events[0]).toMatchObject({
        type: 'agent:completed',
        agentType: 'coder',
        runId: 'run-123',
        description: 'Coding task completed',
      });
    });

    it('should support multiple handlers per event type', () => {
      wsClient.connect('ws://localhost:8080/ws');
      eventHandlers['connect']?.();

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      wsClient.subscribe('test:event', handler1);
      wsClient.subscribe('test:event', handler2);

      const eventData = { type: 'test:event', description: 'Test' };
      eventHandlers['test:event']?.(eventData);

      expect(handler1).toHaveBeenCalledWith(eventData);
      expect(handler2).toHaveBeenCalledWith(eventData);
    });

    it('should unsubscribe from events', () => {
      wsClient.connect('ws://localhost:8080/ws');
      eventHandlers['connect']?.();

      const handler = vi.fn();
      wsClient.subscribe('test:event', handler);
      wsClient.unsubscribe('test:event', handler);

      const eventData = { type: 'test:event', description: 'Test' };
      eventHandlers['test:event']?.(eventData);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should clean up event handlers on disconnect', () => {
      wsClient.connect('ws://localhost:8080/ws');
      eventHandlers['connect']?.();

      const handler = vi.fn();
      wsClient.subscribe('test:event', handler);

      wsClient.disconnect();

      expect(mockSocket.off).toHaveBeenCalledWith('test:event');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed event data gracefully', () => {
      wsClient.connect('ws://localhost:8080/ws');
      eventHandlers['connect']?.();

      const handler = vi.fn();
      wsClient.subscribe('test:event', handler);

      // Send malformed data (missing required fields)
      const badEvent = { type: 'test:event' }; // missing description
      eventHandlers['test:event']?.(badEvent);

      // Should still call handler
      expect(handler).toHaveBeenCalledWith(badEvent);

      // Should not crash, but may not add to store due to validation
      // eventStore will handle validation
    });

    it('should handle connection error with meaningful message', () => {
      wsClient.connect('ws://localhost:8080/ws');

      const error = new Error('Network error');
      eventHandlers['connect_error']?.(error);

      const state = useEventStore.getState();
      expect(state.connectionError).toBe('Network error');
    });

    it('should handle generic error events', () => {
      wsClient.connect('ws://localhost:8080/ws');

      const error = new Error('Socket error');
      eventHandlers['error']?.(error);

      const state = useEventStore.getState();
      expect(state.connectionError).toBe('Socket error');
    });
  });
});
