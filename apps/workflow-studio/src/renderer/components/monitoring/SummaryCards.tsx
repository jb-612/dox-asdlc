import { useMonitoringStore } from '../../stores/monitoringStore';

interface CardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: CardProps): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p
        className="text-2xl font-bold text-gray-100"
        style={{ transition: 'opacity 0.2s ease-in-out' }}
      >
        {value}
      </p>
    </div>
  );
}

export default function SummaryCards(): JSX.Element {
  const stats = useMonitoringStore((s) => s.stats);

  const totalEvents = stats?.totalEvents ?? 0;
  const activeSessions = stats?.activeSessions ?? 0;
  const errorRate = stats != null ? (stats.errorRate * 100).toFixed(1) : '0.0';
  const totalCost = stats?.totalCostUsd != null ? stats.totalCostUsd.toFixed(4) : '0.0000';

  return (
    <div className="flex flex-col gap-2">
      <MetricCard label="Total Events" value={String(totalEvents)} />
      <MetricCard label="Active Sessions" value={String(activeSessions)} />
      <MetricCard label="Error Rate" value={`${errorRate}%`} />
      <MetricCard label="Total Cost" value={`$${totalCost}`} />
    </div>
  );
}
