import { useCallback } from 'react';
import type { WorkflowDefinition } from '../../../shared/types/workflow';
import { NODE_TYPE_METADATA } from '../../../shared/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateCardProps {
  workflow: WorkflowDefinition;
  onUse: (workflow: WorkflowDefinition) => void;
  onDelete: (workflowId: string) => void;
}

// ---------------------------------------------------------------------------
// Mini preview -- colored dots representing nodes, no full React Flow
// ---------------------------------------------------------------------------

function MiniPreview({ workflow }: { workflow: WorkflowDefinition }): JSX.Element {
  const nodes = workflow.nodes.slice(0, 12); // limit to 12 dots

  return (
    <div className="h-16 bg-gray-900/50 rounded border border-gray-700/50 flex items-center justify-center gap-1.5 px-3 overflow-hidden">
      {nodes.length === 0 ? (
        <span className="text-[10px] text-gray-600">Empty</span>
      ) : (
        nodes.map((node) => {
          const meta = NODE_TYPE_METADATA[node.type];
          return (
            <div
              key={node.id}
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: meta?.color ?? '#6B7280' }}
              title={node.label}
            />
          );
        })
      )}
      {workflow.nodes.length > 12 && (
        <span className="text-[10px] text-gray-500 ml-1">
          +{workflow.nodes.length - 12}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card for displaying a workflow template in the template manager.
 *
 * Shows: name, description, tag badges, node/gate count, small static
 * preview (colored dots), and action buttons (Use, Delete).
 */
export default function TemplateCard({
  workflow,
  onUse,
  onDelete,
}: TemplateCardProps): JSX.Element {
  const { metadata, nodes, gates } = workflow;

  const handleUse = useCallback(() => {
    onUse(workflow);
  }, [onUse, workflow]);

  const handleDelete = useCallback(() => {
    onDelete(workflow.id);
  }, [onDelete, workflow.id]);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-500 transition-colors">
      {/* Preview */}
      <div className="p-3">
        <MiniPreview workflow={workflow} />
      </div>

      {/* Content */}
      <div className="px-4 pb-2">
        <h3 className="text-sm font-semibold text-gray-100 truncate">
          {metadata.name}
        </h3>
        {metadata.description && (
          <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed">
            {metadata.description}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="px-4 py-2 flex items-center gap-3">
        <span className="text-[10px] text-gray-500">
          {nodes.length} node{nodes.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] text-gray-500">
          {gates.length} gate{gates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tags */}
      {metadata.tags.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {metadata.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-700 flex items-center gap-2">
        <button
          type="button"
          onClick={handleUse}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          Use Template
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="px-3 py-1.5 text-xs font-medium rounded text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
