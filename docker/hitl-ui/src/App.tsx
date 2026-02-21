import { useEffect, useCallback, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";

import { useDevOpsActivity } from "./api/devops";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { ErrorFallback } from "./components/common/ErrorFallback";
import { LoadingSpinner } from "./components/common/LoadingStates";
import { DevOpsNotificationBanner } from "./components/devops";
import Layout from "./components/layout/Layout";
import { initMermaid } from "./config/mermaid";
import { useDevOpsStore } from "./stores/devopsStore";

// Lazy-loaded pages for code splitting
const AdminLabelsPage = lazy(() => import("./pages/AdminLabelsPage"));
const AgentsDashboardPage = lazy(() => import("./pages/AgentsDashboardPage"));
const ArchitectBoardPage = lazy(() => import("./pages/ArchitectBoardPage"));
const ArtifactDetailPage = lazy(() => import("./pages/ArtifactDetailPage"));
const ArtifactsPage = lazy(() => import("./pages/ArtifactsPage"));
const BrainflareHubPage = lazy(() => import("./pages/BrainflareHubPage"));
const CockpitPage = lazy(() => import("./pages/CockpitPage"));
const CodeReviewPage = lazy(() => import("./pages/CodeReviewPage"));
const CostDashboardPage = lazy(() => import("./pages/CostDashboardPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DiagramDetailPage = lazy(() => import("./pages/DiagramDetailPage"));
const DocDetailPage = lazy(() => import("./pages/DocDetailPage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const GateDetailPage = lazy(() => import("./pages/GateDetailPage"));
const GatesPage = lazy(() => import("./pages/GatesPage"));
const GuardrailsPage = lazy(() => import("./pages/GuardrailsPage"));
const K8sPage = lazy(() => import("./pages/K8sPage"));
const LLMConfigPage = lazy(() => import("./pages/LLMConfigPage"));
const MetricsPage = lazy(() => import("./pages/MetricsPage"));
const RuleProposalsPage = lazy(() => import("./pages/RuleProposalsPage"));
const RunDetailPage = lazy(() => import("./pages/RunDetailPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const SessionsPage = lazy(() => import("./pages/SessionsPage"));
const StudioDiscoveryPage = lazy(() => import("./pages/StudioDiscoveryPage"));
const StudioIdeationPage = lazy(() => import("./pages/StudioIdeationPage"));
const WorkersPage = lazy(() => import("./pages/WorkersPage"));

/**
 * Per-route ErrorBoundary wrapper to isolate route-level crashes
 */
function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * DevOps notification banner wrapper component
 * Must be inside BrowserRouter to use useNavigate
 */
function DevOpsNotificationWrapper() {
  const navigate = useNavigate();
  const { data } = useDevOpsActivity();
  const { bannerDismissed, setBannerDismissed, resetBannerForActivity } = useDevOpsStore();

  // Extract current activity ID for dependency tracking
  const currentActivityId = data?.current?.id;

  // Reset banner when a new activity starts
  useEffect(() => {
    if (currentActivityId) {
      resetBannerForActivity(currentActivityId);
    }
  }, [currentActivityId, resetBannerForActivity]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setBannerDismissed(true);
  }, [setBannerDismissed]);

  // Handle click to navigate to metrics page
  const handleClick = useCallback(() => {
    navigate("/metrics");
  }, [navigate]);

  // Only show banner if there's a current activity and it hasn't been dismissed
  const showBanner = data?.current && !bannerDismissed;

  if (!showBanner || !data?.current) {
    return null;
  }

  return (
    <DevOpsNotificationBanner
      activity={data.current}
      onDismiss={handleDismiss}
      onClick={handleClick}
    />
  );
}

function App() {
  // Initialize theme on app load
  useEffect(() => {
    const theme = localStorage.getItem("asdlc:theme") || "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
    initMermaid(theme as "light" | "dark");
  }, []);
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {/* Global DevOps notification banner */}
      <DevOpsNotificationWrapper />

      <ErrorBoundary
        fallbackRender={({ error, resetErrorBoundary }) => (
          <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
        )}
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
              <Route path="gates" element={<RouteErrorBoundary><GatesPage /></RouteErrorBoundary>} />
              <Route path="gates/:gateId" element={<RouteErrorBoundary><GateDetailPage /></RouteErrorBoundary>} />
              <Route path="workers" element={<RouteErrorBoundary><WorkersPage /></RouteErrorBoundary>} />
              <Route path="sessions" element={<RouteErrorBoundary><SessionsPage /></RouteErrorBoundary>} />
              <Route path="cockpit" element={<RouteErrorBoundary><CockpitPage /></RouteErrorBoundary>} />
              <Route path="cockpit/runs/:runId" element={<RouteErrorBoundary><RunDetailPage /></RouteErrorBoundary>} />
              <Route path="k8s" element={<RouteErrorBoundary><K8sPage /></RouteErrorBoundary>} />
              <Route path="metrics" element={<RouteErrorBoundary><MetricsPage /></RouteErrorBoundary>} />
              <Route path="agents" element={<RouteErrorBoundary><AgentsDashboardPage /></RouteErrorBoundary>} />
              <Route path="artifacts" element={<RouteErrorBoundary><ArtifactsPage /></RouteErrorBoundary>} />
              <Route path="artifacts/:artifactId" element={<RouteErrorBoundary><ArtifactDetailPage /></RouteErrorBoundary>} />
              <Route path="docs" element={<RouteErrorBoundary><DocsPage /></RouteErrorBoundary>} />
              <Route path="docs/diagrams/:diagramId" element={<RouteErrorBoundary><DiagramDetailPage /></RouteErrorBoundary>} />
              <Route path="docs/:docPath" element={<RouteErrorBoundary><DocDetailPage /></RouteErrorBoundary>} />
              <Route path="studio" element={<RouteErrorBoundary><StudioDiscoveryPage /></RouteErrorBoundary>} />
              <Route path="studio/discovery" element={<Navigate to="/studio" replace />} />
              <Route path="studio/ideation" element={<RouteErrorBoundary><StudioIdeationPage /></RouteErrorBoundary>} />
              <Route path="rules" element={<RouteErrorBoundary><RuleProposalsPage /></RouteErrorBoundary>} />
              <Route path="review" element={<RouteErrorBoundary><CodeReviewPage /></RouteErrorBoundary>} />
              <Route path="search" element={<RouteErrorBoundary><SearchPage /></RouteErrorBoundary>} />
              <Route path="admin/llm" element={<RouteErrorBoundary><LLMConfigPage /></RouteErrorBoundary>} />
              <Route path="admin/labels" element={<RouteErrorBoundary><AdminLabelsPage /></RouteErrorBoundary>} />
              <Route path="brainflare" element={<RouteErrorBoundary><BrainflareHubPage /></RouteErrorBoundary>} />
              <Route path="guardrails" element={<RouteErrorBoundary><GuardrailsPage /></RouteErrorBoundary>} />
              <Route path="costs" element={<RouteErrorBoundary><CostDashboardPage /></RouteErrorBoundary>} />
              <Route path="architect" element={<RouteErrorBoundary><ArchitectBoardPage /></RouteErrorBoundary>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
