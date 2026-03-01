import type { ExecutionCostSummary } from '../../../shared/types/analytics';

export interface CostBreakdownProps {
  execution: ExecutionCostSummary | null;
}

export default function CostBreakdown({
  execution,
}: CostBreakdownProps): JSX.Element {
  if (!execution) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        Select an execution to view cost breakdown
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs uppercase bg-gray-800 text-gray-400">
          <tr>
            <th className="px-3 py-2">Block</th>
            <th className="px-3 py-2">Input Tokens</th>
            <th className="px-3 py-2">Output Tokens</th>
            <th className="px-3 py-2">Cost</th>
          </tr>
        </thead>
        <tbody>
          {execution.blockCosts.map((bc) => (
            <tr key={bc.blockId} className="border-b border-gray-700">
              <td className="px-3 py-2">{bc.blockId}</td>
              <td className="px-3 py-2">{bc.inputTokens.toLocaleString()}</td>
              <td className="px-3 py-2">{bc.outputTokens.toLocaleString()}</td>
              <td className="px-3 py-2">
                {bc.estimatedCostUsd != null
                  ? `$${bc.estimatedCostUsd.toFixed(4)}`
                  : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-800 font-semibold">
          <tr>
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2">
              {execution.totalInputTokens.toLocaleString()}
            </td>
            <td className="px-3 py-2">
              {execution.totalOutputTokens.toLocaleString()}
            </td>
            <td className="px-3 py-2">
              ${execution.totalCostUsd.toFixed(4)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
