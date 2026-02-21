import { registerWorkflowHandlers, seedWorkflow } from './workflow-handlers';
import { registerExecutionHandlers } from './execution-handlers';
import { registerWorkItemHandlers } from './workitem-handlers';
import { registerCLIHandlers } from './cli-handlers';
import { registerSettingsHandlers } from './settings-handlers';
import { registerDialogHandlers } from './dialog-handlers';
import type { CLISpawner } from '../services/cli-spawner';
import type { WorkItemService } from '../services/workitem-service';
import type { WorkflowFileService } from '../services/workflow-file-service';
import type { SettingsService } from '../services/settings-service';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition } from '../../shared/types/workflow';

// ---------------------------------------------------------------------------
// Service container passed from the main process entry point
// ---------------------------------------------------------------------------

export interface IPCServiceDeps {
  cliSpawner: CLISpawner;
  workItemService: WorkItemService;
  workflowFileService: WorkflowFileService;
  settingsService: SettingsService;
}

/**
 * Register all IPC handlers on the main process.
 *
 * Must be called once after app.whenReady() resolves. Each handler module
 * registers its own ipcMain.handle() listeners for the channels defined
 * in shared/ipc-channels.ts.
 */
export function registerAllHandlers(deps: IPCServiceDeps): void {
  registerWorkflowHandlers(deps.workflowFileService);
  registerExecutionHandlers();
  registerWorkItemHandlers(deps.workItemService);
  registerCLIHandlers(deps.cliSpawner);
  registerSettingsHandlers(deps.settingsService);
  registerDialogHandlers();

  // Seed sample workflows so the UI has content on first launch
  seedSampleWorkflows();
}

// ---------------------------------------------------------------------------
// Sample data seeding
// ---------------------------------------------------------------------------

function seedSampleWorkflows(): void {
  const planId = uuidv4();
  const designId = uuidv4();
  const reviewId = uuidv4();
  const codeId = uuidv4();

  const sampleWorkflow: WorkflowDefinition = {
    id: uuidv4(),
    metadata: {
      name: '11-Step Default Workflow',
      description: 'Full aSDLC workflow with all gates',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['default', 'full'],
    },
    nodes: [
      {
        id: planId,
        type: 'planner',
        label: 'Plan',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 250, y: 50 },
        description: 'Create task plans',
      },
      {
        id: designId,
        type: 'architect',
        label: 'Design',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 250, y: 200 },
        description: 'Design system architecture',
      },
      {
        id: reviewId,
        type: 'reviewer',
        label: 'Review',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 250, y: 350 },
        description: 'Review code quality',
      },
      {
        id: codeId,
        type: 'coding',
        label: 'Code',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 250, y: 500 },
        description: 'Write implementation code',
      },
    ],
    transitions: [
      {
        id: uuidv4(),
        sourceNodeId: planId,
        targetNodeId: designId,
        condition: { type: 'always' },
      },
      {
        id: uuidv4(),
        sourceNodeId: designId,
        targetNodeId: reviewId,
        condition: { type: 'always' },
      },
      {
        id: uuidv4(),
        sourceNodeId: reviewId,
        targetNodeId: codeId,
        condition: { type: 'on_success' },
      },
    ],
    gates: [
      {
        id: uuidv4(),
        nodeId: reviewId,
        gateType: 'approval',
        prompt: 'Approve the design review before proceeding to coding?',
        options: [
          { label: 'Approve', value: 'approve', isDefault: true },
          { label: 'Request Changes', value: 'reject' },
        ],
        required: true,
      },
    ],
    variables: [],
  };

  seedWorkflow(sampleWorkflow);

  const minimalWorkflow: WorkflowDefinition = {
    id: uuidv4(),
    metadata: {
      name: 'Minimal TDD Workflow',
      description: 'Test-driven development with coding and unit testing',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['tdd', 'minimal'],
    },
    nodes: [
      {
        id: uuidv4(),
        type: 'utest',
        label: 'Write Tests',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 250, y: 100 },
        description: 'Write unit tests (TDD)',
      },
      {
        id: uuidv4(),
        type: 'coding',
        label: 'Implement',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 250, y: 300 },
        description: 'Write implementation code',
      },
    ],
    transitions: [],
    gates: [],
    variables: [],
  };

  seedWorkflow(minimalWorkflow);
}
