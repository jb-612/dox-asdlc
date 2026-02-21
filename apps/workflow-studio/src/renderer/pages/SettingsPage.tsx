import { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../../shared/types/settings';
import { DEFAULT_SETTINGS } from '../../shared/types/settings';

// ---------------------------------------------------------------------------
// IPC helpers -- settings are persisted via main process
// ---------------------------------------------------------------------------

async function loadSettings(): Promise<AppSettings> {
  try {
    if (window.electronAPI && 'settings' in window.electronAPI) {
      const api = window.electronAPI as unknown as {
        settings: { load: () => Promise<AppSettings> };
      };
      return await api.settings.load();
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(settings: AppSettings): Promise<boolean> {
  try {
    if (window.electronAPI && 'settings' in window.electronAPI) {
      const api = window.electronAPI as unknown as {
        settings: { save: (s: AppSettings) => Promise<{ success: boolean }> };
      };
      const result = await api.settings.save(settings);
      return result.success;
    }
  } catch {
    // Fall through
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

/**
 * SettingsPage -- application configuration form.
 *
 * Fields:
 *  - Workflow directory (with Browse button)
 *  - Template directory (with Browse button)
 *  - Auto-save interval (seconds)
 *  - CLI default working directory (with Browse button)
 *  - Redis connection URL
 *
 * Save persists to the settings service via IPC.
 * Reset to Defaults restores factory settings.
 */
export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loaded, setLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const updateField = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSaveStatus('idle');
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    const success = await saveSettings(settings);
    setSaveStatus(success ? 'saved' : 'error');
    if (success) {
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [settings]);

  const handleReset = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
    setSaveStatus('idle');
  }, []);

  // Attempt to use Electron dialog for directory browsing
  const handleBrowse = useCallback(
    async (field: keyof AppSettings) => {
      try {
        if (window.electronAPI && 'dialog' in window.electronAPI) {
          const api = window.electronAPI as unknown as {
            dialog: { openDirectory: () => Promise<string | null> };
          };
          const path = await api.dialog.openDirectory();
          if (path) {
            updateField(field, path);
          }
          return;
        }
      } catch {
        // Fall through to manual entry
      }
      // If dialog is not available, focus the field for manual entry
    },
    [updateField],
  );

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 shrink-0">
        <h2 className="text-xl font-bold text-gray-100">Settings</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Configure application behavior and defaults.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Workflow Directory */}
          <SettingsField
            label="Workflow Directory"
            description="Default directory for saving and loading workflow files."
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.workflowDirectory}
                onChange={(e) => updateField('workflowDirectory', e.target.value)}
                placeholder="/path/to/workflows"
                className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => handleBrowse('workflowDirectory')}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors shrink-0"
              >
                Browse
              </button>
            </div>
          </SettingsField>

          {/* Template Directory */}
          <SettingsField
            label="Template Directory"
            description="Directory containing workflow template files."
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.templateDirectory}
                onChange={(e) => updateField('templateDirectory', e.target.value)}
                placeholder="/path/to/templates"
                className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => handleBrowse('templateDirectory')}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors shrink-0"
              >
                Browse
              </button>
            </div>
          </SettingsField>

          {/* Auto-save Interval */}
          <SettingsField
            label="Auto-save Interval"
            description="How often to auto-save workflows (in seconds). Set to 0 to disable."
          >
            <input
              type="number"
              min={0}
              max={3600}
              step={5}
              value={settings.autoSaveIntervalSeconds}
              onChange={(e) =>
                updateField(
                  'autoSaveIntervalSeconds',
                  Math.max(0, parseInt(e.target.value, 10) || 0),
                )
              }
              className="w-32 text-sm bg-gray-900 text-gray-200 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
            />
            <span className="ml-2 text-xs text-gray-500">seconds</span>
          </SettingsField>

          {/* CLI Default Working Directory */}
          <SettingsField
            label="CLI Default Working Directory"
            description="Default working directory when spawning new CLI sessions."
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.cliDefaultCwd}
                onChange={(e) => updateField('cliDefaultCwd', e.target.value)}
                placeholder="/home/user/project"
                className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => handleBrowse('cliDefaultCwd')}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors shrink-0"
              >
                Browse
              </button>
            </div>
          </SettingsField>

          {/* Redis URL */}
          <SettingsField
            label="Redis Connection URL"
            description="Redis URL used for agent coordination (e.g. redis://localhost:6379)."
          >
            <input
              type="text"
              value={settings.redisUrl}
              onChange={(e) => updateField('redisUrl', e.target.value)}
              placeholder="redis://localhost:6379"
              className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
            />
          </SettingsField>
        </div>
      </div>

      {/* Footer with Save / Reset */}
      <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Reset to Defaults
        </button>

        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-400">Settings saved.</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-400">
              Failed to save. IPC settings handler may not be available.
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`
              px-5 py-2 text-sm font-medium rounded-lg transition-colors
              ${
                saveStatus === 'saving'
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }
            `}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable field wrapper
// ---------------------------------------------------------------------------

interface SettingsFieldProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingsField({ label, description, children }: SettingsFieldProps): JSX.Element {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-200 mb-1">
        {label}
      </label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
