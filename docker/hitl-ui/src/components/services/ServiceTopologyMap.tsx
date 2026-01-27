/**
 * ServiceTopologyMap - Visual topology diagram of aSDLC services
 *
 * T14: SVG-based service topology showing 5 services and their connections
 *
 * Layout:
 *        [HITL-UI]
 *            |
 *            v
 *     [Orchestrator]
 *            |
 *      +-----+-----+
 *      v           v
 *  [Workers]   [Redis]
 *            \   /
 *             v v
 *     [Elasticsearch]
 */

import { useMemo, useCallback } from 'react';
import clsx from 'clsx';
import type { ServiceHealthInfo, ServiceConnection, ServiceHealthStatus } from '../../api/types/services';

// ============================================================================
// Types
// ============================================================================

export interface ServiceTopologyMapProps {
  /** Array of service health information */
  services: ServiceHealthInfo[];
  /** Array of connections between services */
  connections: ServiceConnection[];
  /** Click handler for service nodes */
  onServiceClick?: (serviceName: string) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Show legend for connection types */
  showLegend?: boolean;
  /** Custom class name */
  className?: string;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Constants
// ============================================================================

const VIEWBOX_WIDTH = 400;
const VIEWBOX_HEIGHT = 320;

// Fixed positions for the 5 aSDLC services
const SERVICE_POSITIONS: Record<string, NodePosition> = {
  'hitl-ui': { x: 200, y: 30, width: 80, height: 36 },
  'orchestrator': { x: 200, y: 100, width: 100, height: 36 },
  'workers': { x: 100, y: 180, width: 80, height: 36 },
  'redis': { x: 300, y: 180, width: 60, height: 36 },
  'elasticsearch': { x: 200, y: 260, width: 110, height: 36 },
};

// Color mapping for health status
const STATUS_COLORS: Record<ServiceHealthStatus, string> = {
  healthy: '#22C55E',   // green-500
  degraded: '#F59E0B',  // amber-500
  unhealthy: '#EF4444', // red-500
};

// Color mapping for connection types
const CONNECTION_COLORS: Record<string, string> = {
  http: '#3B82F6',          // blue-500
  redis: '#EF4444',         // red-500
  elasticsearch: '#EAB308', // yellow-500
};

// ============================================================================
// Helper Components
// ============================================================================

interface ServiceNodeProps {
  service: ServiceHealthInfo;
  position: NodePosition;
  isClickable: boolean;
  onClick?: () => void;
}

function ServiceNode({ service, position, isClickable, onClick }: ServiceNodeProps) {
  const fillColor = STATUS_COLORS[service.status];
  const { x, y, width, height } = position;

  return (
    <g
      className={clsx(
        'transition-opacity duration-200',
        isClickable && 'cursor-pointer hover:opacity-80'
      )}
      onClick={onClick}
      data-testid={`service-node-${service.name}`}
    >
      {/* Node rectangle with rounded corners */}
      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={fillColor}
        stroke={fillColor}
        strokeWidth={2}
        className="transition-all duration-200"
      />
      {/* Service name label */}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white text-xs font-medium pointer-events-none"
        style={{ fontSize: '11px' }}
      >
        {service.name}
      </text>
    </g>
  );
}

interface ConnectionLineProps {
  connection: ServiceConnection;
  fromPos: NodePosition;
  toPos: NodePosition;
}

function ConnectionLine({ connection, fromPos, toPos }: ConnectionLineProps) {
  const color = CONNECTION_COLORS[connection.type] || CONNECTION_COLORS.http;

  // Calculate line start/end points (from bottom of source to top of target)
  const startX = fromPos.x;
  const startY = fromPos.y + fromPos.height / 2;
  const endX = toPos.x;
  const endY = toPos.y - toPos.height / 2;

  // Create a curved path for better visual appeal
  const midY = (startY + endY) / 2;
  const pathD = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;

  return (
    <path
      d={pathD}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeDasharray={connection.type === 'http' ? 'none' : '5,3'}
      className="transition-colors duration-200"
      markerEnd="url(#arrowhead)"
      data-testid={`connection-${connection.from}-${connection.to}`}
    />
  );
}

interface LegendProps {
  className?: string;
}

function Legend({ className }: LegendProps) {
  const items = [
    { label: 'HTTP', color: CONNECTION_COLORS.http, dashed: false },
    { label: 'Redis', color: CONNECTION_COLORS.redis, dashed: true },
    { label: 'Elasticsearch', color: CONNECTION_COLORS.elasticsearch, dashed: true },
  ];

  return (
    <div
      className={clsx('flex flex-wrap gap-4 text-xs text-text-secondary', className)}
      data-testid="topology-legend"
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <svg width="24" height="12">
            <line
              x1="0"
              y1="6"
              x2="24"
              y2="6"
              stroke={item.color}
              strokeWidth={2}
              strokeDasharray={item.dashed ? '5,3' : 'none'}
            />
          </svg>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ServiceTopologyMap({
  services,
  connections,
  onServiceClick,
  isLoading = false,
  showLegend = false,
  className,
}: ServiceTopologyMapProps) {
  // Create a map of service name to health info (used for quick lookup by name)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _serviceMap = useMemo(() => {
    const map = new Map<string, ServiceHealthInfo>();
    services.forEach((service) => {
      map.set(service.name, service);
    });
    return map;
  }, [services]);

  // Handle service click
  const handleServiceClick = useCallback(
    (serviceName: string) => {
      onServiceClick?.(serviceName);
    },
    [onServiceClick]
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('relative', className)}
        data-testid="topology-container"
      >
        <div
          className="w-full aspect-[400/320] bg-bg-secondary rounded-lg animate-pulse flex items-center justify-center"
          data-testid="topology-loading"
        >
          <span className="text-text-muted text-sm">Loading topology...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (services.length === 0) {
    return (
      <div
        className={clsx('relative', className)}
        data-testid="topology-container"
      >
        <div
          className="w-full aspect-[400/320] bg-bg-secondary rounded-lg flex items-center justify-center"
          data-testid="topology-empty"
        >
          <span className="text-text-muted text-sm">No services available</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('relative', className)}
      data-testid="topology-container"
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label="Service topology map showing aSDLC services and their connections"
        data-testid="topology-map"
      >
        {/* Definitions for arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path
              d="M0,0 L0,6 L6,3 Z"
              className="fill-text-muted"
            />
          </marker>
        </defs>

        {/* Background */}
        <rect
          x="0"
          y="0"
          width={VIEWBOX_WIDTH}
          height={VIEWBOX_HEIGHT}
          className="fill-bg-secondary"
          rx="8"
          ry="8"
        />

        {/* Render connections first (behind nodes) */}
        <g className="connections">
          {connections.map((connection) => {
            const fromPos = SERVICE_POSITIONS[connection.from];
            const toPos = SERVICE_POSITIONS[connection.to];
            if (!fromPos || !toPos) return null;

            return (
              <ConnectionLine
                key={`${connection.from}-${connection.to}`}
                connection={connection}
                fromPos={fromPos}
                toPos={toPos}
              />
            );
          })}
        </g>

        {/* Render service nodes */}
        <g className="nodes">
          {services.map((service) => {
            const position = SERVICE_POSITIONS[service.name];
            if (!position) return null;

            return (
              <ServiceNode
                key={service.name}
                service={service}
                position={position}
                isClickable={!!onServiceClick}
                onClick={
                  onServiceClick
                    ? () => handleServiceClick(service.name)
                    : undefined
                }
              />
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      {showLegend && <Legend className="mt-3" />}
    </div>
  );
}
