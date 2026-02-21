import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'block px-3 py-2 rounded text-sm font-medium transition-colors';
  return isActive
    ? `${base} bg-blue-600 text-white`
    : `${base} text-gray-300 hover:bg-gray-700 hover:text-white`;
}

function DesignerPage(): JSX.Element {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Workflow Designer</h2>
        <p className="text-gray-400">Visual canvas for building aSDLC workflows (coming soon)</p>
      </div>
    </div>
  );
}

function TemplatesPage(): JSX.Element {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Templates</h2>
        <p className="text-gray-400">Pre-built workflow templates (coming soon)</p>
      </div>
    </div>
  );
}

function ExecutePage(): JSX.Element {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Execute Workflow</h2>
        <p className="text-gray-400">Run and monitor workflow execution (coming soon)</p>
      </div>
    </div>
  );
}

function CliSessionsPage(): JSX.Element {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">CLI Sessions</h2>
        <p className="text-gray-400">Manage Claude CLI sessions (coming soon)</p>
      </div>
    </div>
  );
}

function SettingsPage(): JSX.Element {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Settings</h2>
        <p className="text-gray-400">Application configuration (coming soon)</p>
      </div>
    </div>
  );
}

function App(): JSX.Element {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-900 text-gray-100">
        {/* Sidebar Navigation */}
        <nav className="w-60 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h1 className="text-lg font-bold text-white">Workflow Studio</h1>
            <p className="text-xs text-gray-400 mt-1">aSDLC Visual Builder</p>
          </div>

          <div className="flex-1 p-3 flex flex-col gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Designer
            </NavLink>
            <NavLink to="/templates" className={navLinkClass}>
              Templates
            </NavLink>
            <NavLink to="/execute" className={navLinkClass}>
              Execute
            </NavLink>
            <NavLink to="/cli" className={navLinkClass}>
              CLI Sessions
            </NavLink>
          </div>

          <div className="p-3 border-t border-gray-700">
            <NavLink to="/settings" className={navLinkClass}>
              Settings
            </NavLink>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<DesignerPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/execute" element={<ExecutePage />} />
            <Route path="/cli" element={<CliSessionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
