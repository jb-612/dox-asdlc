import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { GateType, GateOption } from '../../../shared/types/workflow';

export interface GateNodeData {
  gateType: GateType;
  prompt: string;
  options: GateOption[];
  required: boolean;
}

const GATE_TYPE_LABELS: Record<GateType, string> = {
  approval: 'Approval',
  review: 'Review',
  decision: 'Decision',
  confirmation: 'Confirmation',
};

function GateNodeComponent({ data, selected }: NodeProps<GateNodeData>): JSX.Element {
  const truncatedPrompt =
    data.prompt.length > 60 ? `${data.prompt.slice(0, 57)}...` : data.prompt;

  return (
    <div className="relative flex items-center justify-center w-[140px] h-[140px]">
      {/* Diamond shape via rotated inner square */}
      <div
        className={`
          absolute w-[100px] h-[100px] rotate-45 border-2 border-dashed rounded-sm
          transition-all duration-150
          ${selected
            ? 'border-blue-500 ring-2 ring-blue-500/40 bg-amber-900/30'
            : 'border-amber-500/60 bg-amber-900/20'
          }
        `}
      />

      {/* Content (not rotated) */}
      <div className="relative z-10 flex flex-col items-center text-center px-2 max-w-[120px]">
        {/* Gate type badge */}
        <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 mb-1">
          {GATE_TYPE_LABELS[data.gateType]}
        </span>

        {/* Required indicator */}
        {data.required && (
          <span className="text-[9px] text-red-400 font-medium mb-0.5">
            Required
          </span>
        )}

        {/* Prompt preview */}
        <p className="text-[10px] text-gray-300 leading-tight line-clamp-2">
          {truncatedPrompt}
        </p>
      </div>

      {/* Input handle at top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-gray-800 hover:!bg-amber-300 transition-colors"
      />

      {/* Output handle at bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-gray-800 hover:!bg-amber-300 transition-colors"
      />
    </div>
  );
}

export default memo(GateNodeComponent);
