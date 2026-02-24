import { useState, useEffect, useCallback } from 'react';

interface VersionInfo {
  app: string;
  electron: string;
  node: string;
}

export default function AboutSection(): JSX.Element {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadVersion() {
      try {
        if (window.electronAPI?.settings?.getVersion) {
          const info = await window.electronAPI.settings.getVersion();
          setVersion(info);
        }
      } catch {
        // Failed to get version info
      }
    }
    loadVersion();
  }, []);

  const handleCopy = useCallback(async () => {
    if (!version) return;
    const text = `Workflow Studio v${version.app}\nElectron ${version.electron}\nNode.js ${version.node}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [version]);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">About</h3>

      {!version ? (
        <p className="text-sm text-gray-500">Loading version info...</p>
      ) : (
        <div className="space-y-3">
          <VersionRow label="App Version" value={`v${version.app}`} />
          <VersionRow label="Electron" value={version.electron} />
          <VersionRow label="Node.js" value={version.node} />

          <button
            type="button"
            onClick={handleCopy}
            className="mt-4 px-3 py-1.5 text-xs font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy version info'}
          </button>
        </div>
      )}
    </div>
  );
}

function VersionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs font-medium text-gray-400 w-28">{label}</span>
      <span className="text-sm text-gray-200 font-mono">{value}</span>
    </div>
  );
}
