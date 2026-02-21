import React, { useCallback, useMemo } from 'react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { NODE_TYPE_METADATA } from '../../../shared/constants';

const MODEL_OPTIONS = ['default', 'sonnet', 'opus', 'haiku'] as const;

/**
 * Form for editing the properties of a selected AgentNode.
 * Renders in the PropertiesPanel when a node is selected.
 */
export function NodePropertiesForm(): JSX.Element | null {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const workflow = useWorkflowStore((s) => s.workflow);
  const updateNode = useWorkflowStore((s) => s.updateNode);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  const node = useMemo(
    () => workflow?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [workflow?.nodes, selectedNodeId],
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!node) return;
      updateNode(node.id, { label: e.target.value });
    },
    [node, updateNode],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!node) return;
      updateNode(node.id, { description: e.target.value });
    },
    [node, updateNode],
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!node) return;
      const value = e.target.value;
      updateNodeConfig(node.id, {
        model: value === 'default' ? undefined : value,
      });
    },
    [node, updateNodeConfig],
  );

  const handleMaxTurnsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!node) return;
      const raw = e.target.value;
      const parsed = parseInt(raw, 10);
      updateNodeConfig(node.id, {
        maxTurns: raw === '' ? undefined : isNaN(parsed) ? undefined : parsed,
      });
    },
    [node, updateNodeConfig],
  );

  const handleSystemPromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!node) return;
      updateNodeConfig(node.id, {
        systemPrompt: e.target.value || undefined,
      });
    },
    [node, updateNodeConfig],
  );

  const handleRemove = useCallback(() => {
    if (!node) return;
    removeNode(node.id);
  }, [node, removeNode]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!node) return null;

  const meta = NODE_TYPE_METADATA[node.type];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Node Properties
      </h3>

      {/* Agent type badge (read-only) */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Agent Type
        </label>
        <span
          className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: meta.bgColor,
            color: meta.color,
            border: `1px solid ${meta.color}40`,
          }}
        >
          {meta.label}
        </span>
        <span className="text-xs text-gray-500 ml-2">{meta.category}</span>
      </div>

      {/* Label */}
      <div>
        <label
          htmlFor="node-label"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          Label
        </label>
        <input
          id="node-label"
          type="text"
          value={node.label}
          onChange={handleLabelChange}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="node-description"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          Description
        </label>
        <textarea
          id="node-description"
          rows={2}
          value={node.description ?? ''}
          onChange={handleDescriptionChange}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>

      {/* Model */}
      <div>
        <label
          htmlFor="node-model"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          Model
        </label>
        <select
          id="node-model"
          value={node.config.model ?? 'default'}
          onChange={handleModelChange}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Max turns */}
      <div>
        <label
          htmlFor="node-max-turns"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          Max Turns
        </label>
        <input
          id="node-max-turns"
          type="number"
          min={1}
          value={node.config.maxTurns ?? ''}
          onChange={handleMaxTurnsChange}
          placeholder="unlimited"
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* System prompt */}
      <div>
        <label
          htmlFor="node-system-prompt"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          System Prompt
        </label>
        <textarea
          id="node-system-prompt"
          rows={4}
          value={node.config.systemPrompt ?? ''}
          onChange={handleSystemPromptChange}
          placeholder="Optional system prompt override..."
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 font-mono text-xs focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>

      {/* Position (read-only) */}
      <div className="pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          Position:{' '}
          <span className="font-mono text-gray-400">
            ({Math.round(node.position.x)}, {Math.round(node.position.y)})
          </span>
        </p>
        <p className="text-xs text-gray-500">
          ID: <span className="font-mono text-gray-400">{node.id}</span>
        </p>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={handleRemove}
        className="w-full mt-2 bg-red-600/20 text-red-400 border border-red-600/40 rounded px-3 py-1.5 text-sm font-medium hover:bg-red-600/30 transition-colors"
      >
        Delete Node
      </button>
    </div>
  );
}
