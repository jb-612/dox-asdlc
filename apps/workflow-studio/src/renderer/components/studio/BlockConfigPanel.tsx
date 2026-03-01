import { useWorkflowStore } from '../../stores/workflowStore';
import { PromptHarnessEditor } from './PromptHarnessEditor';
import { AgentBackendSelector, type AgentBackend } from './AgentBackendSelector';
import { NODE_TYPE_METADATA, BLOCK_TYPE_METADATA } from '../../../shared/constants';
import { useSettingsStore } from '../../stores/settingsStore';
import type { AgentNode, BlockType } from '../../../shared/types/workflow';

const inputStyle = {
  width: '100%',
  fontSize: 12,
  color: '#e5e7eb',
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: 4,
  padding: '6px 8px',
  boxSizing: 'border-box' as const,
};

const labelStyle = {
  display: 'block' as const,
  fontSize: 11,
  fontWeight: 600,
  color: '#9ca3af',
  marginBottom: 4,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const EMPTY_CONDITION = { expression: '', trueBranchNodeId: '', falseBranchNodeId: '' };
const EMPTY_FOREACH = { collectionVariable: '', itemVariable: '', bodyNodeIds: [] as string[] };
const EMPTY_SUBWORKFLOW = { workflowId: '' };

function ConditionConfigSection({ node }: { node: AgentNode }) {
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const cfg = node.config.conditionConfig ?? EMPTY_CONDITION;
  return (
    <div data-testid="condition-config">
      <label style={labelStyle}>Expression</label>
      <input
        style={inputStyle}
        value={cfg.expression}
        onChange={(e) =>
          updateNodeConfig(node.id, {
            conditionConfig: { ...cfg, expression: e.target.value },
          })
        }
      />
    </div>
  );
}

function ForEachConfigSection({ node }: { node: AgentNode }) {
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const cfg = node.config.forEachConfig ?? EMPTY_FOREACH;
  return (
    <div data-testid="foreach-config" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label style={labelStyle}>Collection Variable</label>
        <input
          style={inputStyle}
          value={cfg.collectionVariable}
          onChange={(e) =>
            updateNodeConfig(node.id, {
              forEachConfig: { ...cfg, collectionVariable: e.target.value },
            })
          }
        />
      </div>
      <div>
        <label style={labelStyle}>Item Variable</label>
        <input
          style={inputStyle}
          value={cfg.itemVariable}
          onChange={(e) =>
            updateNodeConfig(node.id, {
              forEachConfig: { ...cfg, itemVariable: e.target.value },
            })
          }
        />
      </div>
    </div>
  );
}

function SubWorkflowConfigSection({ node }: { node: AgentNode }) {
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const cfg = node.config.subWorkflowConfig ?? EMPTY_SUBWORKFLOW;
  return (
    <div data-testid="subworkflow-config">
      <label style={labelStyle}>Workflow ID</label>
      <input
        style={inputStyle}
        value={cfg.workflowId}
        onChange={(e) =>
          updateNodeConfig(node.id, {
            subWorkflowConfig: { ...cfg, workflowId: e.target.value },
          })
        }
      />
    </div>
  );
}

function isControlFlowNode(node: AgentNode): boolean {
  return node.kind === 'control' && !!node.config.blockType;
}

function renderControlFlowConfig(node: AgentNode): JSX.Element | null {
  switch (node.config.blockType) {
    case 'condition':
      return <ConditionConfigSection node={node} />;
    case 'forEach':
      return <ForEachConfigSection node={node} />;
    case 'subWorkflow':
      return <SubWorkflowConfigSection node={node} />;
    default:
      return null;
  }
}

export function BlockConfigPanel(): JSX.Element {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const workflow = useWorkflowStore((s) => s.workflow);
  const setNodeSystemPromptPrefix = useWorkflowStore((s) => s.setNodeSystemPromptPrefix);
  const setNodeOutputChecklist = useWorkflowStore((s) => s.setNodeOutputChecklist);
  const setNodeBackend = useWorkflowStore((s) => s.setNodeBackend);
  const settings = useSettingsStore((s) => s.settings);

  const selectedNode = workflow?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  if (!selectedNode) {
    return (
      <div
        data-testid="block-config-panel"
        style={{
          width: 280,
          backgroundColor: '#111827',
          borderLeft: '1px solid #374151',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <p style={{ fontSize: 12, color: '#4b5563', textAlign: 'center' }}>
          Select a block on the canvas to configure it
        </p>
      </div>
    );
  }

  const blockType = selectedNode.config.blockType as BlockType | undefined;
  const blockMeta = blockType ? BLOCK_TYPE_METADATA[blockType] : undefined;
  const nodeMeta = NODE_TYPE_METADATA[selectedNode.type];
  const displayLabel = blockMeta?.label ?? nodeMeta.label;

  // Determine current model from settings
  const currentBackend = selectedNode.config.backend ?? 'claude';
  let modelInfo = '';
  if (currentBackend === 'claude') {
    modelInfo = settings.providers?.anthropic?.defaultModel ?? 'claude-sonnet-4-6';
  } else if (currentBackend === 'codex') {
    modelInfo = settings.providers?.openai?.defaultModel ?? 'gpt-4o';
  } else if (currentBackend === 'cursor') {
    modelInfo = selectedNode.config.model ?? 'cursor default';
  }

  return (
    <div
      data-testid="block-config-panel"
      style={{
        width: 280,
        backgroundColor: '#111827',
        borderLeft: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 12px 8px',
          borderBottom: '1px solid #374151',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: nodeMeta.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: nodeMeta.color,
              }}
            />
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', margin: 0 }}>
              {selectedNode.label}
            </h3>
            <p style={{ fontSize: 10, color: '#6b7280', margin: '2px 0 0' }}>
              {displayLabel} · {selectedNode.type}
            </p>
          </div>
        </div>
      </div>

      {/* Config Sections */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isControlFlowNode(selectedNode) ? (
          renderControlFlowConfig(selectedNode)
        ) : (
          <>
            {/* Prompt Harness */}
            <PromptHarnessEditor
              systemPromptPrefix={selectedNode.config.systemPromptPrefix ?? ''}
              outputChecklist={selectedNode.config.outputChecklist ?? []}
              onPrefixChange={(prefix) => setNodeSystemPromptPrefix(selectedNode.id, prefix)}
              onChecklistChange={(checklist) => setNodeOutputChecklist(selectedNode.id, checklist)}
            />

            {/* Backend Selector */}
            <AgentBackendSelector
              value={currentBackend as AgentBackend}
              onChange={(backend) => setNodeBackend(selectedNode.id, backend)}
            />

            {/* Model Info (read-only) */}
            <div>
              <label style={labelStyle}>Model</label>
              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  padding: '6px 8px',
                  backgroundColor: '#1f2937',
                  borderRadius: 4,
                  border: '1px solid #374151',
                }}
              >
                {modelInfo}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
