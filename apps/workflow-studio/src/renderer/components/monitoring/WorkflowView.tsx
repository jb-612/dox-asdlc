import { useEffect, useState } from 'react';
import { useMonitoringStore } from '../../stores/monitoringStore';
import type { AgentSession, AgentSessionStatus } from '../../../shared/types/monitoring';

const STATUS_STYLES: Record<AgentSessionStatus, { label: string; className: string }> = {
  running: { label: 'Running', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Error', className: 'bg-red-100 text-red-800' },
  completed: { label: 'Complete', className: 'bg-gray-100 text-gray-600' },
};

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function isVisible(session: AgentSession): boolean {
  if (session.status === 'running' || session.status === 'failed') return true;
  if (session.status === 'completed' && session.completedAt) {
    return Date.now() - new Date(session.completedAt).getTime() < 60_000;
  }
  return false;
}

export default function WorkflowView() {
  const sessions = useMonitoringStore((s) => s.sessions);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const visible = Array.from(sessions.values()).filter(isVisible);

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No active workflows
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-4 font-medium">Agent</th>
            <th className="py-2 pr-4 font-medium">Step</th>
            <th className="py-2 pr-4 font-medium">Elapsed</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((session) => {
            const { label, className } = STATUS_STYLES[session.status];
            const step =
              session.currentStepIndex != null && session.currentStepName
                ? `${session.currentStepIndex}: ${session.currentStepName}`
                : session.currentStepName ?? '—';
            return (
              <tr key={session.sessionId} className="border-b last:border-0">
                <td className="py-2 pr-4 font-mono">{session.agentId}</td>
                <td className="py-2 pr-4 text-gray-700">{step}</td>
                <td className="py-2 pr-4 text-gray-500">{formatElapsed(session.startedAt)}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${className}`}>
                    {label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
