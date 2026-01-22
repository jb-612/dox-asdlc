import { Link } from 'react-router-dom';
import {
  ShieldCheckIcon,
  DocumentTextIcon,
  CpuChipIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { usePendingGates } from '@/api/gates';
import { useWorkerPoolStatus } from '@/api/workers';
import { useSessions } from '@/api/sessions';
import { GateCard } from '@/components/gates';
import { Card, CardHeader, CardTitle, CardContent, LoadingOverlay } from '@/components/common';
import StatsCard from '@/components/common/StatsCard';

export default function Dashboard() {
  const { data: gatesData, isLoading: gatesLoading } = usePendingGates({ limit: 5 });
  const { data: workersData, isLoading: workersLoading } = useWorkerPoolStatus();
  const { data: sessionsData, isLoading: sessionsLoading } = useSessions({
    status: 'active',
  });

  const isLoading = gatesLoading || workersLoading || sessionsLoading;

  if (isLoading) {
    return <LoadingOverlay message="Loading dashboard..." />;
  }

  const pendingGates = gatesData?.total ?? 0;
  const activeSessions = sessionsData?.sessions.filter((s) => s.status === 'active').length ?? 0;
  const workerUtilization = workersData
    ? `${workersData.active}/${workersData.total}`
    : '0/0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">
          Overview of your aSDLC governance status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/gates">
          <StatsCard
            title="Pending Gates"
            value={pendingGates}
            subtitle={pendingGates === 1 ? 'awaiting review' : 'awaiting review'}
            icon={<ShieldCheckIcon className="h-6 w-6" />}
            color={pendingGates > 0 ? 'warning' : 'success'}
          />
        </Link>

        <Link to="/sessions">
          <StatsCard
            title="Active Sessions"
            value={activeSessions}
            subtitle="workflows in progress"
            icon={<DocumentTextIcon className="h-6 w-6" />}
            color="teal"
          />
        </Link>

        <Link to="/workers">
          <StatsCard
            title="Worker Pool"
            value={workerUtilization}
            subtitle={`${workersData?.idle ?? 0} idle workers`}
            icon={<CpuChipIcon className="h-6 w-6" />}
            color={workersData && workersData.idle === 0 ? 'warning' : 'default'}
          />
        </Link>
      </div>

      {/* Recent Pending Gates */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Pending Gates</CardTitle>
          {pendingGates > 0 && (
            <Link
              to="/gates"
              className="flex items-center gap-1 text-sm text-accent-teal-light hover:text-accent-teal transition-colors"
            >
              View all
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {gatesData?.gates.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheckIcon className="h-12 w-12 text-status-success mx-auto mb-3" />
              <p className="text-text-secondary">
                All caught up! No pending gates.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gatesData?.gates.slice(0, 4).map((gate) => (
                <GateCard key={gate.id} gate={gate} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Worker Status Overview */}
      {workersData && workersData.workers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Workers</CardTitle>
            <Link
              to="/workers"
              className="flex items-center gap-1 text-sm text-accent-teal-light hover:text-accent-teal transition-colors"
            >
              View all
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {workersData.workers
                .filter((w) => w.status === 'running')
                .slice(0, 4)
                .map((worker) => (
                  <div
                    key={worker.agent_id}
                    className="p-3 bg-bg-tertiary/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-status-success animate-pulse" />
                      <span className="text-sm font-medium text-text-primary truncate">
                        {worker.agent_type}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {worker.current_task || 'Idle'}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
