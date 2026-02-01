/**
 * Tests for AdminLabelsPage (P08-F03 T15)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminLabelsPage from './AdminLabelsPage';

// Mock the classification API
const mockLabels = [
  {
    id: 'feature',
    name: 'Feature',
    description: 'New functionality',
    keywords: ['add', 'new', 'create'],
    color: '#22c55e',
  },
  {
    id: 'bug',
    name: 'Bug',
    description: 'Something broken',
    keywords: ['fix', 'broken'],
    color: '#ef4444',
  },
  {
    id: 'enhancement',
    name: 'Enhancement',
    description: 'Improvement',
    keywords: ['improve', 'better', 'optimize'],
    color: '#3b82f6',
  },
];

let mockApiState = {
  error: null as Error | null,
  loading: false,
  labels: mockLabels,
};

const mockRefetch = vi.fn();
const mockCreateLabel = vi.fn();
const mockUpdateLabel = vi.fn();
const mockDeleteLabel = vi.fn();

vi.mock('../api/classification', () => ({
  useLabels: () => ({
    data: mockApiState.error ? undefined : mockApiState.labels,
    isLoading: mockApiState.loading,
    error: mockApiState.error,
    refetch: mockRefetch,
  }),
  useCreateLabel: () => ({
    mutateAsync: mockCreateLabel,
    isPending: false,
  }),
  useUpdateLabel: () => ({
    mutateAsync: mockUpdateLabel,
    isPending: false,
  }),
  useDeleteLabel: () => ({
    mutateAsync: mockDeleteLabel,
    isPending: false,
  }),
}));

describe('AdminLabelsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockApiState = {
      error: null,
      loading: false,
      labels: mockLabels,
    };
    vi.clearAllMocks();
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AdminLabelsPage />
      </QueryClientProvider>
    );
  };

  describe('Page Structure', () => {
    it('renders with data-testid', () => {
      renderPage();
      expect(screen.getByTestId('admin-labels-page')).toBeInTheDocument();
    });

    it('renders page title', () => {
      renderPage();
      expect(screen.getByText('Label Taxonomy')).toBeInTheDocument();
    });

    it('has role="main" for accessibility', () => {
      renderPage();
      expect(screen.getByTestId('admin-labels-page')).toHaveAttribute('role', 'main');
    });

    it('renders refresh button', () => {
      renderPage();
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('renders add label button', () => {
      renderPage();
      expect(screen.getByTestId('add-label-button')).toBeInTheDocument();
    });
  });

  describe('Labels List', () => {
    it('displays all labels', () => {
      renderPage();
      expect(screen.getByTestId('labels-list')).toBeInTheDocument();
      expect(screen.getByTestId('label-row-feature')).toBeInTheDocument();
      expect(screen.getByTestId('label-row-bug')).toBeInTheDocument();
      expect(screen.getByTestId('label-row-enhancement')).toBeInTheDocument();
    });

    it('shows label names', () => {
      renderPage();
      expect(screen.getByText('Feature')).toBeInTheDocument();
      expect(screen.getByText('Bug')).toBeInTheDocument();
      expect(screen.getByText('Enhancement')).toBeInTheDocument();
    });

    it('shows label descriptions', () => {
      renderPage();
      expect(screen.getByText('New functionality')).toBeInTheDocument();
      expect(screen.getByText('Something broken')).toBeInTheDocument();
    });

    it('shows keywords (limited to 3)', () => {
      renderPage();
      // Enhancement has 3 keywords, should show all
      expect(screen.getByText('improve')).toBeInTheDocument();
      expect(screen.getByText('better')).toBeInTheDocument();
      expect(screen.getByText('optimize')).toBeInTheDocument();
    });

    it('shows edit and delete buttons for each label', () => {
      renderPage();
      expect(screen.getByTestId('edit-feature')).toBeInTheDocument();
      expect(screen.getByTestId('delete-feature')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      mockApiState.loading = true;
      renderPage();
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText('Loading labels...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no labels', () => {
      mockApiState.labels = [];
      renderPage();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No labels defined yet.')).toBeInTheDocument();
    });

    it('has link to add first label in empty state', () => {
      mockApiState.labels = [];
      renderPage();
      expect(screen.getByText('Add your first label')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error state when API fails', () => {
      mockApiState.error = new Error('Failed to fetch labels');
      renderPage();
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText('Failed to load labels')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch labels')).toBeInTheDocument();
    });

    it('has try again button in error state', () => {
      mockApiState.error = new Error('Connection failed');
      renderPage();
      expect(screen.getByTestId('try-again-button')).toBeInTheDocument();
    });
  });

  describe('Add Label Form', () => {
    it('opens form when add button clicked', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByTestId('label-form')).toBeInTheDocument();
      expect(screen.getByText('New Label')).toBeInTheDocument();
    });

    it('closes form when close button clicked', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));
      expect(screen.getByTestId('label-form')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('close-form-button'));
      expect(screen.queryByTestId('label-form')).not.toBeInTheDocument();
    });

    it('closes form when cancel button clicked', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(screen.queryByTestId('label-form')).not.toBeInTheDocument();
    });

    it('has all form fields', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByTestId('label-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('label-id-input')).toBeInTheDocument();
      expect(screen.getByTestId('label-description-input')).toBeInTheDocument();
      expect(screen.getByTestId('label-keywords-input')).toBeInTheDocument();
      expect(screen.getByTestId('color-palette')).toBeInTheDocument();
    });

    it('shows preview as user types', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-name-input'), { target: { value: 'My Label' } });

      const preview = screen.getByTestId('label-preview');
      expect(preview).toHaveTextContent('My Label');
    });

    it('auto-generates ID from name', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-name-input'), { target: { value: 'My New Label' } });

      expect(screen.getByText('Will be: my-new-label')).toBeInTheDocument();
    });

    it('submits form with correct data', async () => {
      mockCreateLabel.mockResolvedValue({
        id: 'test-label',
        name: 'Test Label',
        keywords: ['test'],
        color: '#22c55e',
      });

      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-name-input'), { target: { value: 'Test Label' } });
      fireEvent.change(screen.getByTestId('label-keywords-input'), { target: { value: 'test, keyword' } });
      fireEvent.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(mockCreateLabel).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Label',
            keywords: ['test', 'keyword'],
          })
        );
      });
    });
  });

  describe('Edit Label Form', () => {
    it('opens form with label data when edit clicked', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('edit-feature'));

      expect(screen.getByTestId('label-form')).toBeInTheDocument();
      expect(screen.getByText('Edit Label')).toBeInTheDocument();
      expect(screen.getByTestId('label-name-input')).toHaveValue('Feature');
      expect(screen.getByTestId('label-description-input')).toHaveValue('New functionality');
    });

    it('hides ID field when editing', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('edit-feature'));

      expect(screen.queryByTestId('label-id-input')).not.toBeInTheDocument();
    });

    it('submits updates correctly', async () => {
      mockUpdateLabel.mockResolvedValue({
        id: 'feature',
        name: 'Updated Feature',
        keywords: ['add', 'new', 'create'],
        color: '#22c55e',
      });

      renderPage();

      fireEvent.click(screen.getByTestId('edit-feature'));
      fireEvent.change(screen.getByTestId('label-name-input'), { target: { value: 'Updated Feature' } });
      fireEvent.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(mockUpdateLabel).toHaveBeenCalledWith({
          id: 'feature',
          updates: expect.objectContaining({
            name: 'Updated Feature',
          }),
        });
      });
    });
  });

  describe('Delete Label', () => {
    it('shows confirmation when delete clicked', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('delete-feature'));

      expect(screen.getByText('Delete?')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-delete-feature')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-delete-feature')).toBeInTheDocument();
    });

    it('cancels delete when cancel clicked', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('delete-feature'));
      fireEvent.click(screen.getByTestId('cancel-delete-feature'));

      expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
      expect(screen.getByTestId('delete-feature')).toBeInTheDocument();
    });

    it('deletes label when confirmed', async () => {
      mockDeleteLabel.mockResolvedValue(undefined);

      renderPage();

      fireEvent.click(screen.getByTestId('delete-feature'));
      fireEvent.click(screen.getByTestId('confirm-delete-feature'));

      await waitFor(() => {
        expect(mockDeleteLabel).toHaveBeenCalledWith('feature');
      });
    });
  });

  describe('Color Picker', () => {
    it('renders color palette', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByTestId('color-palette')).toBeInTheDocument();
      // Should have multiple color options
      expect(screen.getByTestId('color-#22c55e')).toBeInTheDocument();
      expect(screen.getByTestId('color-#ef4444')).toBeInTheDocument();
    });

    it('updates preview when color selected', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-name-input'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByTestId('color-#ef4444'));

      const preview = screen.getByTestId('label-preview');
      expect(preview).toHaveStyle({ color: '#ef4444' });
    });

    it('has custom color picker', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByTestId('custom-color-picker')).toBeInTheDocument();
    });
  });

  describe('Refresh', () => {
    it('calls refetch when refresh clicked', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('refresh-button'));

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('disables refresh button while loading', () => {
      mockApiState.loading = true;
      renderPage();

      expect(screen.getByTestId('refresh-button')).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('disables save button when name is empty', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByTestId('save-button')).toBeDisabled();
    });

    it('enables save button when name is filled', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-name-input'), { target: { value: 'Test' } });

      expect(screen.getByTestId('save-button')).toBeEnabled();
    });
  });
});
