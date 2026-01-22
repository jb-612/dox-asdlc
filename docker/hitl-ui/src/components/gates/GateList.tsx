import { usePendingGates } from '@/api/gates';
import { LoadingOverlay, EmptyState } from '@/components/common';
import GateCard from './GateCard';
import type { GateType } from '@/api/types';

interface GateListProps {
  filter?: GateType;
  limit?: number;
}

export default function GateList({ filter, limit }: GateListProps) {
  const { data, isLoading, error, refetch } = usePendingGates({
    type: filter,
    limit: limit,
  });

  if (isLoading) {
    return <LoadingOverlay message="Loading gates..." />;
  }

  if (error) {
    return (
      <EmptyState
        type="gates"
        title="Failed to load gates"
        description="There was an error loading the pending gates. Please try again."
        action={
          <button
            onClick={() => refetch()}
            className="btn-primary"
          >
            Retry
          </button>
        }
      />
    );
  }

  if (!data?.gates.length) {
    return <EmptyState type="gates" />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.gates.map((gate) => (
        <GateCard key={gate.id} gate={gate} />
      ))}
    </div>
  );
}
