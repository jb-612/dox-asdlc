import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { AgentNodeType, AgentNodeConfig } from '../../../shared/types/workflow';
import type { NodeExecutionStatus } from '../../../shared/types/execution';
import { NODE_TYPE_METADATA } from '../../../shared/constants';
import NodeStatusOverlay from './NodeStatusOverlay';

// ---------------------------------------------------------------------------
// Data shape -- extends designer AgentNodeData with execution fields
// ---------------------------------------------------------------------------

export interface ExecutionAgentNodeData {
  type: AgentNodeType;
  label: string;
  config: AgentNodeConfig;
  description?: string;
  executionStatus: NodeExecutionStatus;
  statusClass: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ExecutionAgentNode({ data, selected }: NodeProps<ExecutionAgentNodeData>): JSX.Element {
  const meta = NODE_TYPE_METADATA[data.type];

  return (
    <div
      className={`
        relative w-[180px] rounded-lg bg-gray-800 border overflow-visible shadow-lg
        transition-all duration-150
        ${data.statusClass}
        ${selected ? 'border-blue-500 ring-2 ring-blue-500/40' : 'border-gray-600'}
      `}
    >
      <NodeStatusOverlay status={data.executionStatus} />

      {/* Colored header bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg"
        style={{ backgroundColor: meta.bgColor, borderBottom: `2px solid ${meta.color}` }}
      >
        <div
          className="w-5 h-5 rounded flex-shrink-0"
          style={{ backgroundColor: meta.color }}
        />
        <span className="text-sm font-semibold text-gray-100 truncate">
          {data.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        <span
          className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: meta.bgColor, color: meta.color }}
        >
          {meta.label}
        </span>

        {data.description && (
          <p className="text-[11px] text-gray-400 leading-tight truncate">
            {data.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          {data.config.model && (
            <span className="text-[10px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">
              {data.config.model}
            </span>
          )}
          {data.config.maxTurns != null && (
            <span className="text-[10px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">
              {data.config.maxTurns} turns
            </span>
          )}
          {data.config.timeoutSeconds != null && (
            <span className="text-[10px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">
              {data.config.timeoutSeconds}s
            </span>
          )}
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-500 !border-2 !border-gray-800"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-500 !border-2 !border-gray-800"
      />
    </div>
  );
}

export default memo(ExecutionAgentNode);
