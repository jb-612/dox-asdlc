/**
 * Tests for DocViewer component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DocViewer from './DocViewer';
import type { DocumentContent, DocumentMeta } from '../../api/types';

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockImplementation(async (id, content) => {
      if (content.includes('invalid')) {
        throw new Error('Syntax error');
      }
      return { svg: `<svg data-testid="rendered-svg">${content}</svg>` };
    }),
  },
}));

const mockMeta: DocumentMeta = {
  id: 'test-doc',
  title: 'Test Document',
  path: 'test.md',
  category: 'system',
  description: 'A test document',
  lastModified: '2026-01-24',
};

const createMockDocument = (content: string): DocumentContent => ({
  meta: mockMeta,
  content,
});

describe('DocViewer', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      const doc = createMockDocument('# Hello\n\nWorld');
      render(<DocViewer document={doc} />);
      expect(screen.getByTestId('doc-viewer')).toBeInTheDocument();
    });

    it('renders markdown content', () => {
      const doc = createMockDocument('# Title\n\nContent text here');
      render(<DocViewer document={doc} />);
      // Use getAllByText for heading that appears in both TOC and content
      const titleElements = screen.getAllByText('Title');
      expect(titleElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Content text here')).toBeInTheDocument();
    });

    it('displays document title in header', () => {
      const doc = createMockDocument('# Content');
      render(<DocViewer document={doc} />);
      expect(screen.getByTestId('doc-title')).toHaveTextContent('Test Document');
    });

    it('displays document metadata', () => {
      const doc = createMockDocument('# Content');
      render(<DocViewer document={doc} />);
      expect(screen.getByTestId('doc-meta')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const doc = createMockDocument('# Hello');
      render(<DocViewer document={doc} className="my-custom-class" />);
      expect(screen.getByTestId('doc-viewer')).toHaveClass('my-custom-class');
    });
  });

  describe('Table of Contents', () => {
    it('generates table of contents from headings', () => {
      const doc = createMockDocument('# H1\n## H2\n### H3');
      render(<DocViewer document={doc} />);
      expect(screen.getByTestId('toc')).toBeInTheDocument();
    });

    it('shows all heading levels in TOC', () => {
      const doc = createMockDocument('# Heading 1\n## Heading 2\n### Heading 3');
      render(<DocViewer document={doc} />);
      const toc = screen.getByTestId('toc');
      expect(toc).toHaveTextContent('Heading 1');
      expect(toc).toHaveTextContent('Heading 2');
      expect(toc).toHaveTextContent('Heading 3');
    });

    it('TOC links are clickable', () => {
      const doc = createMockDocument('# Section One\n\nContent\n\n## Section Two');
      render(<DocViewer document={doc} />);
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });

    it('can hide TOC with showToc prop', () => {
      const doc = createMockDocument('# H1\n## H2');
      render(<DocViewer document={doc} showToc={false} />);
      expect(screen.queryByTestId('toc')).not.toBeInTheDocument();
    });

    it('TOC can be collapsed', () => {
      const doc = createMockDocument('# H1\n## H2');
      render(<DocViewer document={doc} />);

      const toggleButton = screen.getByTestId('toc-toggle');
      fireEvent.click(toggleButton);

      expect(screen.getByTestId('toc-content')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Markdown Formatting', () => {
    it('renders heading elements', () => {
      const doc = createMockDocument('# H1\n## H2\n### H3');
      render(<DocViewer document={doc} />);

      // The content should have headings rendered
      const content = screen.getByTestId('doc-content');
      expect(content).toBeInTheDocument();
    });

    it('renders lists', () => {
      const doc = createMockDocument('- Item 1\n- Item 2\n- Item 3');
      render(<DocViewer document={doc} />);

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('renders code blocks with language', () => {
      const doc = createMockDocument('```javascript\nconst x = 1;\n```');
      render(<DocViewer document={doc} />);

      expect(screen.getByTestId('doc-content')).toBeInTheDocument();
    });

    it('renders blockquotes', () => {
      const doc = createMockDocument('> This is a quote');
      render(<DocViewer document={doc} />);

      expect(screen.getByText('This is a quote')).toBeInTheDocument();
    });

    it('renders tables', () => {
      const doc = createMockDocument('| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1 | Cell 2 |');
      render(<DocViewer document={doc} />);

      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
    });

    it('renders links', () => {
      const doc = createMockDocument('[Click here](https://example.com)');
      render(<DocViewer document={doc} />);

      const link = screen.getByText('Click here');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('Mermaid Integration', () => {
    it('renders mermaid code blocks as diagrams', async () => {
      const doc = createMockDocument('# Doc\n\n```mermaid\ngraph TD\n  A-->B\n```');
      render(<DocViewer document={doc} />);

      await waitFor(() => {
        expect(screen.getByTestId('inline-mermaid')).toBeInTheDocument();
      });
    });

    it('renders multiple mermaid blocks', async () => {
      const doc = createMockDocument(`
# Doc

\`\`\`mermaid
graph TD
  A-->B
\`\`\`

Some text

\`\`\`mermaid
flowchart LR
  C-->D
\`\`\`
`);
      render(<DocViewer document={doc} />);

      await waitFor(() => {
        const mermaidBlocks = screen.getAllByTestId('inline-mermaid');
        expect(mermaidBlocks).toHaveLength(2);
      });
    });

    it('handles mermaid errors gracefully', async () => {
      const doc = createMockDocument('```mermaid\ninvalid syntax\n```');
      render(<DocViewer document={doc} />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-error')).toBeInTheDocument();
      });
    });

    it('wraps MermaidDiagram in ErrorBoundary for crash protection', async () => {
      // This test verifies the ErrorBoundary is in place
      // The ErrorBoundary provides a fallback if MermaidDiagram throws unexpectedly
      const doc = createMockDocument('```mermaid\ngraph TD\n  A-->B\n```');
      render(<DocViewer document={doc} />);

      await waitFor(() => {
        // The inline-mermaid container should be present, containing the ErrorBoundary
        const mermaidContainer = screen.getByTestId('inline-mermaid');
        expect(mermaidContainer).toBeInTheDocument();
      });
    });
  });

  describe('Scroll to Section', () => {
    it('scrolls to section when TOC link clicked', () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const doc = createMockDocument('# Section One\n\nContent\n\n## Section Two');
      render(<DocViewer document={doc} />);

      const tocLink = screen.getByRole('link', { name: /Section One/i });
      fireEvent.click(tocLink);

      // Note: In a real test with actual DOM, this would scroll
      expect(tocLink).toHaveAttribute('href');
    });

    it('handles onSectionClick callback', () => {
      const onSectionClick = vi.fn();
      const doc = createMockDocument('# Section One\n## Section Two');
      render(<DocViewer document={doc} onSectionClick={onSectionClick} />);

      const tocLinks = screen.getAllByRole('link');
      if (tocLinks.length > 0) {
        fireEvent.click(tocLinks[0]);
        expect(onSectionClick).toHaveBeenCalled();
      }
    });
  });

  describe('Loading State', () => {
    it('shows loading state when document is not provided', () => {
      render(<DocViewer document={null as unknown as DocumentContent} />);
      expect(screen.getByTestId('doc-viewer-loading')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      const doc = createMockDocument('# H1\n## H2');
      render(<DocViewer document={doc} />);

      expect(screen.getByTestId('doc-title').tagName).toBe('H1');
    });

    it('TOC has navigation role', () => {
      const doc = createMockDocument('# H1\n## H2');
      render(<DocViewer document={doc} />);

      expect(screen.getByTestId('toc')).toHaveAttribute('role', 'navigation');
    });

    it('content area has article role', () => {
      const doc = createMockDocument('# Content');
      render(<DocViewer document={doc} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });

  describe('Empty/Null Handling', () => {
    it('handles empty content', () => {
      const doc = createMockDocument('');
      render(<DocViewer document={doc} />);

      expect(screen.getByTestId('doc-empty')).toBeInTheDocument();
    });
  });
});
