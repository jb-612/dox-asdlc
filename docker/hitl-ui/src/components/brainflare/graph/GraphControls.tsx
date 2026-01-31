/**
 * GraphControls - Control panel for Snowflake Graph (P08-F06)
 *
 * Provides:
 * - Search filter for nodes
 * - Edge type toggles (similar, related, contradicts)
 * - Reset view button
 * - Refresh button
 * - Stats display and legend
 */

import React from 'react';
import { useGraphViewStore } from '../../../stores/graphViewStore';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import type { CorrelationType } from '../../../types/graph';

export interface GraphControlsProps {
  className?: string;
  onRefresh?: () => void;
}

const CORRELATION_TYPE_LABELS: Record<CorrelationType, { label: string; color: string }> = {
  similar: { label: 'Similar', color: 'bg-green-500' },
  related: { label: 'Related', color: 'bg-gray-500' },
  contradicts: { label: 'Contradicts', color: 'bg-red-500' },
};

/**
 * GraphControls component
 */
export function GraphControls({ className, onRefresh }: GraphControlsProps) {
  const { filters, setFilters, resetView, nodes, edges } = useGraphViewStore();

  const toggleCorrelationType = (type: CorrelationType) => {
    const current = filters.correlationTypes;
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    // Don't allow empty filter - at least one must be selected
    setFilters({ correlationTypes: updated.length > 0 ? updated : current });
  };

  return (
    <div className={`p-4 space-y-4 ${className}`} data-testid="graph-controls">
      <h3 className="font-medium text-text-primary">Graph Controls</h3>

      {/* Stats */}
      <div className="text-sm text-text-muted">
        {nodes.length} nodes, {edges.length} edges
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          placeholder="Search nodes..."
          value={filters.searchQuery}
          onChange={(e) => setFilters({ searchQuery: e.target.value })}
          className="w-full pl-9 pr-3 py-2 border border-border-primary rounded-lg text-sm bg-bg-primary text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          data-testid="graph-search-input"
        />
      </div>

      {/* Edge Type Filters */}
      <div>
        <div className="text-sm font-medium text-text-secondary mb-2">Edge Types</div>
        <div className="space-y-2">
          {(
            Object.entries(CORRELATION_TYPE_LABELS) as [
              CorrelationType,
              { label: string; color: string },
            ][]
          ).map(([type, { label, color }]) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.correlationTypes.includes(type)}
                onChange={() => toggleCorrelationType(type)}
                className="rounded border-border-primary text-blue-600 focus:ring-blue-500"
                data-testid={`edge-type-${type}`}
              />
              <span className={`w-3 h-3 rounded-full ${color}`} />
              <span className="text-sm text-text-secondary">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={resetView}
          className="flex-1 px-3 py-2 text-sm text-text-secondary border border-border-primary rounded-lg hover:bg-bg-secondary transition-colors"
          data-testid="reset-view-button"
        >
          Reset View
        </button>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-3 py-2 text-text-secondary border border-border-primary rounded-lg hover:bg-bg-secondary transition-colors"
            title="Refresh graph"
            data-testid="refresh-button"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-border-primary">
        <div className="text-sm font-medium text-text-secondary mb-2">Node Colors</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-text-muted">Functional</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-text-muted">Non-Functional</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-text-muted">Undetermined</span>
          </div>
        </div>
      </div>
    </div>
  );
}
