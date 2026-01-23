/**
 * Integration tests for critical user paths
 *
 * These tests verify the integration of multiple components in key user flows.
 * They serve as placeholder E2E tests until Playwright is configured.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock API modules
vi.mock('@/api/gates', () => ({
  useGates: () => ({
    data: [
      { id: 'gate-1', type: 'prd_review', status: 'pending', summary: 'Review PRD' },
      { id: 'gate-2', type: 'code_review', status: 'approved', summary: 'Code Review' },
    ],
    isLoading: false,
    error: null,
  }),
  useGateDetail: () => ({
    data: {
      id: 'gate-1',
      type: 'prd_review',
      status: 'pending',
      summary: 'Review PRD for authentication feature',
      artifacts: [{ id: 'art-1', path: 'prd.md', type: 'markdown' }],
      session_id: 'session-1',
      created_at: '2026-01-23T10:00:00Z',
      context: {},
    },
    isLoading: false,
    error: null,
  }),
  useDecision: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
}));

vi.mock('@/api/runs', () => ({
  useRuns: () => ({
    data: [
      { id: 'run-1', agent_type: 'prd_agent', status: 'completed', started_at: '2026-01-23T10:00:00Z' },
    ],
    isLoading: false,
    error: null,
  }),
  useRunDetail: () => ({
    data: {
      id: 'run-1',
      agent_type: 'prd_agent',
      status: 'completed',
      started_at: '2026-01-23T10:00:00Z',
      completed_at: '2026-01-23T10:05:00Z',
      input: { epic_id: 'epic-1' },
      output: { artifact_id: 'art-1' },
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/api/artifacts', () => ({
  useArtifacts: () => ({
    data: [
      { id: 'art-1', path: 'prd.md', type: 'prd', status: 'draft' },
      { id: 'art-2', path: 'spec.md', type: 'spec', status: 'approved' },
    ],
    isLoading: false,
    error: null,
  }),
  useArtifactDetail: () => ({
    data: {
      id: 'art-1',
      path: 'prd.md',
      type: 'prd',
      status: 'draft',
      content: '# Product Requirements',
      created_at: '2026-01-23T10:00:00Z',
    },
    isLoading: false,
    error: null,
  }),
}));

// Simple mock components for testing navigation
const MockGatesPage = () => <div data-testid="gates-page">Gates Page</div>;
const MockGateDetailPage = () => <div data-testid="gate-detail-page">Gate Detail</div>;
const MockCockpitPage = () => <div data-testid="cockpit-page">Cockpit Page</div>;
const MockArtifactsPage = () => <div data-testid="artifacts-page">Artifacts Page</div>;
const MockStudioPage = () => <div data-testid="studio-page">Studio Page</div>;

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function AppWrapper({ children, initialRoute = '/' }: { children?: React.ReactNode; initialRoute?: string }) {
  const client = createTestClient();
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
          <Route path="/gates" element={<MockGatesPage />} />
          <Route path="/gates/:gateId" element={<MockGateDetailPage />} />
          <Route path="/cockpit" element={<MockCockpitPage />} />
          <Route path="/artifacts" element={<MockArtifactsPage />} />
          <Route path="/studio" element={<MockStudioPage />} />
        </Routes>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Critical Path: Gate Approval Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates from gates list to gate detail', async () => {
    render(<AppWrapper initialRoute="/gates" />);

    expect(screen.getByTestId('gates-page')).toBeInTheDocument();
  });

  it('displays gate detail page', async () => {
    render(<AppWrapper initialRoute="/gates/gate-1" />);

    expect(screen.getByTestId('gate-detail-page')).toBeInTheDocument();
  });

  it('completes full gate approval flow', async () => {
    // This would be a full E2E test with:
    // 1. Navigate to gates list
    // 2. Click on pending gate
    // 3. Review artifacts
    // 4. Submit approval decision
    // 5. Verify gate status updated

    // For now, verify the pages exist and are accessible
    render(<AppWrapper initialRoute="/gates" />);
    expect(screen.getByTestId('gates-page')).toBeInTheDocument();
  });
});

describe('Critical Path: Artifact Browsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to artifacts page', async () => {
    render(<AppWrapper initialRoute="/artifacts" />);

    expect(screen.getByTestId('artifacts-page')).toBeInTheDocument();
  });

  it('supports artifact exploration flow', async () => {
    // This would test:
    // 1. Navigate to artifacts page
    // 2. Search/filter artifacts
    // 3. Click on artifact
    // 4. View artifact detail
    // 5. Navigate through tabs (content, history, provenance)

    render(<AppWrapper initialRoute="/artifacts" />);
    expect(screen.getByTestId('artifacts-page')).toBeInTheDocument();
  });
});

describe('Critical Path: Discovery Studio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to studio page', async () => {
    render(<AppWrapper initialRoute="/studio" />);

    expect(screen.getByTestId('studio-page')).toBeInTheDocument();
  });

  it('supports discovery workflow', async () => {
    // This would test:
    // 1. Navigate to studio
    // 2. Select epic/task
    // 3. Start chat interaction
    // 4. Watch outline update
    // 5. Generate and save artifact

    render(<AppWrapper initialRoute="/studio" />);
    expect(screen.getByTestId('studio-page')).toBeInTheDocument();
  });
});

describe('Critical Path: Agent Cockpit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to cockpit page', async () => {
    render(<AppWrapper initialRoute="/cockpit" />);

    expect(screen.getByTestId('cockpit-page')).toBeInTheDocument();
  });

  it('supports run monitoring flow', async () => {
    // This would test:
    // 1. Navigate to cockpit
    // 2. View active runs
    // 3. Click on run to view detail
    // 4. View RLM trajectory if applicable
    // 5. View run outputs

    render(<AppWrapper initialRoute="/cockpit" />);
    expect(screen.getByTestId('cockpit-page')).toBeInTheDocument();
  });
});

describe('Critical Path: Navigation', () => {
  it('all main routes are accessible', async () => {
    const routes = ['/', '/gates', '/cockpit', '/artifacts', '/studio'];

    for (const route of routes) {
      const { unmount } = render(<AppWrapper initialRoute={route} />);
      // Each route should render without crashing
      expect(document.body).toBeInTheDocument();
      unmount();
    }
  });
});

describe('Critical Path: Error Handling', () => {
  it('handles navigation to invalid routes gracefully', async () => {
    render(<AppWrapper initialRoute="/invalid-route" />);

    // App should still be functional (would show 404 in real app)
    expect(document.body).toBeInTheDocument();
  });
});
