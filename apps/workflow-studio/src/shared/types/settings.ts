export interface AppSettings {
  workflowDirectory: string;
  templateDirectory: string;
  autoSaveIntervalSeconds: number;
  cliDefaultCwd: string;
  redisUrl: string;
  cursorAgentUrl: string;
  executionMockMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  workflowDirectory: '',
  templateDirectory: '',
  autoSaveIntervalSeconds: 30,
  cliDefaultCwd: '',
  redisUrl: 'redis://localhost:6379',
  cursorAgentUrl: 'http://localhost:8090',
  executionMockMode: true,
};
