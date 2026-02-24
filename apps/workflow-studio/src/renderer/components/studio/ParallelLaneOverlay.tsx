import { useWorkflowStore } from '../../stores/workflowStore';
import type { ParallelGroup, AgentNode } from '../../../shared/types/workflow';

/** Colors assigned to parallel group lanes (cycled). */
const LANE_COLORS = [
  'rgba(59, 130, 246, 0.08)',  // blue
  'rgba(16, 185, 129, 0.08)',  // green
  'rgba(245, 158, 11, 0.08)',  // amber
  'rgba(139, 92, 246, 0.08)',  // violet
  'rgba(239, 68, 68, 0.08)',   // red
];

const LANE_BORDER_COLORS = [
  'rgba(59, 130, 246, 0.3)',
  'rgba(16, 185, 129, 0.3)',
  'rgba(245, 158, 11, 0.3)',
  'rgba(139, 92, 246, 0.3)',
  'rgba(239, 68, 68, 0.3)',
];

interface LaneRect {
  group: ParallelGroup;
  x: number;
  y: number;
  width: number;
  height: number;
  colorIndex: number;
}

function computeLaneRects(
  groups: ParallelGroup[],
  nodes: AgentNode[],
): LaneRect[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const rects: LaneRect[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupNodes = group.laneNodeIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is AgentNode => n != null);

    if (groupNodes.length === 0) continue;

    const padding = 20;
    const minX = Math.min(...groupNodes.map((n) => n.position.x)) - padding;
    const minY = Math.min(...groupNodes.map((n) => n.position.y)) - padding;
    const maxX = Math.max(...groupNodes.map((n) => n.position.x)) + 180 + padding; // ~node width
    const maxY = Math.max(...groupNodes.map((n) => n.position.y)) + 60 + padding; // ~node height

    rects.push({
      group,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      colorIndex: i % LANE_COLORS.length,
    });
  }

  return rects;
}

export function ParallelLaneOverlay(): JSX.Element {
  const parallelGroups = useWorkflowStore((s) => s.workflow?.parallelGroups ?? []);
  const nodes = useWorkflowStore((s) => s.workflow?.nodes ?? []);

  const lanes = computeLaneRects(parallelGroups, nodes);

  if (lanes.length === 0) return <></>;

  return (
    <div
      data-testid="parallel-lane-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {lanes.map((lane) => (
        <div
          key={lane.group.id}
          style={{
            position: 'absolute',
            left: lane.x,
            top: lane.y,
            width: lane.width,
            height: lane.height,
            backgroundColor: LANE_COLORS[lane.colorIndex],
            border: `1px dashed ${LANE_BORDER_COLORS[lane.colorIndex]}`,
            borderRadius: 8,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 4,
              left: 8,
              fontSize: 10,
              color: LANE_BORDER_COLORS[lane.colorIndex],
              fontWeight: 600,
            }}
          >
            {lane.group.label}
          </span>
        </div>
      ))}
    </div>
  );
}
