import { useAuthStore } from "../stores/authStore";

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const apiKey = useAuthStore((state) => state.apiKey);

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      alert("API key copied to clipboard!");
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Account section */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Email
              </label>
              <p className="text-gray-900">{user?.email || "—"}</p>
            </div>
          </div>
        </div>

        {/* Extension API Key section */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Browser Extension
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Use this API key to connect the browser extension to your account.
          </p>

          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-50 px-4 py-2 rounded-lg font-mono text-sm truncate">
              {apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-8)}` : "—"}
            </div>
            <button
              onClick={copyApiKey}
              className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg"
            >
              Copy
            </button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              How to connect the extension:
            </h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Install the Smart Product Saver extension</li>
              <li>Click the extension icon in your browser</li>
              <li>Enter the server URL: <code className="bg-blue-100 px-1 rounded">http://localhost:8000</code></li>
              <li>Paste your API key</li>
              <li>Click "Connect"</li>
            </ol>
          </div>
        </div>

        {/* About section */}
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">About</h2>
          <div className="text-sm text-gray-500 space-y-2">
            <p>Smart Product Saver v1.0.0</p>
            <p>
              A tool to capture, organize, and compare products from any website.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
