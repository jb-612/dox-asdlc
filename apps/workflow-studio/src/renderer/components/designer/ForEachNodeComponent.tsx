import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export interface ForEachNodeData {
  collectionVariable: string;
  itemVariable: string;
  iterationCount?: number;
}

function ForEachNodeComponent({ data, selected }: NodeProps<ForEachNodeData>) {
  return (
    <div
      style={{
        width: 160,
        backgroundColor: selected ? '#1E3A5F' : '#1E293B',
        border: selected ? '2px solid #3B82F6' : '2px solid #334155',
        borderRadius: 8,
        padding: 8,
      }}
    >
      <Handle type="target" position={Position.Top} />

      {/* Header with loop icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span data-testid="foreach-loop-icon" style={{ fontSize: 14 }}>&#x21BB;</span>
        <span style={{ fontSize: 11, color: '#93C5FD', fontWeight: 600 }}>ForEach</span>
        {data.iterationCount != null && (
          <span
            style={{
              marginLeft: 'auto',
              backgroundColor: '#3B82F6',
              color: '#fff',
              fontSize: 10,
              borderRadius: 10,
              padding: '1px 6px',
              fontWeight: 600,
            }}
          >
            {data.iterationCount}
          </span>
        )}
      </div>

      {/* Collection variable */}
      <div style={{ fontSize: 10, color: '#D1D5DB', marginBottom: 4 }}>
        <span style={{ color: '#9CA3AF' }}>collection:</span> {data.collectionVariable}
      </div>

      {/* Body area */}
      <div
        data-testid="foreach-body"
        style={{
          border: '1px dashed #475569',
          borderRadius: 4,
          padding: 6,
          minHeight: 24,
          fontSize: 9,
          color: '#6B7280',
          textAlign: 'center',
        }}
      >
        {data.itemVariable} &#x2192; body
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(ForEachNodeComponent);
