import { useCallback } from 'react';
import type { AppSettings } from '../../../shared/types/settings';

interface EnvironmentSectionProps {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export default function EnvironmentSection({ settings, onChange }: EnvironmentSectionProps): JSX.Element {
  const handleBrowse = useCallback(
    async (field: keyof AppSettings) => {
      try {
        if (window.electronAPI?.dialog) {
          const path = await window.electronAPI.dialog.openDirectory();
          if (path) onChange(field, path as AppSettings[typeof field]);
        }
      } catch {
        // Fall through to manual entry
      }
    },
    [onChange],
  );

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Environment</h3>

      {/* Docker Socket Path */}
      <Field label="Docker Socket Path" description="Path to the Docker daemon socket.">
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.dockerSocketPath ?? '/var/run/docker.sock'}
            onChange={(e) => onChange('dockerSocketPath', e.target.value)}
            placeholder="/var/run/docker.sock"
            className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
          />
          <BrowseButton onClick={() => handleBrowse('dockerSocketPath')} />
        </div>
      </Field>

      {/* Default Repo Mount Path */}
      <Field label="Default Repo Mount Path" description="Pre-filled path for mounting repos into containers.">
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.defaultRepoMountPath ?? ''}
            onChange={(e) => onChange('defaultRepoMountPath', e.target.value)}
            placeholder="/workspace"
            className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
          />
          <BrowseButton onClick={() => handleBrowse('defaultRepoMountPath')} />
        </div>
      </Field>

      {/* Workspace Directory */}
      <Field label="Workspace Directory" description="Working directory for agent execution.">
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.workspaceDirectory ?? ''}
            onChange={(e) => onChange('workspaceDirectory', e.target.value)}
            placeholder="/home/user/workspace"
            className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
          />
          <BrowseButton onClick={() => handleBrowse('workspaceDirectory')} />
        </div>
      </Field>

      {/* Agent Timeout */}
      <Field label="Agent Timeout" description="Maximum seconds per agent step (30-3600).">
        <div className="flex items-center">
          <input
            type="number"
            min={30}
            max={3600}
            value={settings.agentTimeoutSeconds ?? 300}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                onChange('agentTimeoutSeconds', Math.min(3600, Math.max(30, val)));
              }
            }}
            className="w-32 text-sm bg-gray-900 text-gray-200 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
          />
          <span className="ml-2 text-xs text-gray-500">seconds</span>
        </div>
      </Field>

      {/* Divider for legacy fields */}
      <div className="border-t border-gray-700 pt-4">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">General</h4>
      </div>

      {/* Workflow Directory */}
      <Field label="Workflow Directory" description="Default directory for saving and loading workflow files.">
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.workflowDirectory}
            onChange={(e) => onChange('workflowDirectory', e.target.value)}
            placeholder="/path/to/workflows"
            className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
          />
          <BrowseButton onClick={() => handleBrowse('workflowDirectory')} />
        </div>
      </Field>

      {/* Template Directory */}
      <Field label="Template Directory" description="Directory containing workflow template files.">
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.templateDirectory}
            onChange={(e) => onChange('templateDirectory', e.target.value)}
            placeholder="/path/to/templates"
            className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
          />
          <BrowseButton onClick={() => handleBrowse('templateDirectory')} />
        </div>
      </Field>

      {/* Auto-save Interval */}
      <Field label="Auto-save Interval" description="How often to auto-save workflows (in seconds). Set to 0 to disable.">
        <div className="flex items-center">
          <input
            type="number"
            min={0}
            max={3600}
            step={5}
            value={settings.autoSaveIntervalSeconds}
            onChange={(e) =>
              onChange('autoSaveIntervalSeconds', Math.max(0, parseInt(e.target.value, 10) || 0))
            }
            className="w-32 text-sm bg-gray-900 text-gray-200 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
          />
          <span className="ml-2 text-xs text-gray-500">seconds</span>
        </div>
      </Field>

      {/* CLI Default Working Directory */}
      <Field label="CLI Default Working Directory" description="Default working directory when spawning new CLI sessions.">
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.cliDefaultCwd}
            onChange={(e) => onChange('cliDefaultCwd', e.target.value)}
            placeholder="/home/user/project"
            className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
          />
          <BrowseButton onClick={() => handleBrowse('cliDefaultCwd')} />
        </div>
      </Field>

      {/* Execution Mode */}
      <Field label="Execution Mode" description="Mock mode simulates agent execution. Disable for real CLI processes.">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.executionMockMode}
            onChange={(e) => onChange('executionMockMode', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-gray-300">
            {settings.executionMockMode ? 'Mock mode (simulated)' : 'Real mode (live CLI)'}
          </span>
        </label>
      </Field>

      {/* Redis URL */}
      <Field label="Redis Connection URL" description="Redis URL for agent coordination.">
        <input
          type="text"
          value={settings.redisUrl}
          onChange={(e) => onChange('redisUrl', e.target.value)}
          placeholder="redis://localhost:6379"
          className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
        />
      </Field>

      {/* Cursor Agent URL */}
      <Field label="Cursor Agent URL" description="HTTP endpoint for the Cursor CLI agent.">
        <input
          type="url"
          value={settings.cursorAgentUrl}
          onChange={(e) => onChange('cursorAgentUrl', e.target.value)}
          placeholder="http://localhost:8090"
          className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Field({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-200 mb-1">{label}</label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function BrowseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors shrink-0"
    >
      Browse
    </button>
  );
}
