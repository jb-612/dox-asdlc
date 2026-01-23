import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import GatesPage from './pages/GatesPage';
import GateDetailPage from './pages/GateDetailPage';
import WorkersPage from './pages/WorkersPage';
import SessionsPage from './pages/SessionsPage';
import CockpitPage from './pages/CockpitPage';
import RunDetailPage from './pages/RunDetailPage';
import ArtifactsPage from './pages/ArtifactsPage';
import ArtifactDetailPage from './pages/ArtifactDetailPage';
import DocsPage from './pages/DocsPage';
import StudioDiscoveryPage from './pages/StudioDiscoveryPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="gates" element={<GatesPage />} />
          <Route path="gates/:gateId" element={<GateDetailPage />} />
          <Route path="workers" element={<WorkersPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="cockpit" element={<CockpitPage />} />
          <Route path="cockpit/runs/:runId" element={<RunDetailPage />} />
          <Route path="artifacts" element={<ArtifactsPage />} />
          <Route path="artifacts/:artifactId" element={<ArtifactDetailPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="studio" element={<StudioDiscoveryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
