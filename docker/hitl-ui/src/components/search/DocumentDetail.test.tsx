/**
 * Tests for DocumentDetail component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocumentDetail from './DocumentDetail';

// Mock the search hooks
vi.mock('../../api/searchHooks', () => ({
  useDocument: vi.fn(),
}));

import { useDocument } from '../../api/searchHooks';

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('DocumentDetail', () => {
  const mockDocument = {
    docId: 'src/core/interfaces.py:0',
    content: 'class KnowledgeStore(Protocol):\n    """Protocol for knowledge store backends."""',
    metadata: {
      file_path: 'src/core/interfaces.py',
      file_type: '.py',
      language: 'python',
      line_start: 14,
      line_end: 42,
      indexed_at: '2026-01-25T10:00:00Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading spinner while fetching', () => {
      vi.mocked(useDocument).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      render(
        <DocumentDetail docId="test-doc" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('document-loading')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error when document not found', () => {
      vi.mocked(useDocument).mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as any);

      render(
        <DocumentDetail docId="nonexistent" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('document-error')).toBeInTheDocument();
      expect(screen.getByText('Document Not Found')).toBeInTheDocument();
      expect(screen.getByText(/nonexistent/)).toBeInTheDocument();
    });

    it('shows error when fetch fails', () => {
      vi.mocked(useDocument).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error'),
      } as any);

      render(
        <DocumentDetail docId="test-doc" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('document-error')).toBeInTheDocument();
    });

    it('calls onClose when return button clicked on error', () => {
      vi.mocked(useDocument).mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as any);

      const onClose = vi.fn();
      render(
        <DocumentDetail docId="test-doc" onClose={onClose} />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText('Return to Search'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('document display', () => {
    beforeEach(() => {
      vi.mocked(useDocument).mockReturnValue({
        data: mockDocument,
        isLoading: false,
        error: null,
      } as any);
    });

    it('displays document content', () => {
      render(
        <DocumentDetail docId="src/core/interfaces.py:0" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('document-detail')).toBeInTheDocument();
      expect(screen.getByTestId('document-content')).toHaveTextContent(
        'class KnowledgeStore(Protocol)'
      );
    });

    it('displays file path', () => {
      render(
        <DocumentDetail docId="src/core/interfaces.py:0" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      // File path appears in multiple places (breadcrumb and header)
      expect(screen.getAllByText('src/core/interfaces.py').length).toBeGreaterThan(0);
    });

    it('displays language tag', () => {
      render(
        <DocumentDetail docId="src/core/interfaces.py:0" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('displays line range', () => {
      render(
        <DocumentDetail docId="src/core/interfaces.py:0" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Lines 14-42')).toBeInTheDocument();
    });

    it('displays indexed date', () => {
      render(
        <DocumentDetail docId="src/core/interfaces.py:0" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Indexed:/)).toBeInTheDocument();
    });

    it('displays document ID in footer', () => {
      render(
        <DocumentDetail docId="src/core/interfaces.py:0" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      expect(
        screen.getByText(/Document ID: src\/core\/interfaces\.py:0/)
      ).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      vi.mocked(useDocument).mockReturnValue({
        data: mockDocument,
        isLoading: false,
        error: null,
      } as any);
    });

    it('calls onClose when back button clicked', () => {
      const onClose = vi.fn();
      render(
        <DocumentDetail docId="src/core/interfaces.py:0" onClose={onClose} />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByTestId('back-button'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when close icon clicked', () => {
      const onClose = vi.fn();
      render(
        <DocumentDetail docId="src/core/interfaces.py:0" onClose={onClose} />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByLabelText('Close document'));
      expect(onClose).toHaveBeenCalled();
    });

    it('has breadcrumb navigation', () => {
      render(
        <DocumentDetail docId="src/core/interfaces.py:0" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(nav).toHaveTextContent('Search');
      expect(nav).toHaveTextContent('src/core/interfaces.py');
    });
  });

  describe('backend mode', () => {
    it('passes backend mode to useDocument', () => {
      vi.mocked(useDocument).mockReturnValue({
        data: mockDocument,
        isLoading: false,
        error: null,
      } as any);

      render(
        <DocumentDetail
          docId="test-doc"
          onClose={vi.fn()}
          backendMode="rest"
        />,
        { wrapper: createWrapper() }
      );

      expect(useDocument).toHaveBeenCalledWith('test-doc', { mode: 'rest' });
    });

    it('defaults to mock mode', () => {
      vi.mocked(useDocument).mockReturnValue({
        data: mockDocument,
        isLoading: false,
        error: null,
      } as any);

      render(
        <DocumentDetail docId="test-doc" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      );

      expect(useDocument).toHaveBeenCalledWith('test-doc', { mode: 'mock' });
    });
  });
});
