// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T15: E2E integration test
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import http from 'http';
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
  id: 'wf-e2e',
  metadata: { name: 'E2E Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
  nodes: [
    { id: 'n1', type: 'backend' as const, label: 'Build', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
    { id: 'n2', type: 'backend' as const, label: 'Test', config: {}, inputs: [], outputs: [], position: { x: 100, y: 0 } },
  ],
  transitions: [{ id: 't1', from: 'n1', to: 'n2', condition: '' }],
  gates: [],
  variables: [{ name: 'DEPLOY_TARGET', type: 'string', defaultValue: 'staging' }],
};

function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

describe('F17-T15: CI/CD E2E Integration', { timeout: 30000 }, () => {
  let tmpDir: string;
  let wfPath: string;

  beforeEach(() => {
    uuidCounter = 0;
    tmpDir = mkdtempSync(join(tmpdir(), 'dox-e2e-'));
    wfPath = join(tmpDir, 'wf-e2e.json');
    writeFileSync(wfPath, JSON.stringify(sampleWorkflow));
  });

  it('mock workflow run via CLI outputs NDJSON', async () => {
    const { Writable } = await import('stream');
    const chunks: string[] = [];
    const stdout = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk.toString()); cb(); },
    });

    // Temporarily replace process.stdout
    const origStdout = process.stdout;
    Object.defineProperty(process, 'stdout', { value: stdout, writable: true });

    try {
      const { runHeadless } = await import('../../src/cli/run');
      const code = await runHeadless({
        workflowPath: wfPath,
        mock: true,
        json: true,
        gateMode: 'auto',
        variables: {},
      });

      expect(code).toBe(0);
      expect(chunks.length).toBeGreaterThan(0);

      // All lines should be valid NDJSON
      for (const chunk of chunks) {
        for (const line of chunk.trim().split('\n')) {
          const parsed = JSON.parse(line);
          expect(parsed.channel).toBeDefined();
        }
      }
    } finally {
      Object.defineProperty(process, 'stdout', { value: origStdout, writable: true });
    }
  });

  it('webhook trigger with valid HMAC returns 200', async () => {
    const { createWebhookServer } = await import('../../src/cli/webhook-server');
    const SECRET = 'e2e-secret';
    const port = 19480 + Math.floor(Math.random() * 1000);
    const server = createWebhookServer({
      port,
      secret: SECRET,
      workflowDir: tmpDir,
      mockMode: true,
    });

    await server.start();

    try {
      const body = JSON.stringify({ workflow: 'wf-e2e' });
      const sig = sign(body, SECRET);

      const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: '/webhook',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hub-signature-256': sig,
          },
        }, (response) => {
          let data = '';
          response.on('data', (chunk) => { data += chunk; });
          response.on('end', () => resolve({ status: response.statusCode!, body: data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.status).toBe('started');
    } finally {
      await server.stop();
    }
  });

  it('GHA export passes basic validation', async () => {
    const { runExport } = await import('../../src/cli/export');
    const outPath = join(tmpDir, 'workflow.yml');

    const code = await runExport({
      workflowPath: wfPath,
      format: 'gha',
      outPath,
    });

    expect(code).toBe(0);
    const content = readFileSync(outPath, 'utf-8');
    expect(content).toContain('name: E2E Test');
    expect(content).toContain('jobs:');
    expect(content).toContain('steps:');
    expect(content).toContain('Build');
    expect(content).toContain('Test');
  });

  it('DOX_VAR_ injected into workflow', async () => {
    const { collectEnvVars } = await import('../../src/cli/arg-parser');

    const saved = process.env['DOX_VAR_DEPLOY_TARGET'];
    process.env['DOX_VAR_DEPLOY_TARGET'] = 'production';

    try {
      const vars = collectEnvVars();
      expect(vars['DEPLOY_TARGET']).toBe('production');
    } finally {
      if (saved === undefined) delete process.env['DOX_VAR_DEPLOY_TARGET'];
      else process.env['DOX_VAR_DEPLOY_TARGET'] = saved;
    }
  });
});
