import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { DailyCostPoint } from '../../../shared/types/analytics';

export type ChartWindow = '7d' | '30d';

export interface CostChartProps {
  data: DailyCostPoint[];
  window: ChartWindow;
  onWindowChange: (w: ChartWindow) => void;
}

export default function CostChart({
  data,
  window: chartWindow,
  onWindowChange,
}: CostChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        No cost data available
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button
          className={`px-3 py-1 text-sm rounded ${
            chartWindow === '7d'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300'
          }`}
          onClick={() => onWindowChange('7d')}
        >
          7d
        </button>
        <button
          className={`px-3 py-1 text-sm rounded ${
            chartWindow === '30d'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300'
          }`}
          onClick={() => onWindowChange('30d')}
        >
          30d
        </button>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="totalCostUsd" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
