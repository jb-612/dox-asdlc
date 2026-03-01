import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export interface SubWorkflowNodeData {
  workflowName: string;
  mappingCount?: number;
}

function SubWorkflowNodeComponent({ data, selected }: NodeProps<SubWorkflowNodeData>) {
  return (
    <div
      style={{
        width: 160,
        backgroundColor: selected ? '#1C2D1C' : '#1E293B',
        border: selected ? '2px solid #22C55E' : '2px solid #334155',
        borderRadius: 8,
        padding: 8,
      }}
    >
      <Handle type="target" position={Position.Top} />

      {/* Header with icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span data-testid="subworkflow-icon" style={{ fontSize: 14 }}>&#x2397;</span>
        <span style={{ fontSize: 11, color: '#86EFAC', fontWeight: 600 }}>SubWorkflow</span>
        {data.mappingCount != null && data.mappingCount > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              backgroundColor: '#22C55E',
              color: '#fff',
              fontSize: 10,
              borderRadius: 10,
              padding: '1px 6px',
              fontWeight: 600,
            }}
          >
            {data.mappingCount}
          </span>
        )}
      </div>

      {/* Workflow name */}
      <div style={{ fontSize: 11, color: '#D1D5DB' }}>
        {data.workflowName}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(SubWorkflowNodeComponent);
