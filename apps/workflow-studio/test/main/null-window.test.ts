// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T02: NullWindow adapter
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { Writable } from 'stream';

describe('F17-T02: NullWindow', { timeout: 30000 }, () => {
  it('NDJSON mode writes JSON lines to stdout stream', async () => {
    const { NullWindow } = await import('../../src/cli/null-window');
    const chunks: string[] = [];
    const stdout = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk.toString()); cb(); },
    });

    const nw = new NullWindow({ json: true, stdout });
    nw.send('execution:event', { type: 'node_started', nodeId: 'n1' });

    expect(chunks.length).toBe(1);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed.channel).toBe('execution:event');
    expect(parsed.data.type).toBe('node_started');
  });

  it('human-readable mode writes to stderr stream', async () => {
    const { NullWindow } = await import('../../src/cli/null-window');
    const chunks: string[] = [];
    const stderr = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk.toString()); cb(); },
    });

    const nw = new NullWindow({ json: false, stderr });
    nw.send('execution:state-update', { status: 'running' });

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('execution:state-update');
  });

  it('does not throw on any channel', async () => {
    const { NullWindow } = await import('../../src/cli/null-window');
    const nw = new NullWindow({ json: false });

    expect(() => nw.send('unknown:channel', 'data')).not.toThrow();
    expect(() => nw.send('execution:event')).not.toThrow();
  });
});
