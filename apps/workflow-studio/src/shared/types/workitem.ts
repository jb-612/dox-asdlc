export type WorkItemType = 'prd' | 'issue' | 'idea' | 'manual';

export type WorkItemSource = 'filesystem' | 'github' | 'manual';

export interface WorkItemReference {
  id: string;
  type: WorkItemType;
  source: WorkItemSource;
  title: string;
  description?: string;
  path?: string;
  url?: string;
  labels?: string[];
}

export interface WorkItem extends WorkItemReference {
  content: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}
