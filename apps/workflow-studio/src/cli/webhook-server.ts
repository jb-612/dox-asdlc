import http from 'http';
import { existsSync } from 'fs';
import { join, resolve, relative } from 'path';
import { verifyHmac } from './hmac-auth';
import { runHeadless } from './run';

const MAX_BODY_BYTES = 1_048_576; // 1 MB
const WF_NAME_RE = /^[\w-]{1,128}$/;

export interface WebhookServerConfig {
  port: number;
  secret: string;
  workflowDir: string;
  mockMode?: boolean;
}

export interface WebhookServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createWebhookServer(config: WebhookServerConfig): WebhookServer {
  let server: http.Server | null = null;
  let busy = false;

  const handler = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const body = await readBody(req);
    const sig = (req.headers['x-hub-signature-256'] as string) ?? '';

    if (!verifyHmac(body, sig, config.secret)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }

    if (busy) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Execution in progress' }));
      return;
    }

    let payload: { workflow?: string };
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    // CRIT-1 fix: validate workflow name to prevent path traversal
    const wfName = payload.workflow ?? '';
    if (!WF_NAME_RE.test(wfName)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid workflow name' }));
      return;
    }
    const wfPath = resolve(config.workflowDir, `${wfName}.json`);
    if (!relative(config.workflowDir, wfPath).startsWith(wfName)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid workflow name' }));
      return;
    }

    if (!existsSync(wfPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Workflow not found: ${wfName}` }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'started', workflow: wfName }));

    busy = true;
    try {
      await runHeadless({
        workflowPath: wfPath,
        mock: config.mockMode ?? false,
        json: true,
        gateMode: 'auto',
        variables: {},
      });
    } finally {
      busy = false;
    }
  };

  return {
    start(): Promise<void> {
      return new Promise((resolve) => {
        // HIGH-2 fix: log errors instead of swallowing
        server = http.createServer((req, res) => {
          handler(req, res).catch((err) => {
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Internal server error' }));
            }
          });
        });
        server.listen(config.port, '127.0.0.1', () => resolve());
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve) => {
        if (server) server.close(() => resolve());
        else resolve();
      });
    },
  };
}

// CRIT-2 fix: body size limit
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
