import {
  CurrencyDollarIcon,
  ClockIcon,
  UserIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import StatsCard from '../common/StatsCard';
import type { CostSummaryResponse } from '../../types/costs';

interface CostSummaryCardsProps {
  data: CostSummaryResponse | null;
  loading?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toFixed(2)}`;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toString();
}

function getTopAgent(data: CostSummaryResponse): { name: string; cost: number } | null {
  if (!data.groups.length) return null;
  const sorted = [...data.groups].sort((a, b) => b.total_cost_usd - a.total_cost_usd);
  return { name: sorted[0].key, cost: sorted[0].total_cost_usd };
}

function getSpendRate(data: CostSummaryResponse): string {
  if (!data.period) return 'N/A';
  const from = new Date(data.period.date_from).getTime();
  const to = new Date(data.period.date_to).getTime();
  if (isNaN(from) || isNaN(to) || to <= from) return 'N/A';
  const hours = (to - from) / (1000 * 60 * 60);
  const rate = data.total_cost_usd / hours;
  return `$${rate.toFixed(2)}/hr`;
}

export default function CostSummaryCards({ data, loading }: CostSummaryCardsProps) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="cost-summary-loading">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-4 bg-bg-tertiary rounded w-24 mb-3" />
            <div className="h-8 bg-bg-tertiary rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const topAgent = getTopAgent(data);
  const totalTokens = data.total_input_tokens + data.total_output_tokens;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="cost-summary-cards">
      <StatsCard
        title="Total Spend"
        value={formatCurrency(data.total_cost_usd)}
        icon={<CurrencyDollarIcon className="h-6 w-6" />}
        color="teal"
      />
      <StatsCard
        title="Spend Rate"
        value={getSpendRate(data)}
        icon={<ClockIcon className="h-6 w-6" />}
      />
      <StatsCard
        title="Top Agent"
        value={topAgent?.name ?? 'N/A'}
        subtitle={topAgent ? formatCurrency(topAgent.cost) : undefined}
        icon={<UserIcon className="h-6 w-6" />}
      />
      <StatsCard
        title="Total Tokens"
        value={formatTokens(totalTokens)}
        subtitle={`${formatTokens(data.total_input_tokens)} in / ${formatTokens(data.total_output_tokens)} out`}
        icon={<CpuChipIcon className="h-6 w-6" />}
      />
    </div>
  );
}
