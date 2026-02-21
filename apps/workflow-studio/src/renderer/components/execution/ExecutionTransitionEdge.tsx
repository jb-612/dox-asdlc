import { memo } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from 'reactflow';
import type { TransitionCondition } from '../../../shared/types/workflow';

// ---------------------------------------------------------------------------
// Data shape
// ---------------------------------------------------------------------------

export interface ExecutionTransitionEdgeData {
  condition: TransitionCondition;
  label?: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ExecutionTransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<ExecutionTransitionEdgeData>): JSX.Element {
  const label = data?.label ?? '';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      {/* Invisible wider path for easier click targeting */}
      <path
        id={`${id}-hit`}
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
      />

      {/* Visible edge path -- style comes from the parent buildEdges logic */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        markerEnd={markerEnd}
        style={style}
        className="transition-all duration-300"
      />

      {/* Edge label at midpoint */}
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute pointer-events-none text-[10px] font-medium px-1.5 py-0.5 rounded border bg-gray-800/90 text-gray-300 border-gray-600"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(ExecutionTransitionEdge);
