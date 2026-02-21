import { useState, useMemo, type DragEvent } from 'react';
import type { AgentNodeType } from '../../../shared/types/workflow';
import {
  NODE_TYPE_METADATA,
  NODE_CATEGORIES,
  type NodeCategory,
} from '../../../shared/constants';

/**
 * Human-readable labels for each category section.
 */
const CATEGORY_LABELS: Record<NodeCategory, string> = {
  discovery: 'Discovery',
  design: 'Design',
  development: 'Development',
  validation: 'Validation',
  deployment: 'Deployment',
  governance: 'Governance',
};

/**
 * Group agent types by their category from NODE_TYPE_METADATA.
 */
function groupByCategory(): Map<NodeCategory, { type: AgentNodeType; label: string; color: string; description: string }[]> {
  const groups = new Map<NodeCategory, { type: AgentNodeType; label: string; color: string; description: string }[]>();
  for (const cat of NODE_CATEGORIES) {
    groups.set(cat, []);
  }

  const entries = Object.entries(NODE_TYPE_METADATA) as [AgentNodeType, typeof NODE_TYPE_METADATA[AgentNodeType]][];
  for (const [agentType, meta] of entries) {
    const list = groups.get(meta.category);
    if (list) {
      list.push({
        type: agentType,
        label: meta.label,
        color: meta.color,
        description: meta.description,
      });
    }
  }

  return groups;
}

interface PaletteItemProps {
  agentType: string;
  label: string;
  color: string;
  description: string;
  nodeKind: 'agent' | 'gate';
}

function PaletteItem({ agentType, label, color, description, nodeKind }: PaletteItemProps): JSX.Element {
  function handleDragStart(event: DragEvent<HTMLDivElement>): void {
    const payload = JSON.stringify({ nodeKind, agentType });
    event.dataTransfer.setData('application/reactflow', payload);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-gray-700/50 transition-colors group"
    >
      {/* Color dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/10"
        style={{ backgroundColor: color }}
      />
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-gray-200 group-hover:text-white block truncate">
          {label}
        </span>
        <span className="text-[10px] text-gray-500 group-hover:text-gray-400 block truncate">
          {description}
        </span>
      </div>
    </div>
  );
}

export default function AgentNodePalette(): JSX.Element {
  const [filter, setFilter] = useState('');
  const grouped = useMemo(() => groupByCategory(), []);

  const lowerFilter = filter.toLowerCase().trim();

  return (
    <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col h-full select-none">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-700">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Node Palette
        </h3>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search nodes..."
          className="w-full text-xs bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
        />
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* Agent type categories */}
        {NODE_CATEGORIES.map((category) => {
          const items = grouped.get(category) ?? [];
          const filtered = lowerFilter
            ? items.filter(
                (item) =>
                  item.label.toLowerCase().includes(lowerFilter) ||
                  item.description.toLowerCase().includes(lowerFilter) ||
                  item.type.toLowerCase().includes(lowerFilter),
              )
            : items;

          if (filtered.length === 0) return null;

          return (
            <div key={category}>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1">
                {CATEGORY_LABELS[category]}
              </h4>
              <div className="space-y-0.5">
                {filtered.map((item) => (
                  <PaletteItem
                    key={item.type}
                    agentType={item.type}
                    label={item.label}
                    color={item.color}
                    description={item.description}
                    nodeKind="agent"
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Control Flow section for Gate nodes */}
        {(!lowerFilter || 'gate'.includes(lowerFilter) || 'hitl'.includes(lowerFilter) || 'control'.includes(lowerFilter)) && (
          <div>
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1">
              Control Flow
            </h4>
            <div className="space-y-0.5">
              <PaletteItem
                agentType="approval"
                label="HITL Gate"
                color="#F59E0B"
                description="Human-in-the-loop gate"
                nodeKind="gate"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
