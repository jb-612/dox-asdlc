import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, ProviderId, ProviderConfig } from '../../shared/types/settings';
import { DEFAULT_SETTINGS } from '../../shared/types/settings';
import { ProviderCard, EnvironmentSection, AboutSection } from '../components/settings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'providers' | 'environment' | 'about';

const TABS: { id: TabId; label: string }[] = [
  { id: 'providers', label: 'AI Providers' },
  { id: 'environment', label: 'Environment' },
  { id: 'about', label: 'About' },
];

const ALL_PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'google', 'azure'];

// ---------------------------------------------------------------------------
// IPC helpers
// ---------------------------------------------------------------------------

async function loadSettings(): Promise<AppSettings> {
  try {
    if (window.electronAPI?.settings) {
      return await window.electronAPI.settings.load();
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(settings: AppSettings): Promise<{ ok: boolean; error?: string }> {
  if (!window.electronAPI?.settings) {
    return { ok: false, error: 'electronAPI.settings not available (preload not loaded?)' };
  }
  try {
    const result = await window.electronAPI.settings.save(settings);
    if (result.success) return { ok: true };
    return { ok: false, error: result.error ?? 'Handler returned success=false' };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [activeTab, setActiveTab] = useState<TabId>('providers');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Per-provider key status & test results
  const [keyStatus, setKeyStatus] = useState<Record<ProviderId, boolean>>({
    anthropic: false, openai: false, google: false, azure: false,
  });
  const [testResults, setTestResults] = useState<Record<ProviderId, { ok: boolean; latencyMs?: number; error?: string } | null>>({
    anthropic: null, openai: null, google: null, azure: null,
  });
  const [testLoading, setTestLoading] = useState<Record<ProviderId, boolean>>({
    anthropic: false, openai: false, google: false, azure: false,
  });

  // Encryption warning (T11)
  const [encryptionAvailable, setEncryptionAvailable] = useState(true);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Load settings + key status on mount
  useEffect(() => {
    async function init() {
      const s = await loadSettings();
      setSettings(s);
      setLoaded(true);

      // Check key status for all providers
      if (window.electronAPI?.settings?.getKeyStatus) {
        for (const p of ALL_PROVIDERS) {
          try {
            const status = await window.electronAPI.settings.getKeyStatus(p);
            setKeyStatus((prev) => ({ ...prev, [p]: status.hasKey }));
            if ('encryptionAvailable' in status && !(status as { encryptionAvailable?: boolean }).encryptionAvailable) {
              setEncryptionAvailable(false);
            }
          } catch {
            // ignore
          }
        }
      }
    }
    init();
  }, []);

  const updateField = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSaveStatus('idle');
    },
    [],
  );

  const handleProviderConfigChange = useCallback(
    (provider: ProviderId, config: ProviderConfig) => {
      setSettings((prev) => ({
        ...prev,
        providers: { ...prev.providers, [provider]: config },
      }));
      setSaveStatus('idle');
    },
    [],
  );

  const handleSaveKey = useCallback(
    async (provider: ProviderId, key: string) => {
      try {
        if (window.electronAPI?.settings?.setApiKey) {
          const result = await window.electronAPI.settings.setApiKey(provider, key);
          if (result.success) {
            setKeyStatus((prev) => ({ ...prev, [provider]: true }));
          }
        }
      } catch {
        // ignore
      }
    },
    [],
  );

  const handleDeleteKey = useCallback(
    async (provider: ProviderId) => {
      try {
        if (window.electronAPI?.settings?.deleteApiKey) {
          await window.electronAPI.settings.deleteApiKey(provider);
          setKeyStatus((prev) => ({ ...prev, [provider]: false }));
          setTestResults((prev) => ({ ...prev, [provider]: null }));
        }
      } catch {
        // ignore
      }
    },
    [],
  );

  const handleTestProvider = useCallback(
    async (provider: ProviderId) => {
      setTestLoading((prev) => ({ ...prev, [provider]: true }));
      setTestResults((prev) => ({ ...prev, [provider]: null }));
      try {
        if (window.electronAPI?.settings?.testProvider) {
          const result = await window.electronAPI.settings.testProvider(provider);
          setTestResults((prev) => ({
            ...prev,
            [provider]: { ok: result.success, latencyMs: result.latencyMs, error: result.error },
          }));
        }
      } catch (err: unknown) {
        setTestResults((prev) => ({
          ...prev,
          [provider]: { ok: false, error: err instanceof Error ? err.message : String(err) },
        }));
      } finally {
        setTestLoading((prev) => ({ ...prev, [provider]: false }));
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    setSaveError(null);
    const result = await saveSettings(settings);
    setSaveStatus(result.ok ? 'saved' : 'error');
    if (result.ok) {
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveError(result.error ?? null);
    }
  }, [settings]);

  const handleReset = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
    setSaveStatus('idle');
  }, []);

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
          Configure AI providers, environment, and application preferences.
        </p>
      </div>

      {/* Encryption warning banner (T11) */}
      {!encryptionAvailable && !warningDismissed && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
          <svg className="w-5 h-5 text-yellow-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-xs text-yellow-300 flex-1">
            API key encryption unavailable on this system. Keys are stored unencrypted.
            Install gnome-keyring or kwallet for encrypted storage.
          </p>
          <button
            type="button"
            onClick={() => setWarningDismissed(true)}
            className="text-yellow-500 hover:text-yellow-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tab bar + content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tab sidebar */}
        <div className="w-44 border-r border-gray-700 py-4 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-700/50 text-blue-400 border-r-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            {activeTab === 'providers' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-4">
                  AI Providers
                </h3>
                {ALL_PROVIDERS.map((provider) => {
                  const config = settings.providers?.[provider] ?? { id: provider };
                  return (
                    <ProviderCard
                      key={provider}
                      provider={provider}
                      config={config}
                      hasKey={keyStatus[provider]}
                      encryptionAvailable={encryptionAvailable}
                      onChange={(c) => handleProviderConfigChange(provider, c)}
                      onSaveKey={(key) => handleSaveKey(provider, key)}
                      onDeleteKey={() => handleDeleteKey(provider)}
                      onTest={() => handleTestProvider(provider)}
                      testResult={testResults[provider]}
                      testLoading={testLoading[provider]}
                    />
                  );
                })}
              </div>
            )}

            {activeTab === 'environment' && (
              <EnvironmentSection settings={settings} onChange={updateField} />
            )}

            {activeTab === 'about' && <AboutSection />}
          </div>
        </div>
      </div>

      {/* Footer with Save / Reset (not shown on About tab) */}
      {activeTab !== 'about' && (
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
              <span className="text-xs text-red-400" title={saveError ?? undefined}>
                {saveError ?? 'Failed to save.'} {saveError && '(hover for details)'}
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
      )}
    </div>
  );
}
