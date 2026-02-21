import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { WorkflowDefinitionSchema } from '../schemas/workflow-schema';
import type { WorkflowDefinition } from '../../shared/types/workflow';

// ---------------------------------------------------------------------------
// In-memory store of workflows for development (replaced by file I/O later)
// ---------------------------------------------------------------------------

const workflows: Map<string, WorkflowDefinition> = new Map();

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

  workflows.set(sampleWorkflow.id, sampleWorkflow);

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

  workflows.set(minimalWorkflow.id, minimalWorkflow);
}

// Seed on module load
seedSampleWorkflows();

// ---------------------------------------------------------------------------
// IPC handler registration
// ---------------------------------------------------------------------------

export function registerWorkflowHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WORKFLOW_LIST, async () => {
    return Array.from(workflows.values()).map((w) => ({
      id: w.id,
      name: w.metadata.name,
      description: w.metadata.description,
      version: w.metadata.version,
      updatedAt: w.metadata.updatedAt,
      nodeCount: w.nodes.length,
      tags: w.metadata.tags,
    }));
  });

  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_LOAD,
    async (_event, id: string) => {
      const workflow = workflows.get(id);
      return workflow ?? null;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_SAVE,
    async (_event, raw: unknown) => {
      const result = WorkflowDefinitionSchema.safeParse(raw);
      if (!result.success) {
        return {
          success: false,
          errors: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        };
      }

      const workflow = result.data as WorkflowDefinition;
      workflow.metadata.updatedAt = new Date().toISOString();
      workflows.set(workflow.id, workflow);

      return { success: true, id: workflow.id };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_DELETE,
    async (_event, id: string) => {
      const existed = workflows.delete(id);
      return { success: existed };
    },
  );
}
