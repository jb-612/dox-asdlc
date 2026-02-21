/**
 * Tests for DocBrowser component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocBrowser from './DocBrowser';
import type { DocumentMeta } from '../../api/types';

const mockDocuments: DocumentMeta[] = [
  {
    id: 'system-design',
    title: 'System Design',
    path: 'System_Design.md',
    category: 'system',
    description: 'Core system architecture and design principles',
    lastModified: '2026-01-21',
  },
  {
    id: 'main-features',
    title: 'Main Features',
    path: 'Main_Features.md',
    category: 'feature',
    description: 'Feature specifications and capabilities',
    lastModified: '2026-01-21',
  },
  {
    id: 'development-workflow',
    title: 'Development Workflow',
    path: 'Development_Workflow.md',
    category: 'workflow',
    description: 'TDD workflow and development practices',
    lastModified: '2026-01-20',
  },
  {
    id: 'architecture-overview',
    title: 'Architecture Overview',
    path: 'Architecture_Overview.md',
    category: 'architecture',
    description: 'High-level architecture and component interactions',
    lastModified: '2026-01-18',
  },
];

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe('DocBrowser', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
      expect(screen.getByTestId('doc-browser')).toBeInTheDocument();
    });

    it('renders all documents', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
      expect(screen.getByText('System Design')).toBeInTheDocument();
      expect(screen.getByText('Main Features')).toBeInTheDocument();
      expect(screen.getByText('Development Workflow')).toBeInTheDocument();
      expect(screen.getByText('Architecture Overview')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} className="my-custom-class" />);
      expect(screen.getByTestId('doc-browser')).toHaveClass('my-custom-class');
    });
  });

  describe('Category Grouping', () => {
    it('groups documents by category', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
      expect(screen.getByTestId('category-system')).toBeInTheDocument();
      expect(screen.getByTestId('category-feature')).toBeInTheDocument();
      expect(screen.getByTestId('category-workflow')).toBeInTheDocument();
      expect(screen.getByTestId('category-architecture')).toBeInTheDocument();
    });

    it('displays category labels correctly', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
      expect(screen.getByText('System')).toBeInTheDocument();
      expect(screen.getByText('Feature')).toBeInTheDocument();
      expect(screen.getByText('Workflow')).toBeInTheDocument();
      expect(screen.getByText('Architecture')).toBeInTheDocument();
    });

    it('places documents under correct categories', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);

      // System category should contain System Design document
      const systemCategory = screen.getByTestId('category-system');
      expect(systemCategory).toContainElement(screen.getByTestId('doc-system-design'));

      // Feature category should contain Main Features document
      const featureCategory = screen.getByTestId('category-feature');
      expect(featureCategory).toContainElement(screen.getByTestId('doc-main-features'));
    });
  });

  describe('Document Items', () => {
    it('renders document items with correct test IDs', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
      expect(screen.getByTestId('doc-system-design')).toBeInTheDocument();
      expect(screen.getByTestId('doc-main-features')).toBeInTheDocument();
      expect(screen.getByTestId('doc-development-workflow')).toBeInTheDocument();
      expect(screen.getByTestId('doc-architecture-overview')).toBeInTheDocument();
    });

    it('displays document descriptions', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
      expect(screen.getByText('Core system architecture and design principles')).toBeInTheDocument();
      expect(screen.getByText('Feature specifications and capabilities')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('calls onSelect when document clicked', () => {
      const onSelect = vi.fn();
      render(<DocBrowser documents={mockDocuments} onSelect={onSelect} />);

      fireEvent.click(screen.getByTestId('doc-system-design'));
      expect(onSelect).toHaveBeenCalledWith('system-design');
    });

    it('calls onSelect with correct ID for each document', () => {
      const onSelect = vi.fn();
      render(<DocBrowser documents={mockDocuments} onSelect={onSelect} />);

      fireEvent.click(screen.getByTestId('doc-main-features'));
      expect(onSelect).toHaveBeenCalledWith('main-features');
    });

    it('highlights selected document', () => {
      render(
        <DocBrowser
          documents={mockDocuments}
          selectedId="system-design"
          onSelect={vi.fn()}
        />
      );
      expect(screen.getByTestId('doc-system-design')).toHaveClass('selected');
    });

    it('does not highlight non-selected documents', () => {
      render(
        <DocBrowser
          documents={mockDocuments}
          selectedId="system-design"
          onSelect={vi.fn()}
        />
      );
      expect(screen.getByTestId('doc-main-features')).not.toHaveClass('selected');
    });
  });

  describe('Collapsible Categories', () => {
    it('renders category headers as clickable', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
      expect(screen.getByTestId('category-header-system')).toBeInTheDocument();
    });

    it('collapses category on header click', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);

      // Click to collapse system category
      fireEvent.click(screen.getByTestId('category-header-system'));

      // Document should be hidden (not visible)
      const docItem = screen.getByTestId('doc-system-design');
      expect(docItem).not.toBeVisible();
    });

    it('expands category on second click', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);

      // Click to collapse
      fireEvent.click(screen.getByTestId('category-header-system'));
      expect(screen.getByTestId('doc-system-design')).not.toBeVisible();

      // Click to expand
      fireEvent.click(screen.getByTestId('category-header-system'));
      expect(screen.getByTestId('doc-system-design')).toBeVisible();
    });

    it('shows expand/collapse indicator', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);

      const header = screen.getByTestId('category-header-system');
      expect(header.querySelector('[data-testid="expand-icon"]')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('document items are focusable', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
      const doc = screen.getByTestId('doc-system-design');
      expect(doc).toHaveAttribute('tabIndex', '0');
    });

    it('selects document on Enter key', () => {
      const onSelect = vi.fn();
      render(<DocBrowser documents={mockDocuments} onSelect={onSelect} />);

      const doc = screen.getByTestId('doc-system-design');
      fireEvent.keyDown(doc, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith('system-design');
    });

    it('selects document on Space key', () => {
      const onSelect = vi.fn();
      render(<DocBrowser documents={mockDocuments} onSelect={onSelect} />);

      const doc = screen.getByTestId('doc-system-design');
      fireEvent.keyDown(doc, { key: ' ' });

      expect(onSelect).toHaveBeenCalledWith('system-design');
    });

    it('toggles category on Enter key', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);

      const header = screen.getByTestId('category-header-system');
      fireEvent.keyDown(header, { key: 'Enter' });

      expect(screen.getByTestId('doc-system-design')).not.toBeVisible();
    });
  });

  describe('LocalStorage Persistence', () => {
    it('saves collapsed state to localStorage', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);

      fireEvent.click(screen.getByTestId('category-header-system'));

      const saved = localStorageMock.getItem('asdlc:doc-browser-collapsed');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved!);
      expect(parsed).toContain('system');
    });

    it('restores collapsed state from localStorage', () => {
      localStorageMock.setItem('asdlc:doc-browser-collapsed', JSON.stringify(['system']));

      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);

      expect(screen.getByTestId('doc-system-design')).not.toBeVisible();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no documents', () => {
      render(<DocBrowser documents={[]} onSelect={vi.fn()} />);
      expect(screen.getByText(/no documents/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('document items have role button', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);
      const doc = screen.getByTestId('doc-system-design');
      expect(doc).toHaveAttribute('role', 'button');
    });

    it('category headers have aria-expanded', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);

      const header = screen.getByTestId('category-header-system');
      expect(header).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(header);
      expect(header).toHaveAttribute('aria-expanded', 'false');
    });

    it('category content has aria-hidden when collapsed', () => {
      render(<DocBrowser documents={mockDocuments} onSelect={vi.fn()} />);

      const content = screen.getByTestId('category-content-system');
      expect(content).toHaveAttribute('aria-hidden', 'false');

      fireEvent.click(screen.getByTestId('category-header-system'));
      expect(content).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
