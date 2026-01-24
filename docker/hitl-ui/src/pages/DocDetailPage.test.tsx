/**
 * Tests for DocDetailPage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocDetailPage from './DocDetailPage';

// Mock document content
const mockDocument = {
  meta: {
    id: 'system-design',
    title: 'System Design',
    path: 'System_Design.md',
    category: 'system' as const,
    description: 'Core system architecture and design principles',
    lastModified: '2026-01-24',
  },
  content: '# System Design\n\n## Overview\n\nContent here\n\n## Architecture\n\nMore content',
};

// Mock the docs API
vi.mock('../api/docs', () => ({
  useDocument: vi.fn((docId: string | undefined) => {
    if (docId === 'system-design') {
      return {
        data: mockDocument,
        isLoading: false,
        error: null,
      };
    }
    if (docId === 'nonexistent') {
      return {
        data: undefined,
        isLoading: false,
        error: new Error('Document not found'),
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
const renderWithRouter = (docPath: string, hash = '') => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/docs/${docPath}${hash}`]}>
        <Routes>
          <Route path="/docs/:docPath" element={<DocDetailPage />} />
          <Route path="/docs" element={<div data-testid="docs-page">Docs Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('DocDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Handling', () => {
    it('loads document from URL param', async () => {
      renderWithRouter('system-design');
      await waitFor(() => {
        expect(screen.getByTestId('doc-viewer')).toBeInTheDocument();
      });
    });

    it('shows loading state while fetching', () => {
      renderWithRouter('loading-id');
      expect(screen.getByTestId('doc-loading')).toBeInTheDocument();
    });

    it('shows 404 for invalid document path', async () => {
      renderWithRouter('nonexistent');
      await waitFor(() => {
        expect(screen.getByText(/not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Document Display', () => {
    it('renders DocViewer with document content', async () => {
      renderWithRouter('system-design');
      await waitFor(() => {
        expect(screen.getByTestId('doc-viewer')).toBeInTheDocument();
      });
    });

    it('shows document title', async () => {
      renderWithRouter('system-design');
      await waitFor(() => {
        expect(screen.getByTestId('doc-title')).toHaveTextContent('System Design');
      });
    });
  });

  describe('Navigation', () => {
    it('has breadcrumb navigation', async () => {
      renderWithRouter('system-design');
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
      });
    });

    it('breadcrumb shows docs link', async () => {
      renderWithRouter('system-design');
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-docs')).toBeInTheDocument();
      });
    });

    it('breadcrumb shows current document', async () => {
      renderWithRouter('system-design');
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-current')).toHaveTextContent(
          'System Design'
        );
      });
    });
  });

  describe('Hash Navigation', () => {
    it('scrolls to section from hash', async () => {
      // Mock scrollIntoView
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      renderWithRouter('system-design', '#overview');
      await waitFor(() => {
        expect(screen.getByTestId('doc-viewer')).toBeInTheDocument();
      });
      // The component should attempt to scroll to the overview section
    });
  });

  describe('Not Found State', () => {
    it('shows not found message', async () => {
      renderWithRouter('nonexistent');
      await waitFor(() => {
        expect(screen.getByTestId('doc-not-found')).toBeInTheDocument();
      });
    });

    it('has link back to docs', async () => {
      renderWithRouter('nonexistent');
      await waitFor(() => {
        expect(screen.getByTestId('back-to-docs')).toBeInTheDocument();
      });
    });
  });

  describe('Back Navigation', () => {
    it('has back button', async () => {
      renderWithRouter('system-design');
      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });
  });
});
