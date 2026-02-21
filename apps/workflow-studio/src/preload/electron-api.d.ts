import type { AppSettings } from '../shared/types/settings';
import type { CLISession, CLISpawnConfig } from '../shared/types/cli';
import type { WorkflowDefinition } from '../shared/types/workflow';
import type { WorkItemReference } from '../shared/types/workitem';

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  version?: string;
  updatedAt: string;
  nodeCount: number;
  tags?: string[];
}

export interface ElectronAPI {
  workflow: {
    list: () => Promise<WorkflowSummary[]>;
    load: (id: string) => Promise<WorkflowDefinition | null>;
    save: (workflow: WorkflowDefinition) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
  };

  execution: {
    start: (config: {
      workflowId: string;
      workflow?: WorkflowDefinition;
      workItem?: WorkItemReference;
      variables?: Record<string, unknown>;
    }) => Promise<{ success: boolean; executionId?: string; error?: string }>;
    pause: () => Promise<{ success: boolean; error?: string }>;
    resume: () => Promise<{ success: boolean; error?: string }>;
    abort: () => Promise<{ success: boolean; executionId?: string; error?: string }>;
    gateDecision: (decision: {
      executionId: string;
      gateId: string;
      nodeId: string;
      selectedOption: string;
      decidedBy: string;
      reason?: string;
    }) => Promise<{ success: boolean; error?: string }>;
  };

  workitem: {
    list: (type: string) => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
  };

  cli: {
    spawn: (config: CLISpawnConfig) => Promise<{ success: boolean; sessionId?: string; pid?: number; error?: string }>;
    kill: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
    list: () => Promise<CLISession[]>;
    write: (sessionId: string, data: string) => Promise<{ success: boolean; error?: string }>;
  };

  settings: {
    load: () => Promise<AppSettings>;
    save: (settings: Partial<AppSettings>) => Promise<{ success: boolean; error?: string }>;
  };

  dialog: {
    openDirectory: () => Promise<string | null>;
  };

  onEvent: (channel: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
