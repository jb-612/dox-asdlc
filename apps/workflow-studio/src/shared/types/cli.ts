export type CLISessionStatus = 'starting' | 'running' | 'exited' | 'error';

export interface CLISpawnConfig {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  instanceId?: string;
}

export interface CLISession {
  id: string;
  config: CLISpawnConfig;
  status: CLISessionStatus;
  pid?: number;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number;
}
