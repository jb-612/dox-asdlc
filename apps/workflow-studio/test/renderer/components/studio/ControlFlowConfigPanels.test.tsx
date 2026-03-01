import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { AgentNode, WorkflowDefinition } from '../../../../src/shared/types/workflow';

// --- Zustand store mock ---
const mockWorkflow: WorkflowDefinition = {
  id: 'wf-test',
  metadata: { name: 'Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
  nodes: [],
  transitions: [],
  gates: [],
  variables: [],
};

let mockSelectedNodeId: string | null = null;

vi.mock('../../../../src/renderer/stores/workflowStore', () => ({
  useWorkflowStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      selectedNodeId: mockSelectedNodeId,
      workflow: mockWorkflow,
      setNodeSystemPromptPrefix: vi.fn(),
      setNodeOutputChecklist: vi.fn(),
      setNodeBackend: vi.fn(),
      updateNodeConfig: vi.fn(),
    };
    return selector(state);
  },
}));

vi.mock('../../../../src/renderer/stores/settingsStore', () => ({
  useSettingsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ settings: { providers: {} }, getConfiguredProviders: () => ['claude'] }),
}));

import { BlockConfigPanel } from '../../../../src/renderer/components/studio/BlockConfigPanel';

function setSelectedNode(node: AgentNode) {
  mockSelectedNodeId = node.id;
  mockWorkflow.nodes = [node];
}

describe('Control-flow config panels', () => {
  beforeEach(() => {
    mockSelectedNodeId = null;
    mockWorkflow.nodes = [];
  });

  it('renders condition config panel when condition node selected', () => {
    setSelectedNode({
      id: 'cond-1',
      type: 'backend',
      kind: 'control',
      label: 'Check Status',
      config: {
        blockType: 'condition',
        conditionConfig: { expression: 'status == "ok"', trueBranchNodeId: 'a', falseBranchNodeId: 'b' },
      },
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
    });
    render(<BlockConfigPanel />);
    expect(screen.getByTestId('condition-config')).toBeInTheDocument();
    expect(screen.getByDisplayValue('status == "ok"')).toBeInTheDocument();
  });

  it('renders forEach config panel when forEach node selected', () => {
    setSelectedNode({
      id: 'fe-1',
      type: 'backend',
      kind: 'control',
      label: 'Loop Items',
      config: {
        blockType: 'forEach',
        forEachConfig: { collectionVariable: 'items', itemVariable: 'item', bodyNodeIds: [] },
      },
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
    });
    render(<BlockConfigPanel />);
    expect(screen.getByTestId('foreach-config')).toBeInTheDocument();
    expect(screen.getByDisplayValue('items')).toBeInTheDocument();
  });

  it('renders subWorkflow config panel when subWorkflow node selected', () => {
    setSelectedNode({
      id: 'sw-1',
      type: 'backend',
      kind: 'control',
      label: 'Sub Flow',
      config: {
        blockType: 'subWorkflow',
        subWorkflowConfig: { workflowId: 'wf-child' },
      },
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
    });
    render(<BlockConfigPanel />);
    expect(screen.getByTestId('subworkflow-config')).toBeInTheDocument();
    expect(screen.getByDisplayValue('wf-child')).toBeInTheDocument();
  });
});
