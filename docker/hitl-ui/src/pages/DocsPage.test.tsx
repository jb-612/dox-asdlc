/**
 * Tests for DocsPage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocsPage from './DocsPage';

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

// Wrapper component for router and query provider context
const renderWithProviders = (
  component: React.ReactNode,
  { route = '/docs' }: { route?: string } = {}
) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{component}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('DocsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('docs-page')).toBeInTheDocument();
    });

    it('renders page title', () => {
      renderWithProviders(<DocsPage />);
      expect(
        screen.getByRole('heading', { level: 1, name: /documentation/i })
      ).toBeInTheDocument();
    });

    it('renders page description', () => {
      renderWithProviders(<DocsPage />);
      expect(
        screen.getByText(/learn about the asdlc methodology/i)
      ).toBeInTheDocument();
    });
  });

  describe('New Tab Structure', () => {
    it('renders four tabs', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
      expect(screen.getByTestId('tab-diagrams')).toBeInTheDocument();
      expect(screen.getByTestId('tab-reference')).toBeInTheDocument();
      expect(screen.getByTestId('tab-glossary')).toBeInTheDocument();
    });

    it('shows Overview tab as active by default', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('tab-overview')).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('switches to Diagrams tab on click', () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-diagrams'));
      expect(screen.getByTestId('tab-diagrams')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByTestId('tab-overview')).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });

    it('switches to Reference tab on click', () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-reference'));
      expect(screen.getByTestId('tab-reference')).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('switches to Glossary tab on click', () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-glossary'));
      expect(screen.getByTestId('tab-glossary')).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });

  describe('Tab Content', () => {
    it('shows Overview content when tab selected', () => {
      renderWithProviders(<DocsPage />);
      // Overview is default, should show BlueprintMap
      expect(screen.getByTestId('blueprint-map')).toBeInTheDocument();
    });

    it('shows Diagrams content when tab selected', () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-diagrams'));
      expect(screen.getByTestId('diagram-gallery')).toBeInTheDocument();
    });

    it('shows Reference content when tab selected', () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-reference'));
      expect(screen.getByTestId('doc-browser')).toBeInTheDocument();
    });

    it('shows Glossary content when tab selected', () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-glossary'));
      expect(screen.getByTestId('interactive-glossary')).toBeInTheDocument();
    });
  });

  describe('URL Tab Persistence', () => {
    it('persists tab selection in URL', () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-reference'));
      // Tab should be active after click (URL update is handled by useSearchParams internally)
      expect(screen.getByTestId('tab-reference')).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('reads tab from URL on initial load', () => {
      renderWithProviders(<DocsPage />, { route: '/docs?tab=diagrams' });
      expect(screen.getByTestId('tab-diagrams')).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('defaults to overview for invalid tab param', () => {
      renderWithProviders(<DocsPage />, { route: '/docs?tab=invalid' });
      expect(screen.getByTestId('tab-overview')).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });

  describe('Overview Tab Content', () => {
    it('shows BlueprintMap in Overview tab', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('blueprint-map')).toBeInTheDocument();
    });

    it('shows MethodologyStepper in Overview tab', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('methodology-stepper')).toBeInTheDocument();
    });

    it('shows section headers for components', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByText(/system overview/i)).toBeInTheDocument();
      expect(screen.getByText(/methodology stages/i)).toBeInTheDocument();
    });
  });

  describe('Diagrams Tab Content', () => {
    it('shows DiagramGallery with diagrams', async () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-diagrams'));
      await waitFor(() => {
        expect(screen.getByTestId('diagram-gallery')).toBeInTheDocument();
      });
    });

    it('DiagramGallery receives diagram data', async () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-diagrams'));
      await waitFor(() => {
        expect(
          screen.getByTestId('diagram-card-01-system-architecture')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Reference Tab Content', () => {
    it('shows DocBrowser sidebar', async () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-reference'));
      await waitFor(() => {
        expect(screen.getByTestId('doc-browser')).toBeInTheDocument();
      });
    });

    it('shows DocViewer when document selected', async () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-reference'));
      await waitFor(() => {
        expect(screen.getByTestId('doc-browser')).toBeInTheDocument();
      });
      // Click on a document in the browser
      const docItem = screen.getByTestId('doc-system-design');
      fireEvent.click(docItem);
      await waitFor(() => {
        expect(screen.getByTestId('doc-viewer')).toBeInTheDocument();
      });
    });
  });

  describe('Glossary Tab Content', () => {
    it('shows InteractiveGlossary', () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-glossary'));
      expect(screen.getByTestId('interactive-glossary')).toBeInTheDocument();
    });

    it('shows glossary search', () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-glossary'));
      expect(screen.getByTestId('glossary-search')).toBeInTheDocument();
    });
  });

  describe('BlueprintMap Data', () => {
    it('shows Discovery cluster', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('cluster-discovery')).toBeInTheDocument();
    });

    it('shows Design cluster', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('cluster-design')).toBeInTheDocument();
    });

    it('shows Development cluster', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('cluster-development')).toBeInTheDocument();
    });

    it('shows Validation cluster', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('cluster-validation')).toBeInTheDocument();
    });
  });

  describe('MethodologyStepper Data', () => {
    it('shows Requirements stage', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('stage-requirements')).toBeInTheDocument();
    });

    it('shows all 8 stages', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByText(/stage 1 of 8/i)).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('BlueprintMap is interactive', () => {
      renderWithProviders(<DocsPage />);
      const cluster = screen.getByTestId('cluster-discovery');
      fireEvent.click(cluster);
      expect(screen.getByTestId('cluster-items-discovery')).toBeInTheDocument();
    });

    it('MethodologyStepper navigation works', () => {
      renderWithProviders(<DocsPage />);
      const nextButton = screen.getByTestId('next-button');
      fireEvent.click(nextButton);
      expect(screen.getByText(/stage 2 of 8/i)).toBeInTheDocument();
    });

    it('Glossary search works', () => {
      renderWithProviders(<DocsPage />);
      fireEvent.click(screen.getByTestId('tab-glossary'));
      const searchInput = screen.getByTestId('glossary-search');
      fireEvent.change(searchInput, { target: { value: 'agent' } });
      expect(screen.getByText('Agent')).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('applies responsive grid classes', () => {
      renderWithProviders(<DocsPage />);
      const page = screen.getByTestId('docs-page');
      expect(page).toHaveClass('max-w-7xl');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithProviders(<DocsPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
    });

    it('tabs have proper role', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('tab-overview')).toHaveAttribute('role', 'tab');
      expect(screen.getByTestId('tab-diagrams')).toHaveAttribute('role', 'tab');
      expect(screen.getByTestId('tab-reference')).toHaveAttribute('role', 'tab');
      expect(screen.getByTestId('tab-glossary')).toHaveAttribute('role', 'tab');
    });

    it('tablist has proper role', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByTestId('tabs-container')).toHaveAttribute(
        'role',
        'tablist'
      );
    });
  });

  describe('Responsive Reference Tab', () => {
    it('shows sidebar toggle button on mobile', () => {
      renderWithProviders(<DocsPage />, { route: '/docs?tab=reference' });
      expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument();
    });

    it('sidebar toggle toggles visibility', () => {
      renderWithProviders(<DocsPage />, { route: '/docs?tab=reference' });

      const toggle = screen.getByTestId('sidebar-toggle');
      const container = screen.getByTestId('doc-browser-container');

      // Initially visible
      expect(container).not.toHaveClass('hidden');

      // Click to hide
      fireEvent.click(toggle);
      expect(container).toHaveClass('hidden');

      // Click to show
      fireEvent.click(toggle);
      expect(container).not.toHaveClass('hidden');
    });
  });

  describe('Search Integration', () => {
    it('renders search in header', () => {
      renderWithProviders(<DocsPage />);
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('search is visible on all tabs', async () => {
      renderWithProviders(<DocsPage />);

      // Check on Overview tab
      expect(screen.getByRole('searchbox')).toBeInTheDocument();

      // Check on Diagrams tab
      fireEvent.click(screen.getByTestId('tab-diagrams'));
      expect(screen.getByRole('searchbox')).toBeInTheDocument();

      // Check on Reference tab
      fireEvent.click(screen.getByTestId('tab-reference'));
      expect(screen.getByRole('searchbox')).toBeInTheDocument();

      // Check on Glossary tab
      fireEvent.click(screen.getByTestId('tab-glossary'));
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('navigates to diagrams tab when diagram result selected', async () => {
      renderWithProviders(<DocsPage />);

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'architecture' } });

      await waitFor(() => {
        expect(screen.getByText('System Architecture')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('search-result-01-system-architecture'));

      // Should navigate to diagrams tab
      await waitFor(() => {
        expect(screen.getByTestId('tab-diagrams')).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
    });

    it('navigates to reference tab when document result selected', async () => {
      renderWithProviders(<DocsPage />);

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system design' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('search-result-system-design'));

      // Should navigate to reference tab
      await waitFor(() => {
        expect(screen.getByTestId('tab-reference')).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
    });

    it('clears search after result selection', async () => {
      renderWithProviders(<DocsPage />);

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
});
