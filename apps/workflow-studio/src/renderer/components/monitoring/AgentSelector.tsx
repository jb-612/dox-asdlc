import React from 'react';
import { useMonitoringStore } from '../../stores/monitoringStore';

export default function AgentSelector(): React.ReactElement {
  const sessions = useMonitoringStore((s) => s.sessions);
  const selectedAgentId = useMonitoringStore((s) => s.selectedAgentId);
  const selectAgent = useMonitoringStore((s) => s.selectAgent);

  const agentIds = Array.from(
    new Set(Array.from(sessions.values()).map((s) => s.agentId))
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    selectAgent(e.target.value === '' ? null : e.target.value);
  };

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span>Agents ({agentIds.length})</span>
      <select value={selectedAgentId ?? ''} onChange={handleChange}>
        <option value="">All agents</option>
        {agentIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </label>
  );
}
