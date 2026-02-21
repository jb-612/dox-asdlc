import { io, Socket } from 'socket.io-client';
import { useEventStore } from '@/stores/eventStore';

/**
 * Type for event handler functions
 */
type EventHandler = (data: unknown) => void;

/**
 * WebSocket client for real-time event streaming from the orchestrator.
 *
 * Features:
 * - Automatic reconnection with exponential backoff (built-in via socket.io)
 * - Automatic fallback to polling if WebSocket unavailable
 * - Event subscription with multiple handlers per event type
 * - Integration with eventStore for connection state and events
 *
 * Edge Cases Documented:
 * 1. Connection during page load: Safe to call connect() at any time
 * 2. Multiple disconnect calls: Idempotent - only disconnects if connected
 * 3. Event handler memory leaks: Always call unsubscribe in component cleanup
 * 4. Server-side event format changes: Forward events as-is; store handles validation
 * 5. Network switch (WiFi to cellular): socket.io handles reconnection automatically
 * 6. Browser tab backgrounding: No special handling needed; socket.io maintains connection
 * 7. CORS issues: Ensure WebSocket endpoint allows CORS for the UI origin
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Connect to WebSocket server.
   *
   * @param url - WebSocket server URL (e.g., "ws://orchestrator:8080/ws")
   *
   * Edge case: Safe to call multiple times; will disconnect existing connection first.
   */
  connect(url: string): void {
    // Disconnect existing connection if any
    if (this.socket) {
      this.disconnect();
    }

    // Initialize socket.io client
    this.socket = io(url, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: ['websocket', 'polling'], // Fallback to polling if WebSocket fails
      autoConnect: false, // Manual connection control
    });

    // Setup connection event handlers
    this.setupConnectionHandlers();

    // Manually trigger connection
    this.socket.connect();
  }

  /**
   * Disconnect from WebSocket server.
   *
   * Edge case: Idempotent - safe to call multiple times.
   */
  disconnect(): void {
    if (!this.socket) {
      return;
    }

    // Clean up all event subscriptions
    this.eventHandlers.forEach((_, eventType) => {
      this.socket?.off(eventType);
    });
    this.eventHandlers.clear();

    // Disconnect socket
    this.socket.disconnect();
    this.socket = null;

    // Update store state
    useEventStore.getState().setConnected(false);
    useEventStore.getState().setReconnecting(false);
  }

  /**
   * Subscribe to a specific event type.
   *
   * @param eventType - Event type to subscribe to (e.g., "agent:completed")
   * @param handler - Handler function to call when event is received
   *
   * Edge case: Handler will be called for ALL events of this type.
   * Make sure to unsubscribe in component cleanup to prevent memory leaks.
   */
  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.socket) {
      console.warn(`Cannot subscribe to ${eventType}: not connected`);
      return;
    }

    // Track handler
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());

      // Register socket.io listener (only once per event type)
      this.socket.on(eventType, (data: unknown) => {
        this.handleEvent(eventType, data);
      });
    }

    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Unsubscribe from a specific event type.
   *
   * @param eventType - Event type to unsubscribe from
   * @param handler - Handler function to remove
   *
   * Edge case: If this was the last handler for this event type,
   * the socket.io listener is NOT removed (for simplicity).
   * This is acceptable as socket.io listeners have minimal overhead.
   */
  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Check if connected to server.
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get current reconnection attempt count.
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Setup connection lifecycle handlers.
   */
  private setupConnectionHandlers(): void {
    if (!this.socket) {
      return;
    }

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      useEventStore.getState().setConnected(true);
    });

    this.socket.on('disconnect', (_reason: string) => {
      useEventStore.getState().setConnected(false);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[WebSocket] Connection error:', error.message);
      useEventStore.getState().setConnectionError(error.message);
    });

    this.socket.on('error', (error: Error) => {
      console.error('[WebSocket] Error:', error.message);
      useEventStore.getState().setConnectionError(error.message);
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      this.reconnectAttempts = attemptNumber;
      useEventStore.getState().setReconnecting(true);
    });

    this.socket.on('reconnect', (_attemptNumber: number) => {
      this.reconnectAttempts = 0;
      useEventStore.getState().setConnected(true);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[WebSocket] Reconnection failed after max attempts');
      useEventStore
        .getState()
        .setConnectionError('Failed to reconnect after maximum attempts');
    });
  }

  /**
   * Handle incoming event from server.
   *
   * Forwards event to all registered handlers and adds to eventStore.
   *
   * @param eventType - Event type
   * @param data - Event data from server
   */
  private handleEvent(eventType: string, data: unknown): void {
    // Forward to all handlers for this event type
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }

    // Add to eventStore if data is valid
    // Edge case: Server may send events with different formats
    // We forward as-is and let the store handle validation
    if (
      data &&
      typeof data === 'object' &&
      'type' in data &&
      'description' in data
    ) {
      useEventStore.getState().addEvent(
        data as {
          type: string;
          description: string;
          epicId?: string;
          agentType?: string;
          runId?: string;
          metadata?: Record<string, unknown>;
        }
      );
    }
  }
}

// Export singleton instance
export const wsClient = new WebSocketClient();
