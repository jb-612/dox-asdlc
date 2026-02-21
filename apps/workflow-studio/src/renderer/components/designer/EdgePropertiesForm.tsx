import React, { useCallback, useMemo } from 'react';
import { useWorkflowStore } from '../../stores/workflowStore';
import type { TransitionConditionType } from '../../../shared/types/workflow';

const CONDITION_TYPES: { value: TransitionConditionType; label: string }[] = [
  { value: 'always', label: 'Always' },
  { value: 'on_success', label: 'On Success' },
  { value: 'on_failure', label: 'On Failure' },
  { value: 'expression', label: 'Expression' },
];

/**
 * Form for editing the properties of a selected Transition (edge).
 * Renders in the PropertiesPanel when an edge is selected.
 */
export function EdgePropertiesForm(): JSX.Element | null {
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const workflow = useWorkflowStore((s) => s.workflow);
  const updateEdge = useWorkflowStore((s) => s.updateEdge);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);

  const edge = useMemo(
    () => workflow?.transitions.find((t) => t.id === selectedEdgeId) ?? null,
    [workflow?.transitions, selectedEdgeId],
  );

  const sourceNode = useMemo(
    () => workflow?.nodes.find((n) => n.id === edge?.sourceNodeId) ?? null,
    [workflow?.nodes, edge?.sourceNodeId],
  );

  const targetNode = useMemo(
    () => workflow?.nodes.find((n) => n.id === edge?.targetNodeId) ?? null,
    [workflow?.nodes, edge?.targetNodeId],
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleConditionTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!edge) return;
      const newType = e.target.value as TransitionConditionType;
      updateEdge(edge.id, {
        condition: {
          type: newType,
          expression:
            newType === 'expression' ? edge.condition.expression ?? '' : undefined,
        },
      });
    },
    [edge, updateEdge],
  );

  const handleExpressionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!edge) return;
      updateEdge(edge.id, {
        condition: {
          ...edge.condition,
          expression: e.target.value,
        },
      });
    },
    [edge, updateEdge],
  );

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!edge) return;
      updateEdge(edge.id, { label: e.target.value || undefined });
    },
    [edge, updateEdge],
  );

  const handleRemove = useCallback(() => {
    if (!edge) return;
    removeEdge(edge.id);
  }, [edge, removeEdge]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!edge) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Edge Properties
      </h3>

      {/* Source (read-only) */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Source
        </label>
        <div className="bg-gray-700/50 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-300">
          {sourceNode?.label ?? edge.sourceNodeId}
        </div>
      </div>

      {/* Target (read-only) */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Target
        </label>
        <div className="bg-gray-700/50 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-300">
          {targetNode?.label ?? edge.targetNodeId}
        </div>
      </div>

      {/* Condition type */}
      <div>
        <label
          htmlFor="edge-condition"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          Condition
        </label>
        <select
          id="edge-condition"
          value={edge.condition.type}
          onChange={handleConditionTypeChange}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        >
          {CONDITION_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>
              {ct.label}
            </option>
          ))}
        </select>
      </div>

      {/* Expression (shown only when type === 'expression') */}
      {edge.condition.type === 'expression' && (
        <div>
          <label
            htmlFor="edge-expression"
            className="block text-xs font-medium text-gray-400 mb-1"
          >
            Expression
          </label>
          <input
            id="edge-expression"
            type="text"
            value={edge.condition.expression ?? ''}
            onChange={handleExpressionChange}
            placeholder="e.g. result.status === 'approved'"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Label */}
      <div>
        <label
          htmlFor="edge-label"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          Label
        </label>
        <input
          id="edge-label"
          type="text"
          value={edge.label ?? ''}
          onChange={handleLabelChange}
          placeholder="Optional edge label"
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Read-only info */}
      <div className="pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          ID: <span className="font-mono text-gray-400">{edge.id}</span>
        </p>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={handleRemove}
        className="w-full mt-2 bg-red-600/20 text-red-400 border border-red-600/40 rounded px-3 py-1.5 text-sm font-medium hover:bg-red-600/30 transition-colors"
      >
        Delete Edge
      </button>
    </div>
  );
}
