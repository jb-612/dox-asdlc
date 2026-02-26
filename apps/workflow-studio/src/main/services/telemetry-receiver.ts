import http from 'http';
import { EventEmitter } from 'events';
import type { TelemetryEvent } from '../../shared/types/monitoring';

export type TelemetryEventCallback = (event: TelemetryEvent) => void;

export class TelemetryReceiver extends EventEmitter {
  private server: http.Server;
  private port: number;
  private _running = false;
  onEvent: TelemetryEventCallback;

  get running(): boolean {
    return this._running;
  }

  constructor(port = 9292, onEvent: TelemetryEventCallback = () => {}) {
    super();
    this.port = port;
    this.onEvent = onEvent;
    this.server = http.createServer(this._handleRequest.bind(this));
    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[TelemetryReceiver] Port ${this.port} in use — telemetry receiver unavailable`);
        this.emit('unavailable', err);
      } else {
        this.emit('error', err);
      }
    });
  }

  private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const { method, url } = req;

    if (method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (method === 'POST' && url === '/telemetry') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        let event: TelemetryEvent;
        try {
          event = JSON.parse(body) as TelemetryEvent;
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed JSON' }));
          return;
        }

        if (!event.id || !event.sessionId || !event.type || !event.timestamp) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: id, sessionId, type, timestamp' }));
          return;
        }

        this.onEvent(event);
        res.writeHead(202);
        res.end();
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  start(): Promise<void> {
    if (this._running) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, '127.0.0.1', () => {
        this.server.removeListener('error', reject);
        this._running = true;
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    if (!this._running) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this._running = false;
          resolve();
        }
      });
    });
  }
}
