import { useSettingsStore } from '../../stores/settingsStore';

export type AgentBackend = 'claude' | 'cursor' | 'codex';

export interface AgentBackendSelectorProps {
  value: AgentBackend;
  onChange: (backend: AgentBackend) => void;
}

interface BackendOption {
  id: AgentBackend;
  label: string;
  providerCheck: () => boolean;
}

export function AgentBackendSelector({
  value,
  onChange,
}: AgentBackendSelectorProps): JSX.Element {
  const getConfiguredProviders = useSettingsStore((s) => s.getConfiguredProviders);
  const configuredProviders = getConfiguredProviders();

  const backends: BackendOption[] = [
    {
      id: 'claude',
      label: 'Claude Code (Docker)',
      providerCheck: () => configuredProviders.includes('anthropic'),
    },
    {
      id: 'cursor',
      label: 'Cursor CLI (Docker)',
      providerCheck: () => true, // Cursor uses its own auth
    },
    {
      id: 'codex',
      label: 'Codex CLI (Docker)',
      providerCheck: () => configuredProviders.includes('openai'),
    },
  ];

  return (
    <div data-testid="backend-selector">
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: '#9ca3af',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Agent Backend
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {backends.map((backend) => {
          const isConfigured = backend.providerCheck();
          const isSelected = value === backend.id;

          return (
            <label
              key={backend.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                backgroundColor: isSelected ? '#1e3a5f' : '#1f2937',
                border: `1px solid ${isSelected ? '#2563eb' : '#374151'}`,
                cursor: isConfigured ? 'pointer' : 'default',
                opacity: isConfigured ? 1 : 0.5,
              }}
            >
              <input
                type="radio"
                name="agent-backend"
                value={backend.id}
                checked={isSelected}
                disabled={!isConfigured}
                onChange={() => onChange(backend.id)}
                style={{ accentColor: '#2563eb' }}
              />
              <span style={{ fontSize: 12, color: '#d1d5db', flex: 1 }}>
                {backend.label}
              </span>
              {!isConfigured && (
                <span
                  style={{
                    fontSize: 10,
                    color: '#f59e0b',
                    padding: '1px 6px',
                    borderRadius: 3,
                    backgroundColor: '#78350f',
                  }}
                >
                  not configured
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
