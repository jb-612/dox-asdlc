import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import DesignerPage from './pages/DesignerPage';
import TemplateManagerPage from './pages/TemplateManagerPage';
import ExecutionPage from './pages/ExecutionPage';
import ExecutionWalkthroughPage from './pages/ExecutionWalkthroughPage';
import CLIManagerPage from './pages/CLIManagerPage';
import SettingsPage from './pages/SettingsPage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'block px-3 py-2 rounded text-sm font-medium transition-colors';
  return isActive
    ? `${base} bg-blue-600 text-white`
    : `${base} text-gray-300 hover:bg-gray-700 hover:text-white`;
}

function App(): JSX.Element {
  // Register global keyboard shortcuts (Ctrl+S, Ctrl+Z, etc.)
  useKeyboardShortcuts();

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
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<DesignerPage />} />
            <Route path="/templates" element={<TemplateManagerPage />} />
            <Route path="/execute" element={<ExecutionPage />} />
            <Route path="/execute/run" element={<ExecutionWalkthroughPage />} />
            <Route path="/cli" element={<CLIManagerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
