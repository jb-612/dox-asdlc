import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useWorkerPoolStatus } from '@/api/workers';
import { WorkerPool, WorkerCard } from '@/components/workers';
import { Card, CardHeader, CardTitle, CardContent, LoadingOverlay, EmptyState } from '@/components/common';
import clsx from 'clsx';

export default function WorkersPage() {
  const { data, isLoading, error, refetch, isFetching } = useWorkerPoolStatus();

  if (isLoading) {
    return <LoadingOverlay message="Loading worker status..." />;
  }

  if (error) {
    return (
      <EmptyState
        type="workers"
        title="Failed to load workers"
        description="There was an error loading the worker pool status. Please try again."
        action={
          <button onClick={() => refetch()} className="btn-primary">
            Retry
          </button>
        }
      />
    );
  }

  if (!data) {
    return <EmptyState type="workers" />;
  }

  const activeWorkers = data.workers.filter((w) => w.status === 'running');
  const idleWorkers = data.workers.filter((w) => w.status === 'idle');
  const errorWorkers = data.workers.filter((w) => w.status === 'error');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Worker Pool
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Monitor agent worker status and utilization
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 bg-bg-secondary border border-bg-tertiary rounded-lg text-text-secondary hover:text-text-primary hover:border-accent-teal/30 transition-colors disabled:opacity-50"
          title="Refresh workers"
        >
          <ArrowPathIcon
            className={clsx('h-5 w-5', isFetching && 'animate-spin')}
          />
        </button>
      </div>

      {/* Pool Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkerPool data={data} />
        </CardContent>
      </Card>

      {/* Active Workers */}
      {activeWorkers.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-text-primary mb-4">
            Active Workers ({activeWorkers.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeWorkers.map((worker) => (
              <WorkerCard key={worker.agent_id} worker={worker} />
            ))}
          </div>
        </div>
      )}

      {/* Error Workers */}
      {errorWorkers.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-status-error mb-4">
            Workers with Errors ({errorWorkers.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {errorWorkers.map((worker) => (
              <WorkerCard key={worker.agent_id} worker={worker} />
            ))}
          </div>
        </div>
      )}

      {/* Idle Workers */}
      {idleWorkers.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-text-secondary mb-4">
            Idle Workers ({idleWorkers.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {idleWorkers.map((worker) => (
              <WorkerCard key={worker.agent_id} worker={worker} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
