import { create } from 'zustand';
import { createCoreSlice, type WorkflowCoreSlice } from './workflow/coreSlice';
import { createNodesSlice, type WorkflowNodesSlice } from './workflow/nodesSlice';
import { createStudioSlice, type WorkflowStudioSlice } from './workflow/studioSlice';
import { createHistorySlice, type WorkflowHistorySlice } from './workflow/historySlice';

export type WorkflowState = WorkflowCoreSlice &
  WorkflowNodesSlice &
  WorkflowStudioSlice &
  WorkflowHistorySlice;

export const useWorkflowStore = create<WorkflowState>()((...args) => ({
  ...createCoreSlice(...args),
  ...createNodesSlice(...args),
  ...createStudioSlice(...args),
  ...createHistorySlice(...args),
}));
