// @vitest-environment node
// ---------------------------------------------------------------------------
// TelemetryReceiver unit tests (P15)
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { TelemetryReceiver } from '../../src/main/services/telemetry-receiver';
import type { TelemetryEvent } from '../../src/shared/types/monitoring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** POST JSON to a running TelemetryReceiver and return status + parsed body */
async function postTelemetry(
  port: number,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/telemetry', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed: unknown;
          try { parsed = JSON.parse(data); } catch { parsed = data || null; }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

/** GET a path from a running TelemetryReceiver */
async function getPath(
  port: number,
  path: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed: unknown;
          try { parsed = JSON.parse(data); } catch { parsed = data || null; }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** Minimal valid telemetry event */
function makeEvent(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    id: 'evt-1',
    sessionId: 'sess-abc',
    type: 'agent_start',
    agentId: 'agent-1',
    timestamp: new Date().toISOString(),
    data: null,
    ...overrides,
  };
}

// Use a fixed test port offset to avoid conflicts with other tests
const BASE_PORT = 19292;
let portCounter = 0;
function nextPort(): number {
  return BASE_PORT + portCounter++;
}

// ---------------------------------------------------------------------------
// TelemetryReceiver tests
// ---------------------------------------------------------------------------

describe('TelemetryReceiver', () => {
  let receiver: TelemetryReceiver;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    receiver = new TelemetryReceiver(port, vi.fn());
    await receiver.start();
  });

  afterEach(async () => {
    await receiver.stop();
  });

  // -------------------------------------------------------------------------
  // Valid POST /telemetry
  // -------------------------------------------------------------------------

  describe('POST /telemetry — valid event', () => {
    it('returns 202 and calls onEvent with the parsed event', async () => {
      const onEvent = vi.fn();
      receiver.onEvent = onEvent;

      const event = makeEvent();
      const { status } = await postTelemetry(port, event);

      expect(status).toBe(202);
      expect(onEvent).toHaveBeenCalledOnce();
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        id: event.id,
        sessionId: event.sessionId,
        type: event.type,
      }));
    });

    it('accepts all valid TelemetryEventType values', async () => {
      const onEvent = vi.fn();
      receiver.onEvent = onEvent;

      const types = [
        'agent_start', 'agent_complete', 'agent_error',
        'tool_call', 'bash_command', 'metric', 'lifecycle', 'token_usage', 'custom',
      ] as const;

      for (const type of types) {
        onEvent.mockClear();
        const { status } = await postTelemetry(port, makeEvent({ type }));
        expect(status).toBe(202);
        expect(onEvent).toHaveBeenCalledOnce();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Malformed JSON
  // -------------------------------------------------------------------------

  describe('POST /telemetry — malformed JSON', () => {
    it('returns 400 with error message for invalid JSON', async () => {
      const { status, body } = await postTelemetry(port, '{ not valid json ');

      expect(status).toBe(400);
      expect(body).toMatchObject({ error: expect.stringContaining('Malformed') });
    });

    it('does not call onEvent when body is malformed', async () => {
      const onEvent = vi.fn();
      receiver.onEvent = onEvent;

      await postTelemetry(port, '<<<broken>>>');

      expect(onEvent).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Missing required fields
  // -------------------------------------------------------------------------

  describe('POST /telemetry — missing required fields', () => {
    it('returns 400 when sessionId is missing', async () => {
      const { id: _id, sessionId: _sid, ...withoutSessionId } = makeEvent();
      const event = { id: 'evt-1', ...withoutSessionId };

      const { status, body } = await postTelemetry(port, event);

      expect(status).toBe(400);
      expect(body).toMatchObject({ error: expect.stringContaining('Missing required fields') });
    });

    it('returns 400 when id is missing', async () => {
      const event = makeEvent();
      const { id: _id, ...withoutId } = event;

      const { status } = await postTelemetry(port, withoutId);

      expect(status).toBe(400);
    });

    it('returns 400 when type is missing', async () => {
      const event = makeEvent();
      const { type: _type, ...withoutType } = event;

      const { status } = await postTelemetry(port, withoutType);

      expect(status).toBe(400);
    });

    it('returns 400 when timestamp is missing', async () => {
      const event = makeEvent();
      const { timestamp: _ts, ...withoutTs } = event;

      const { status } = await postTelemetry(port, withoutTs);

      expect(status).toBe(400);
    });

    it('does not call onEvent when fields are missing', async () => {
      const onEvent = vi.fn();
      receiver.onEvent = onEvent;

      const { sessionId: _sid, ...partial } = makeEvent();
      await postTelemetry(port, partial);

      expect(onEvent).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /health
  // -------------------------------------------------------------------------

  describe('GET /health', () => {
    it('returns 200 with {"status":"ok"}', async () => {
      const { status, body } = await getPath(port, '/health');

      expect(status).toBe(200);
      expect(body).toEqual({ status: 'ok' });
    });
  });

  // -------------------------------------------------------------------------
  // Unknown routes
  // -------------------------------------------------------------------------

  describe('Unknown routes', () => {
    it('GET /foo returns 404', async () => {
      const { status } = await getPath(port, '/foo');

      expect(status).toBe(404);
    });

    it('GET /telemetry returns 404 (only POST accepted)', async () => {
      const { status } = await getPath(port, '/telemetry');

      expect(status).toBe(404);
    });

    it('returns an error body on 404', async () => {
      const { body } = await getPath(port, '/unknown-path');

      expect(body).toMatchObject({ error: expect.any(String) });
    });
  });

  // -------------------------------------------------------------------------
  // stop()
  // -------------------------------------------------------------------------

  describe('stop()', () => {
    it('resolves cleanly after start()', async () => {
      const r = new TelemetryReceiver(nextPort());
      await r.start();
      await expect(r.stop()).resolves.toBeUndefined();
    });
  });
});
