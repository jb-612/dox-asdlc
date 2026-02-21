import { memo } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from 'reactflow';
import type { TransitionCondition } from '../../../shared/types/workflow';

export interface TransitionEdgeData {
  condition: TransitionCondition;
  label?: string;
}

/**
 * Resolve the SVG stroke-dasharray for each condition type.
 *   always     -> solid line
 *   on_success -> dashed (6 4)
 *   on_failure -> dashed (6 4)
 *   expression -> dotted (2 4)
 */
function dashArrayForCondition(type: TransitionCondition['type']): string | undefined {
  switch (type) {
    case 'always':
      return undefined; // solid
    case 'on_success':
    case 'on_failure':
      return '6 4';
    case 'expression':
      return '2 4';
    default:
      return undefined;
  }
}

/**
 * Pick a color hint per condition type so success/failure are visually distinct.
 */
function colorForCondition(type: TransitionCondition['type']): string {
  switch (type) {
    case 'on_success':
      return '#10B981'; // green
    case 'on_failure':
      return '#EF4444'; // red
    case 'expression':
      return '#A78BFA'; // purple
    case 'always':
    default:
      return '#6B7280'; // gray
  }
}

function TransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<TransitionEdgeData>): JSX.Element {
  const condition = data?.condition ?? { type: 'always' as const };
  const label = data?.label ?? '';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const strokeColor = selected ? '#3B82F6' : colorForCondition(condition.type);
  const dashArray = dashArrayForCondition(condition.type);

  return (
    <>
      {/* Invisible wider path for easier click targeting */}
      <path
        id={`${id}-hit`}
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
      />

      {/* Visible edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={dashArray}
        markerEnd={markerEnd}
        className="transition-all duration-150 hover:!stroke-blue-400 cursor-pointer"
      />

      {/* Edge label at midpoint */}
      {label && (
        <EdgeLabelRenderer>
          <div
            className={`
              absolute pointer-events-auto cursor-pointer
              text-[10px] font-medium px-1.5 py-0.5 rounded
              border transition-colors
              ${selected
                ? 'bg-blue-900/80 text-blue-200 border-blue-500'
                : 'bg-gray-800/90 text-gray-300 border-gray-600 hover:border-blue-400'
              }
            `}
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

export default memo(TransitionEdge);
