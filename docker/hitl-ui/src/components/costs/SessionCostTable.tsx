import { useState, useMemo, Fragment } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Card, { CardHeader, CardTitle, CardContent } from '../common/Card';
import { useSessionCosts } from '../../api/costs';
import type { CostRecord } from '../../types/costs';

interface SessionCostTableProps {
  records: CostRecord[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

type SortField = 'session_id' | 'agent_id' | 'model' | 'input_tokens' | 'output_tokens' | 'estimated_cost_usd' | 'timestamp';
type SortDir = 'asc' | 'desc';

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function ExpandedRow({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useSessionCosts(sessionId);

  if (isLoading) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3 bg-bg-tertiary/50">
          <div className="animate-pulse h-4 bg-bg-tertiary rounded w-48" />
        </td>
      </tr>
    );
  }

  if (!data) return null;

  return (
    <tr>
      <td colSpan={7} className="px-4 py-3 bg-bg-tertiary/50">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="text-text-secondary font-medium mb-2">Model Breakdown</h4>
            {data.model_breakdown.map((m, i) => (
              <div key={m.model ?? i} className="flex justify-between text-text-tertiary py-0.5">
                <span>{m.model ?? 'unknown'}</span>
                <span>${m.cost_usd.toFixed(4)}</span>
              </div>
            ))}
          </div>
          <div>
            <h4 className="text-text-secondary font-medium mb-2">Tool Breakdown</h4>
            {data.tool_breakdown.map((t, i) => (
              <div key={t.tool_name ?? i} className="flex justify-between text-text-tertiary py-0.5">
                <span>{t.tool_name ?? 'unknown'} ({t.call_count}x)</span>
                <span>${t.total_cost_usd.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function SessionCostTable({
  records,
  total,
  page,
  pageSize,
  onPageChange,
}: SessionCostTableProps) {
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...records].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [records, sortField, sortDir]);

  const totalPages = Math.ceil(total / pageSize);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUpIcon className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDownIcon className="h-3 w-3 inline ml-1" />
    );
  }

  const columns: { field: SortField; label: string }[] = [
    { field: 'session_id', label: 'Session' },
    { field: 'agent_id', label: 'Agent' },
    { field: 'model', label: 'Model' },
    { field: 'input_tokens', label: 'Input' },
    { field: 'output_tokens', label: 'Output' },
    { field: 'estimated_cost_usd', label: 'Cost' },
    { field: 'timestamp', label: 'Time' },
  ];

  return (
    <Card padding="none">
      <CardHeader className="px-5 pt-5">
        <CardTitle>Cost Records</CardTitle>
        <span className="text-sm text-text-tertiary">{total} records</span>
      </CardHeader>
      <CardContent className="p-0">
        {records.length === 0 ? (
          <div
            className="flex items-center justify-center h-32 text-text-tertiary"
            data-testid="table-empty"
          >
            No cost records found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="cost-table">
                <thead>
                  <tr className="border-b border-bg-tertiary">
                    <th className="w-8" />
                    {columns.map((col) => (
                      <th
                        key={col.field}
                        onClick={() => handleSort(col.field)}
                        className="px-4 py-3 text-left text-text-secondary font-medium cursor-pointer hover:text-text-primary"
                      >
                        {col.label}
                        <SortIcon field={col.field} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((record) => (
                    <Fragment key={record.id}>
                      <tr
                        key={record.id}
                        className="border-b border-bg-tertiary/50 hover:bg-bg-secondary/50 cursor-pointer"
                        onClick={() =>
                          record.session_id && setExpandedId(
                            expandedId === record.session_id ? null : record.session_id
                          )
                        }
                      >
                        <td className="pl-4 py-2">
                          <ChevronRightIcon
                            className={`h-4 w-4 text-text-tertiary transition-transform ${
                              expandedId === record.session_id ? 'rotate-90' : ''
                            }`}
                          />
                        </td>
                        <td className="px-4 py-2 text-text-primary font-mono text-xs">
                          {(record.session_id ?? '').slice(0, 12)}...
                        </td>
                        <td className="px-4 py-2 text-text-secondary">{record.agent_id ?? '-'}</td>
                        <td className="px-4 py-2 text-text-secondary font-mono text-xs">
                          {record.model ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-text-tertiary">
                          {formatTokenCount(record.input_tokens)}
                        </td>
                        <td className="px-4 py-2 text-text-tertiary">
                          {formatTokenCount(record.output_tokens)}
                        </td>
                        <td className="px-4 py-2 text-accent-teal-light font-medium">
                          {formatCost(record.estimated_cost_usd)}
                        </td>
                        <td className="px-4 py-2 text-text-tertiary text-xs">
                          {formatTimestamp(record.timestamp)}
                        </td>
                      </tr>
                      {expandedId === record.session_id && (
                        <ExpandedRow sessionId={record.session_id} />
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-bg-tertiary">
                <span className="text-sm text-text-tertiary">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 text-sm rounded bg-bg-tertiary text-text-secondary hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1 text-sm rounded bg-bg-tertiary text-text-secondary hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
