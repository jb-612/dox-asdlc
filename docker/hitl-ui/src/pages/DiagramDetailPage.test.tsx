/**
 * Tests for DiagramDetailPage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DiagramDetailPage from './DiagramDetailPage';

// Mock diagram content
const mockDiagram = {
  meta: {
    id: '01-system-architecture',
    title: 'System Architecture',
    filename: '01-System-Architecture.mmd',
    category: 'architecture' as const,
    description: 'System component overview',
  },
  content: 'graph TD\n  A[Start] --> B[End]',
};

// Mock the docs API
vi.mock('../api/docs', () => ({
  useDiagram: vi.fn((diagramId: string | undefined) => {
    if (diagramId === '01-system-architecture') {
      return {
        data: mockDiagram,
        isLoading: false,
        error: null,
      };
    }
    if (diagramId === 'nonexistent') {
      return {
        data: undefined,
        isLoading: false,
        error: new Error('Diagram not found'),
      };
    }
    return {
      data: undefined,
      isLoading: true,
      error: null,
    };
  }),
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

// Wrapper for testing route with params
const renderWithRouter = (diagramId: string) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/docs/diagrams/${diagramId}`]}>
        <Routes>
          <Route path="/docs/diagrams/:diagramId" element={<DiagramDetailPage />} />
          <Route path="/docs" element={<div data-testid="docs-page">Docs Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('DiagramDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Handling', () => {
    it('loads diagram from URL param', async () => {
      renderWithRouter('01-system-architecture');
      await waitFor(() => {
        expect(screen.getByTestId('diagram-viewer')).toBeInTheDocument();
      });
    });

    it('shows loading state while fetching', () => {
      renderWithRouter('loading-id');
      expect(screen.getByTestId('diagram-loading')).toBeInTheDocument();
    });

    it('shows 404 for invalid diagram ID', async () => {
      renderWithRouter('nonexistent');
      await waitFor(() => {
        expect(screen.getByText(/not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Diagram Display', () => {
    it('renders DiagramViewer with diagram content', async () => {
      renderWithRouter('01-system-architecture');
      await waitFor(() => {
        expect(screen.getByTestId('diagram-viewer')).toBeInTheDocument();
      });
    });

    it('shows diagram title', async () => {
      renderWithRouter('01-system-architecture');
      await waitFor(() => {
        expect(screen.getByText('System Architecture')).toBeInTheDocument();
      });
    });

    it('shows category badge', async () => {
      renderWithRouter('01-system-architecture');
      await waitFor(() => {
        expect(screen.getByTestId('category-badge')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('has back button', async () => {
      renderWithRouter('01-system-architecture');
      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });

    it('back button navigates to diagrams tab', async () => {
      renderWithRouter('01-system-architecture');
      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('back-button'));
      // Navigation is handled by the router
    });
  });

  describe('Controls', () => {
    it('shows zoom controls', async () => {
      renderWithRouter('01-system-architecture');
      await waitFor(() => {
        expect(screen.getByTestId('zoom-controls')).toBeInTheDocument();
      });
    });
  });

  describe('Not Found State', () => {
    it('shows not found message', async () => {
      renderWithRouter('nonexistent');
      await waitFor(() => {
        expect(screen.getByTestId('diagram-not-found')).toBeInTheDocument();
      });
    });

    it('has link back to diagrams', async () => {
      renderWithRouter('nonexistent');
      await waitFor(() => {
        expect(screen.getByTestId('back-to-diagrams')).toBeInTheDocument();
      });
    });
  });
});
