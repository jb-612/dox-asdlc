import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { WorkerPoolStatus } from '@/api/types';

interface WorkerPoolProps {
  data: WorkerPoolStatus;
}

const COLORS = {
  active: '#22C55E',  // status-success
  idle: '#4A4A4A',    // text-tertiary
};

export default function WorkerPool({ data }: WorkerPoolProps) {
  const chartData = [
    { name: 'Active', value: data.active, color: COLORS.active },
    { name: 'Idle', value: data.idle, color: COLORS.idle },
  ];

  const utilizationPercent = data.total > 0
    ? Math.round((data.active / data.total) * 100)
    : 0;

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      {/* Chart */}
      <div className="w-48 h-48 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0a0a0a',
                border: '1px solid #141414',
                borderRadius: '8px',
                color: '#FBFCFC',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-text-secondary text-sm">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center -mt-4">
            <p className="text-2xl font-semibold text-text-primary">
              {utilizationPercent}%
            </p>
            <p className="text-xs text-text-tertiary">utilized</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-1 grid grid-cols-3 gap-4 w-full md:w-auto">
        <div className="text-center md:text-left">
          <p className="text-3xl font-semibold text-text-primary">
            {data.total}
          </p>
          <p className="text-sm text-text-secondary">Total Workers</p>
        </div>
        <div className="text-center md:text-left">
          <p className="text-3xl font-semibold text-status-success">
            {data.active}
          </p>
          <p className="text-sm text-text-secondary">Active</p>
        </div>
        <div className="text-center md:text-left">
          <p className="text-3xl font-semibold text-text-tertiary">
            {data.idle}
          </p>
          <p className="text-sm text-text-secondary">Idle</p>
        </div>
      </div>
    </div>
  );
}
