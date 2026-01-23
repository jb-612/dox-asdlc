import { CpuChipIcon } from '@heroicons/react/24/outline';

export default function CockpitPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CpuChipIcon className="h-8 w-8 text-accent-teal" />
        <h1 className="text-2xl font-bold text-text-primary">Agent Cockpit</h1>
      </div>

      <div className="card p-8 text-center">
        <p className="text-text-secondary">
          Monitor agent utilization and workflow execution.
        </p>
        <p className="text-text-muted text-sm mt-2">
          KPI Header, Worker Utilization, Workflow Graph, and Runs Table coming soon.
        </p>
      </div>
    </div>
  );
}
