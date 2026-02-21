import { useWorkflowStore } from '../../stores/workflowStore';
import { WorkflowPropertiesForm } from './WorkflowPropertiesForm';
import { NodePropertiesForm } from './NodePropertiesForm';
import { EdgePropertiesForm } from './EdgePropertiesForm';

/**
 * Right sidebar panel that renders the appropriate properties form based on the
 * current selection state:
 *
 *  - Node selected   -> NodePropertiesForm
 *  - Edge selected   -> EdgePropertiesForm
 *  - Nothing selected -> WorkflowPropertiesForm (top-level metadata)
 */
export function PropertiesPanel(): JSX.Element {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const workflow = useWorkflowStore((s) => s.workflow);

  return (
    <aside className="w-[300px] min-w-[300px] bg-gray-800 border-l border-gray-700 overflow-y-auto">
      <div className="p-4">
        {!workflow ? (
          <div className="text-center text-gray-500 text-sm pt-8">
            <p>No workflow loaded.</p>
            <p className="mt-1 text-xs">
              Create or open a workflow to see properties.
            </p>
          </div>
        ) : selectedNodeId ? (
          <NodePropertiesForm />
        ) : selectedEdgeId ? (
          <EdgePropertiesForm />
        ) : (
          <WorkflowPropertiesForm />
        )}
      </div>
    </aside>
  );
}
