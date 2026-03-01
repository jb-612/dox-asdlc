// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T09: Webhook HTTP server
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { join } from 'path';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { createHmac } from 'crypto';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `uuid-${++uuidCounter}`,
}));

const sampleWorkflow: WorkflowDefinition = {
  id: 'wf-webhook',
  metadata: { name: 'Webhook Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
  nodes: [
    { id: 'n1', type: 'backend' as const, label: 'Step 1', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
  ],
  transitions: [],
  gates: [],
  variables: [],
};

function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function post(port: number, path: string, body: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, body: data }));
    }).on('error', reject);
  });
}

describe('F17-T09: Webhook server', { timeout: 30000 }, () => {
  let tmpDir: string;
  let wfPath: string;
  const SECRET = 'test-webhook-secret';

  beforeEach(() => {
    uuidCounter = 0;
    tmpDir = mkdtempSync(join(tmpdir(), 'dox-webhook-'));
    wfPath = join(tmpDir, 'wf-webhook.json');
    writeFileSync(wfPath, JSON.stringify(sampleWorkflow));
  });

  it('starts on port and handles POST', async () => {
    const { createWebhookServer } = await import('../../src/cli/webhook-server');
    const port = 19480 + Math.floor(Math.random() * 1000);
    const server = createWebhookServer({
      port,
      secret: SECRET,
      workflowDir: tmpDir,
      mockMode: true,
    });

    try {
      await server.start();

      const body = JSON.stringify({ workflow: 'wf-webhook' });
      const sig = sign(body, SECRET);
      const res = await post(port, '/webhook', body, {
        'x-hub-signature-256': sig,
      });

      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.status).toBe('started');
    } finally {
      await server.stop();
    }
  });

  it('401 on bad HMAC', async () => {
    const { createWebhookServer } = await import('../../src/cli/webhook-server');
    const port = 19480 + Math.floor(Math.random() * 1000);
    const server = createWebhookServer({
      port,
      secret: SECRET,
      workflowDir: tmpDir,
      mockMode: true,
    });

    try {
      await server.start();

      const body = JSON.stringify({ workflow: 'wf-webhook' });
      const res = await post(port, '/webhook', body, {
        'x-hub-signature-256': 'sha256=invalid',
      });

      expect(res.status).toBe(401);
    } finally {
      await server.stop();
    }
  });

  it('404 unknown workflow', async () => {
    const { createWebhookServer } = await import('../../src/cli/webhook-server');
    const port = 19480 + Math.floor(Math.random() * 1000);
    const server = createWebhookServer({
      port,
      secret: SECRET,
      workflowDir: tmpDir,
      mockMode: true,
    });

    try {
      await server.start();

      const body = JSON.stringify({ workflow: 'nonexistent' });
      const sig = sign(body, SECRET);
      const res = await post(port, '/webhook', body, {
        'x-hub-signature-256': sig,
      });

      expect(res.status).toBe(404);
    } finally {
      await server.stop();
    }
  });

  it('405 non-POST', async () => {
    const { createWebhookServer } = await import('../../src/cli/webhook-server');
    const port = 19480 + Math.floor(Math.random() * 1000);
    const server = createWebhookServer({
      port,
      secret: SECRET,
      workflowDir: tmpDir,
      mockMode: true,
    });

    try {
      await server.start();
      const res = await get(port, '/webhook');
      expect(res.status).toBe(405);
    } finally {
      await server.stop();
    }
  });
});
