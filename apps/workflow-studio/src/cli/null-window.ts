import type { Writable } from 'stream';
import type { EngineHost } from './types';

export interface NullWindowOptions {
  json: boolean;
  stdout?: Writable;
  stderr?: Writable;
}

export class NullWindow implements EngineHost {
  private readonly json: boolean;
  private readonly stdout: Writable;
  private readonly stderr: Writable;

  constructor(options: NullWindowOptions) {
    this.json = options.json;
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
  }

  send(channel: string, ...args: unknown[]): void {
    if (this.json) {
      const line = JSON.stringify({ channel, data: args[0] ?? null });
      this.stdout.write(line + '\n');
    } else {
      const msg = args.length > 0 ? JSON.stringify(args[0]) : '';
      this.stderr.write(`[${channel}] ${msg}\n`);
    }
  }
}
