import { useEffect } from 'react';
import { useMonitoringStore, hydrateMonitoringStore, initMonitoringListeners } from '../stores/monitoringStore';
import SummaryCards from '../components/monitoring/SummaryCards';
import AgentSelector from '../components/monitoring/AgentSelector';
import SessionList from '../components/monitoring/SessionList';
import EventStream from '../components/monitoring/EventStream';
import WorkflowView from '../components/monitoring/WorkflowView';

export default function MonitoringPage(): JSX.Element {
  const receiverActive = useMonitoringStore((s) => s.receiverActive);

  useEffect(() => {
    hydrateMonitoringStore().catch(() => {});
  }, []);

  useEffect(() => {
    const cleanup = initMonitoringListeners();
    return cleanup;
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Monitoring Dashboard</h2>
          <p className="text-sm text-gray-400 mt-0.5">Agent telemetry, session tracking, and live event streaming.</p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            receiverActive
              ? 'bg-green-900/40 text-green-400 border border-green-700/40'
              : 'bg-gray-800 text-gray-500 border border-gray-700'
          }`}
        >
          {receiverActive ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Two-column body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left sidebar (300px) */}
        <div
          className="shrink-0 flex flex-col gap-4 p-4 border-r border-gray-700 overflow-y-auto"
          style={{ width: 300 }}
        >
          <SummaryCards />
          <AgentSelector />
          <div className="flex-1 overflow-y-auto">
            <SessionList />
          </div>
        </div>

        {/* Right main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 border-b border-gray-700 overflow-y-auto">
            <EventStream />
          </div>
          <div className="flex-1 overflow-y-auto">
            <WorkflowView />
          </div>
        </div>
      </div>
    </div>
  );
}
