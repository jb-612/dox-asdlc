import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export interface ConditionNodeData {
  expression: string;
  trueBranchLabel?: string;
  falseBranchLabel?: string;
}

const MAX_EXPR_LENGTH = 40;

function ConditionNodeComponent({ data, selected }: NodeProps<ConditionNodeData>) {
  const truncated =
    data.expression.length > MAX_EXPR_LENGTH
      ? data.expression.slice(0, MAX_EXPR_LENGTH - 1) + '\u2026'
      : data.expression;

  return (
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <Handle type="target" position={Position.Top} />

      {/* Diamond shape */}
      <div
        data-testid="condition-diamond"
        style={{
          width: 100,
          height: 100,
          margin: '10px auto',
          transform: 'rotate(45deg)',
          backgroundColor: selected ? '#7C3AED' : '#4C1D95',
          border: selected ? '2px solid #A78BFA' : '2px solid #6D28D9',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          data-testid="condition-expression"
          style={{
            transform: 'rotate(-45deg)',
            fontSize: 10,
            color: '#E5E7EB',
            textAlign: 'center',
            padding: 4,
            maxWidth: 80,
            wordBreak: 'break-word',
            lineHeight: 1.2,
          }}
        >
          {truncated}
        </div>
      </div>

      {/* True/False labels */}
      <div style={{ position: 'absolute', left: -24, bottom: 10, fontSize: 9, color: '#22C55E' }}>
        {data.trueBranchLabel ?? 'T'}
      </div>
      <div style={{ position: 'absolute', right: -24, bottom: 10, fontSize: 9, color: '#EF4444' }}>
        {data.falseBranchLabel ?? 'F'}
      </div>

      <Handle type="source" position={Position.Left} id="true" />
      <Handle type="source" position={Position.Right} id="false" />
    </div>
  );
}

export default memo(ConditionNodeComponent);
