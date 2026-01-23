import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Spinner from './components/common/Spinner';

// Eager load Dashboard for fast initial render
import Dashboard from './pages/Dashboard';

// Lazy load all other pages
const DocsPage = lazy(() => import('./pages/DocsPage'));
const CockpitPage = lazy(() => import('./pages/CockpitPage'));
const RunDetailPage = lazy(() => import('./pages/RunDetailPage'));
const StudioDiscoveryPage = lazy(() => import('./pages/StudioDiscoveryPage'));
const GatesPage = lazy(() => import('./pages/GatesPage'));
const GateDetailPage = lazy(() => import('./pages/GateDetailPage'));
const ArtifactsPage = lazy(() => import('./pages/ArtifactsPage'));
const ArtifactDetailPage = lazy(() => import('./pages/ArtifactDetailPage'));
const WorkersPage = lazy(() => import('./pages/WorkersPage'));
const SessionsPage = lazy(() => import('./pages/SessionsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size="lg" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Dashboard */}
            <Route index element={<Dashboard />} />

            {/* Documentation */}
            <Route path="docs" element={<DocsPage />} />

            {/* Agent Cockpit */}
            <Route path="cockpit" element={<CockpitPage />} />
            <Route path="cockpit/runs/:runId" element={<RunDetailPage />} />

            {/* Discovery Studio */}
            <Route path="studio/discovery" element={<StudioDiscoveryPage />} />

            {/* HITL Gates */}
            <Route path="gates" element={<GatesPage />} />
            <Route path="gates/:gateId" element={<GateDetailPage />} />

            {/* Artifacts */}
            <Route path="artifacts" element={<ArtifactsPage />} />
            <Route path="artifacts/:artifactId" element={<ArtifactDetailPage />} />

            {/* Legacy routes (from P05-F01) */}
            <Route path="workers" element={<WorkersPage />} />
            <Route path="sessions" element={<SessionsPage />} />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
