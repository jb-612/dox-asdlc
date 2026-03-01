/** Abstraction over BrowserWindow for headless execution (P15-F17). */
export interface EngineHost {
  send(channel: string, ...args: unknown[]): void;
}

export type GateMode = 'auto' | 'fail';

export interface HeadlessRunConfig {
  workflowPath: string;
  mock: boolean;
  json: boolean;
  gateMode: GateMode;
  variables: Record<string, string>;
  repoPath?: string;
  workflowDir?: string;
}
