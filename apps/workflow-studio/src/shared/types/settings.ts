export interface AppSettings {
  workflowDirectory: string;
  templateDirectory: string;
  autoSaveIntervalSeconds: number;
  cliDefaultCwd: string;
  redisUrl: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  workflowDirectory: '',
  templateDirectory: '',
  autoSaveIntervalSeconds: 30,
  cliDefaultCwd: '',
  redisUrl: 'redis://localhost:6379',
};
