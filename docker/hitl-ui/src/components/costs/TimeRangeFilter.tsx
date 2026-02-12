import { useCostsStore } from '../../stores/costsStore';
import type { CostTimeRange } from '../../types/costs';

const TIME_RANGES: { value: CostTimeRange; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All' },
];

export default function TimeRangeFilter() {
  const { selectedTimeRange, setTimeRange } = useCostsStore();

  return (
    <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1" data-testid="time-range-filter">
      {TIME_RANGES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setTimeRange(value)}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            selectedTimeRange === value
              ? 'bg-bg-primary text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          data-testid={`time-range-${value}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
