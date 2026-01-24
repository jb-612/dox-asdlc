/**
 * Integration tests for DocsPage
 *
 * Tests end-to-end navigation flows, search integration,
 * URL deep linking, and cross-component interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocsPage from './DocsPage';
import DiagramDetailPage from './DiagramDetailPage';
import DocDetailPage from './DocDetailPage';

// Mock the docs API hooks
vi.mock('../api/docs', () => ({
  useDocuments: vi.fn(() => ({
    data: [
      {
        id: 'system-design',
        title: 'System Design',
        path: 'System_Design.md',
        category: 'system',
        description: 'Core system architecture',
      },
      {
        id: 'main-features',
        title: 'Main Features',
        path: 'Main_Features.md',
        category: 'feature',
        description: 'Feature specifications',
      },
    ],
    isLoading: false,
    error: null,
  })),
  useDiagrams: vi.fn(() => ({
    data: [
      {
        id: '01-system-architecture',
        title: 'System Architecture',
        filename: '01-System-Architecture.mmd',
        category: 'architecture',
        description: 'System component overview',
      },
      {
        id: '03-discovery-flow',
        title: 'Discovery Flow',
        filename: '03-Discovery-Flow.mmd',
        category: 'flow',
        description: 'Discovery phase workflow',
      },
    ],
    isLoading: false,
    error: null,
  })),
  useDocument: vi.fn(() => ({
    data: {
      meta: {
        id: 'system-design',
        title: 'System Design',
        path: 'System_Design.md',
        category: 'system',
        description: 'Core system architecture',
      },
      content: '# System Design\n\nContent here',
    },
    isLoading: false,
    error: null,
  })),
  useDiagram: vi.fn(() => ({
    data: {
      meta: {
        id: '01-system-architecture',
        title: 'System Architecture',
        filename: '01-System-Architecture.mmd',
        category: 'architecture',
        description: 'System component overview',
      },
      content: 'graph TD; A-->B',
    },
    isLoading: false,
    error: null,
  })),
}));

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({
      svg: '<svg><g>Test SVG</g></svg>',
    }),
  },
}));

// Create a fresh query client for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// Full app wrapper with routing
const renderWithRouting = (
  { route = '/docs' }: { route?: string } = {}
) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/docs/diagrams/:diagramId" element={<DiagramDetailPage />} />
          <Route path="/docs/:docId" element={<DocDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('DocsPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Tab Navigation Flow', () => {
    it('navigates from Overview to Diagrams tab', () => {
      renderWithRouting();

      // Start on Overview
      expect(screen.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('blueprint-map')).toBeInTheDocument();

      // Navigate to Diagrams
      fireEvent.click(screen.getByTestId('tab-diagrams'));

      expect(screen.getByTestId('tab-diagrams')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('diagram-gallery')).toBeInTheDocument();
    });

    it('navigates from Diagrams to Reference tab', () => {
      renderWithRouting({ route: '/docs?tab=diagrams' });

      // Start on Diagrams
      expect(screen.getByTestId('tab-diagrams')).toHaveAttribute('aria-selected', 'true');

      // Navigate to Reference
      fireEvent.click(screen.getByTestId('tab-reference'));

      expect(screen.getByTestId('tab-reference')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('doc-browser')).toBeInTheDocument();
    });

    it('navigates from Reference to Glossary tab', () => {
      renderWithRouting({ route: '/docs?tab=reference' });

      // Start on Reference
      expect(screen.getByTestId('tab-reference')).toHaveAttribute('aria-selected', 'true');

      // Navigate to Glossary
      fireEvent.click(screen.getByTestId('tab-glossary'));

      expect(screen.getByTestId('tab-glossary')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('interactive-glossary')).toBeInTheDocument();
    });

    it('navigates back from Glossary to Overview', () => {
      renderWithRouting({ route: '/docs?tab=glossary' });

      // Start on Glossary
      expect(screen.getByTestId('tab-glossary')).toHaveAttribute('aria-selected', 'true');

      // Navigate to Overview
      fireEvent.click(screen.getByTestId('tab-overview'));

      expect(screen.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('blueprint-map')).toBeInTheDocument();
    });
  });

  describe('Search to Navigation Flow', () => {
    it('search for document navigates to Reference tab', async () => {
      renderWithRouting();

      // Start on Overview
      expect(screen.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');

      // Search for a document
      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system design' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      // Click search result
      fireEvent.click(screen.getByTestId('search-result-system-design'));

      // Should navigate to Reference tab
      await waitFor(() => {
        expect(screen.getByTestId('tab-reference')).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('search for diagram navigates to Diagrams tab', async () => {
      renderWithRouting();

      // Start on Overview
      expect(screen.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');

      // Search for a diagram
      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'architecture' } });

      await waitFor(() => {
        expect(screen.getByText('System Architecture')).toBeInTheDocument();
      });

      // Click search result
      fireEvent.click(screen.getByTestId('search-result-01-system-architecture'));

      // Should navigate to Diagrams tab
      await waitFor(() => {
        expect(screen.getByTestId('tab-diagrams')).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('search clears after selection', async () => {
      renderWithRouting();

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('search-result-system-design'));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('URL Deep Linking', () => {
    it('opens Overview tab with ?tab=overview', () => {
      renderWithRouting({ route: '/docs?tab=overview' });

      expect(screen.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('blueprint-map')).toBeInTheDocument();
    });

    it('opens Diagrams tab with ?tab=diagrams', () => {
      renderWithRouting({ route: '/docs?tab=diagrams' });

      expect(screen.getByTestId('tab-diagrams')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('diagram-gallery')).toBeInTheDocument();
    });

    it('opens Reference tab with ?tab=reference', () => {
      renderWithRouting({ route: '/docs?tab=reference' });

      expect(screen.getByTestId('tab-reference')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('doc-browser')).toBeInTheDocument();
    });

    it('opens Glossary tab with ?tab=glossary', () => {
      renderWithRouting({ route: '/docs?tab=glossary' });

      expect(screen.getByTestId('tab-glossary')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('interactive-glossary')).toBeInTheDocument();
    });

    it('defaults to Overview for invalid tab parameter', () => {
      renderWithRouting({ route: '/docs?tab=invalid' });

      expect(screen.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');
    });

    it('defaults to Overview when no tab parameter', () => {
      renderWithRouting({ route: '/docs' });

      expect(screen.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Reference Tab Document Selection', () => {
    it('selects document from browser and shows viewer', async () => {
      renderWithRouting({ route: '/docs?tab=reference' });

      // Doc browser should be visible
      expect(screen.getByTestId('doc-browser')).toBeInTheDocument();

      // Click a document
      fireEvent.click(screen.getByTestId('doc-system-design'));

      // Viewer should appear
      await waitFor(() => {
        expect(screen.getByTestId('doc-viewer')).toBeInTheDocument();
      });
    });

    it('shows empty state when no document selected', () => {
      renderWithRouting({ route: '/docs?tab=reference' });

      expect(screen.getByText(/select a document to view/i)).toBeInTheDocument();
    });
  });

  describe('Diagrams Tab Gallery Interaction', () => {
    it('filters diagrams by category', async () => {
      renderWithRouting({ route: '/docs?tab=diagrams' });

      // Both diagrams visible initially
      expect(screen.getByTestId('diagram-card-01-system-architecture')).toBeInTheDocument();
      expect(screen.getByTestId('diagram-card-03-discovery-flow')).toBeInTheDocument();

      // Filter by architecture
      fireEvent.click(screen.getByTestId('filter-architecture'));

      // Only architecture diagram visible
      expect(screen.getByTestId('diagram-card-01-system-architecture')).toBeInTheDocument();
      expect(screen.queryByTestId('diagram-card-03-discovery-flow')).not.toBeInTheDocument();
    });

    it('shows all diagrams when All filter selected', async () => {
      renderWithRouting({ route: '/docs?tab=diagrams' });

      // Filter by architecture first
      fireEvent.click(screen.getByTestId('filter-architecture'));

      // Then show all
      fireEvent.click(screen.getByTestId('filter-all'));

      expect(screen.getByTestId('diagram-card-01-system-architecture')).toBeInTheDocument();
      expect(screen.getByTestId('diagram-card-03-discovery-flow')).toBeInTheDocument();
    });
  });

  describe('Glossary Tab Interaction', () => {
    it('filters terms by search', async () => {
      renderWithRouting({ route: '/docs?tab=glossary' });

      // Search for a term
      const searchInput = screen.getByTestId('glossary-search');
      fireEvent.change(searchInput, { target: { value: 'agent' } });

      // Agent term should be visible
      expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    it('filters terms by category', async () => {
      renderWithRouting({ route: '/docs?tab=glossary' });

      // Click on Artifacts category
      fireEvent.click(screen.getByTestId('category-artifact'));

      // Only artifact terms should be shown
      expect(screen.queryByText('Gate')).not.toBeInTheDocument();
    });
  });

  describe('Overview Tab Interaction', () => {
    it('BlueprintMap clusters are expandable', () => {
      renderWithRouting();

      const cluster = screen.getByTestId('cluster-discovery');
      fireEvent.click(cluster);

      expect(screen.getByTestId('cluster-items-discovery')).toBeInTheDocument();
    });

    it('MethodologyStepper can navigate stages', () => {
      renderWithRouting();

      expect(screen.getByText(/stage 1 of 8/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('next-button'));

      expect(screen.getByText(/stage 2 of 8/i)).toBeInTheDocument();
    });
  });

  describe('Mobile Responsive Behavior', () => {
    it('sidebar toggle button exists on Reference tab', () => {
      renderWithRouting({ route: '/docs?tab=reference' });

      expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument();
    });

    it('sidebar toggle hides/shows browser', () => {
      renderWithRouting({ route: '/docs?tab=reference' });

      const toggle = screen.getByTestId('sidebar-toggle');
      const container = screen.getByTestId('doc-browser-container');

      // Initially visible
      expect(container).not.toHaveClass('hidden');

      // Hide
      fireEvent.click(toggle);
      expect(container).toHaveClass('hidden');

      // Show again
      fireEvent.click(toggle);
      expect(container).not.toHaveClass('hidden');
    });
  });
});
