import { BrowserWindow } from 'electron';
import Redis from 'ioredis';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

// ---------------------------------------------------------------------------
// RedisEventClient
//
// Manages a Redis connection for subscribing to event streams. Uses XREAD
// in a blocking loop to consume stream entries and forward them to the
// Electron renderer process via IPC. Handles connection errors and provides
// graceful disconnect with automatic loop termination.
// ---------------------------------------------------------------------------

export interface RedisEventClientOptions {
  url: string;
  mainWindow: BrowserWindow;
}

export interface RedisStreamEvent {
  streamKey: string;
  id: string;
  fields: Record<string, string>;
}

export class RedisEventClient {
  private redis: Redis | null = null;
  private mainWindow: BrowserWindow;
  private url: string;
  private connected = false;
  private stopped = false;

  constructor(options: RedisEventClientOptions) {
    this.url = options.url;
    this.mainWindow = options.mainWindow;
  }

  /**
   * Create the Redis connection. Registers error and reconnect handlers.
   */
  async connect(): Promise<void> {
    this.stopped = false;

    this.redis = new Redis(this.url, {
      retryStrategy(times: number) {
        // Exponential backoff: min 100ms, max 30s
        const delay = Math.min(times * 100, 30000);
        return delay;
      },
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });

    this.redis.on('error', (err: Error) => {
      console.error('[RedisEventClient] Connection error:', err.message);
    });

    this.redis.on('reconnecting', () => {
      console.log('[RedisEventClient] Reconnecting...');
    });

    this.connected = true;
  }

  /**
   * Subscribe to a Redis stream using XREAD in a blocking loop.
   *
   * Events are forwarded to the renderer via the REDIS_EVENT IPC channel.
   * The loop runs until disconnect() is called.
   *
   * @param streamKey - The Redis stream key to subscribe to.
   * @param startId - The starting stream ID (default: '$' for new entries only).
   */
  async subscribe(streamKey: string, startId = '$'): Promise<void> {
    if (!this.redis) {
      throw new Error('Not connected. Call connect() first.');
    }

    let lastId = startId;

    while (!this.stopped) {
      try {
        const result = await this.redis.xread(
          'BLOCK',
          2000,   // Block for 2 seconds
          'COUNT',
          10,     // Read up to 10 entries at a time
          'STREAMS',
          streamKey,
          lastId,
        );

        if (this.stopped) break;
        if (!result) {
          // Yield to the event loop to prevent a tight spin when XREAD
          // returns null (e.g. BLOCK timeout expired or in mock mode).
          await new Promise((r) => setTimeout(r, 0));
          continue;
        }

        for (const [, entries] of result as [string, [string, string[]][]][]) {
          for (const [entryId, fieldValues] of entries) {
            lastId = entryId;

            // Convert flat field-value array to object
            const fields: Record<string, string> = {};
            for (let i = 0; i < fieldValues.length; i += 2) {
              fields[fieldValues[i]] = fieldValues[i + 1];
            }

            const event: RedisStreamEvent = {
              streamKey,
              id: entryId,
              fields,
            };

            this.mainWindow.webContents.send(IPC_CHANNELS.REDIS_EVENT, event);
          }
        }
      } catch (err) {
        if (this.stopped) break;
        console.error('[RedisEventClient] XREAD error:', err);
        // Wait before retrying to avoid tight error loops
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  /**
   * Gracefully close the Redis connection and stop any active subscriptions.
   */
  async disconnect(): Promise<void> {
    this.stopped = true;
    this.connected = false;

    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // Connection may already be closed
      }
      this.redis = null;
    }
  }

  /**
   * Whether the client is currently connected.
   */
  get isConnected(): boolean {
    return this.connected;
  }
}
