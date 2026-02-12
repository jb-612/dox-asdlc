import { useEffect, useCallback, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { initMermaid } from "./config/mermaid";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { ErrorFallback } from "./components/common/ErrorFallback";
import { LoadingSpinner } from "./components/common/LoadingStates";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GatesPage = lazy(() => import("./pages/GatesPage"));
const GateDetailPage = lazy(() => import("./pages/GateDetailPage"));
const WorkersPage = lazy(() => import("./pages/WorkersPage"));
const SessionsPage = lazy(() => import("./pages/SessionsPage"));
const CockpitPage = lazy(() => import("./pages/CockpitPage"));
const RunDetailPage = lazy(() => import("./pages/RunDetailPage"));
const ArtifactsPage = lazy(() => import("./pages/ArtifactsPage"));
const ArtifactDetailPage = lazy(() => import("./pages/ArtifactDetailPage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const DiagramDetailPage = lazy(() => import("./pages/DiagramDetailPage"));
const DocDetailPage = lazy(() => import("./pages/DocDetailPage"));
const StudioDiscoveryPage = lazy(() => import("./pages/StudioDiscoveryPage"));
const StudioIdeationPage = lazy(() => import("./pages/StudioIdeationPage"));
const RuleProposalsPage = lazy(() => import("./pages/RuleProposalsPage"));
const CodeReviewPage = lazy(() => import("./pages/CodeReviewPage"));
const K8sPage = lazy(() => import("./pages/K8sPage"));
const MetricsPage = lazy(() => import("./pages/MetricsPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const AgentsDashboardPage = lazy(() => import("./pages/AgentsDashboardPage"));
const LLMConfigPage = lazy(() => import("./pages/LLMConfigPage"));
const AdminLabelsPage = lazy(() => import("./pages/AdminLabelsPage"));
const BrainflareHubPage = lazy(() => import("./pages/BrainflareHubPage"));
const ArchitectBoardPage = lazy(() => import("./pages/ArchitectBoardPage"));
const GuardrailsPage = lazy(() => import("./pages/GuardrailsPage"));
const CostDashboardPage = lazy(() => import("./pages/CostDashboardPage"));
import { DevOpsNotificationBanner } from "./components/devops";
import { useDevOpsActivity } from "./api/devops";
import { useDevOpsStore } from "./stores/devopsStore";

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
    const theme = localStorage.getItem("theme") || "dark";
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
              <Route index element={<Dashboard />} />
              <Route path="gates" element={<GatesPage />} />
              <Route path="gates/:gateId" element={<GateDetailPage />} />
              <Route path="workers" element={<WorkersPage />} />
              <Route path="sessions" element={<SessionsPage />} />
              <Route path="cockpit" element={<CockpitPage />} />
              <Route path="cockpit/runs/:runId" element={<RunDetailPage />} />
              <Route path="k8s" element={<K8sPage />} />
              <Route path="metrics" element={<MetricsPage />} />
              <Route path="agents" element={<AgentsDashboardPage />} />
              <Route path="artifacts" element={<ArtifactsPage />} />
              <Route path="artifacts/:artifactId" element={<ArtifactDetailPage />} />
              <Route path="docs" element={<DocsPage />} />
              <Route path="docs/diagrams/:diagramId" element={<DiagramDetailPage />} />
              <Route path="docs/:docPath" element={<DocDetailPage />} />
              <Route path="studio" element={<StudioDiscoveryPage />} />
              <Route path="studio/discovery" element={<Navigate to="/studio" replace />} />
              <Route path="studio/ideation" element={<StudioIdeationPage />} />
              <Route path="rules" element={<RuleProposalsPage />} />
              <Route path="review" element={<CodeReviewPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="admin/llm" element={<LLMConfigPage />} />
              <Route path="admin/labels" element={<AdminLabelsPage />} />
              <Route path="brainflare" element={<BrainflareHubPage />} />
              <Route path="guardrails" element={<GuardrailsPage />} />
              <Route path="costs" element={<CostDashboardPage />} />
              <Route path="architect" element={<ArchitectBoardPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
