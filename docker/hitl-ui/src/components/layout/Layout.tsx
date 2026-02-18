import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import RightPanel from './RightPanel';
import StatusBar from './StatusBar';

export default function Layout() {
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Content wrapper with right panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-7xl h-full">
              <Outlet />
            </div>
          </main>

          {/* Right Panel (Live Events) */}
          <RightPanel
            isOpen={rightPanelOpen}
            onClose={() => setRightPanelOpen(false)}
          />
        </div>

        {/* Status Bar */}
        <StatusBar
          activeWorkers={3}
          totalWorkers={5}
          pendingGates={2}
          systemHealth="healthy"
          onOpenEventPanel={() => setRightPanelOpen(true)}
        />
      </div>
    </div>
  );
}
