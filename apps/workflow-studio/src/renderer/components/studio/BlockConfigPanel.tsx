import { useWorkflowStore } from '../../stores/workflowStore';
import { PromptHarnessEditor } from './PromptHarnessEditor';
import { AgentBackendSelector, type AgentBackend } from './AgentBackendSelector';
import { NODE_TYPE_METADATA } from '../../../shared/constants';
import { useSettingsStore } from '../../stores/settingsStore';

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

  const nodeMeta = NODE_TYPE_METADATA[selectedNode.type];

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
              {nodeMeta.label} · {selectedNode.type}
            </p>
          </div>
        </div>
      </div>

      {/* Config Sections */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: '#9ca3af',
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Model
          </label>
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
      </div>
    </div>
  );
}
