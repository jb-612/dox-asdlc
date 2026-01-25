import { useEffect } from 'react';
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
import DiagramDetailPage from './pages/DiagramDetailPage';
import DocDetailPage from './pages/DocDetailPage';
import StudioDiscoveryPage from './pages/StudioDiscoveryPage';
import RuleProposalsPage from './pages/RuleProposalsPage';
import K8sPage from './pages/K8sPage';
import MetricsPage from './pages/MetricsPage';
import SearchPage from './pages/SearchPage';
import { initMermaid } from './config/mermaid';

function App() {
  // Initialize theme on app load
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    initMermaid(theme as 'light' | 'dark');
  }, []);
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
          <Route path="k8s" element={<K8sPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="artifacts" element={<ArtifactsPage />} />
          <Route path="artifacts/:artifactId" element={<ArtifactDetailPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="docs/diagrams/:diagramId" element={<DiagramDetailPage />} />
          <Route path="docs/:docPath" element={<DocDetailPage />} />
          <Route path="studio" element={<StudioDiscoveryPage />} />
          <Route path="studio/discovery" element={<Navigate to="/studio" replace />} />
          <Route path="rules" element={<RuleProposalsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
