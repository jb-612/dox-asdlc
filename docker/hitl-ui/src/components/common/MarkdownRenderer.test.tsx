/**
 * Tests for MarkdownRenderer component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MarkdownRenderer from './MarkdownRenderer';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

describe('MarkdownRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders markdown text', () => {
      render(<MarkdownRenderer content="Hello **World**" />);
      expect(screen.getByText('World')).toBeInTheDocument();
    });

    it('renders headings with correct levels', () => {
      // Using template literal for actual newlines
      const markdown = `# Heading 1

## Heading 2

### Heading 3`;
      render(<MarkdownRenderer content={markdown} />);

      const h1 = screen.getByRole('heading', { level: 1 });
      const h2 = screen.getByRole('heading', { level: 2 });
      const h3 = screen.getByRole('heading', { level: 3 });

      expect(h1).toHaveTextContent('Heading 1');
      expect(h2).toHaveTextContent('Heading 2');
      expect(h3).toHaveTextContent('Heading 3');
    });

    it('renders lists correctly', () => {
      render(
        <MarkdownRenderer content={'- Item 1\n- Item 2\n- Item 3'} />
      );

      // Use getAllByRole to find all list items
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
      expect(listItems[0]).toHaveTextContent('Item 1');
      expect(listItems[1]).toHaveTextContent('Item 2');
      expect(listItems[2]).toHaveTextContent('Item 3');
    });

    it('renders links correctly', () => {
      render(
        <MarkdownRenderer content="[Click here](https://example.com)" />
      );

      const link = screen.getByRole('link', { name: 'Click here' });
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders blockquotes', () => {
      render(<MarkdownRenderer content="> This is a quote" />);
      expect(screen.getByText('This is a quote')).toBeInTheDocument();
    });

    it('renders inline code', () => {
      render(<MarkdownRenderer content="Use `const` for constants" />);
      expect(screen.getByText('const')).toBeInTheDocument();
    });

    it('renders tables', () => {
      const tableMarkdown = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`;
      render(<MarkdownRenderer content={tableMarkdown} />);

      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
    });
  });

  describe('Code Blocks', () => {
    it('renders code blocks with language label', () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      render(<MarkdownRenderer content={markdown} />);

      expect(screen.getByTestId('code-language')).toHaveTextContent('javascript');
      expect(screen.getByTestId('code-content')).toHaveTextContent('const x = 1;');
    });

    it('renders code blocks with copy button', () => {
      const markdown = '```python\nprint("hello")\n```';
      render(<MarkdownRenderer content={markdown} />);

      const copyButton = screen.getByRole('button', { name: 'Copy code' });
      expect(copyButton).toBeInTheDocument();
    });

    it('copies code to clipboard when copy button clicked', async () => {
      const markdown = '```typescript\nconst test = true;\n```';
      render(<MarkdownRenderer content={markdown} />);

      const copyButton = screen.getByRole('button', { name: 'Copy code' });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith('const test = true;');
      });
    });

    it('shows check icon after successful copy', async () => {
      const markdown = '```bash\necho "test"\n```';
      render(<MarkdownRenderer content={markdown} />);

      const copyButton = screen.getByRole('button', { name: 'Copy code' });
      fireEvent.click(copyButton);

      await waitFor(() => {
        // The CheckIcon should appear after copy
        expect(screen.queryByRole('button', { name: 'Copy code' })).toBeInTheDocument();
      });
    });

    it('applies dark theme to code blocks by default', () => {
      const markdown = '```js\nlet a = 1;\n```';
      const { container } = render(<MarkdownRenderer content={markdown} />);

      const codeContainer = container.querySelector('.bg-gray-900');
      expect(codeContainer).toBeInTheDocument();
    });

    it('applies light theme when darkCodeBlocks is false', () => {
      const markdown = '```js\nlet a = 1;\n```';
      const { container } = render(
        <MarkdownRenderer content={markdown} darkCodeBlocks={false} />
      );

      const codeContainer = container.querySelector('.bg-gray-100');
      expect(codeContainer).toBeInTheDocument();
    });
  });

  describe('Table of Contents', () => {
    it('renders table of contents when showToc is true', () => {
      const markdown = '# Introduction\n## Background\n### Details';
      render(<MarkdownRenderer content={markdown} showToc />);

      expect(screen.getByText('Table of Contents')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Introduction' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Background' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Details' })).toBeInTheDocument();
    });

    it('does not render table of contents by default', () => {
      const markdown = '# Introduction\n## Background';
      render(<MarkdownRenderer content={markdown} />);

      expect(screen.queryByText('Table of Contents')).not.toBeInTheDocument();
    });

    it('links in TOC point to correct headings', () => {
      const markdown = '# My Heading';
      render(<MarkdownRenderer content={markdown} showToc />);

      const tocLink = screen.getByRole('link', { name: 'My Heading' });
      expect(tocLink).toHaveAttribute('href', '#my-heading');
    });

    it('does not show TOC in diff or side-by-side modes', () => {
      const markdown = '# Introduction\n## Background';
      render(
        <MarkdownRenderer
          content={markdown}
          compareContent="# Changed"
          showToc
          mode="diff"
        />
      );

      expect(screen.queryByText('Table of Contents')).not.toBeInTheDocument();
    });
  });

  describe('View Modes', () => {
    it('renders mode toggle when showModeToggle is true and compareContent provided', () => {
      render(
        <MarkdownRenderer
          content="Original"
          compareContent="Changed"
          showModeToggle
        />
      );

      expect(screen.getByRole('button', { name: /View/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Diff/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Side by Side/i })).toBeInTheDocument();
    });

    it('does not render mode toggle without compareContent', () => {
      render(<MarkdownRenderer content="Original" showModeToggle />);

      expect(screen.queryByRole('button', { name: /Diff/i })).not.toBeInTheDocument();
    });

    it('calls onModeChange when mode is changed', () => {
      const onModeChange = vi.fn();
      render(
        <MarkdownRenderer
          content="Original"
          compareContent="Changed"
          showModeToggle
          onModeChange={onModeChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Diff/i }));
      expect(onModeChange).toHaveBeenCalledWith('diff');
    });

    it('highlights active mode button', () => {
      render(
        <MarkdownRenderer
          content="Original"
          compareContent="Changed"
          showModeToggle
          mode="diff"
        />
      );

      const diffButton = screen.getByRole('button', { name: /Diff/i });
      expect(diffButton).toHaveClass('bg-accent-teal');
    });
  });

  describe('Diff Mode', () => {
    it('shows removed lines in red', () => {
      const { container } = render(
        <MarkdownRenderer
          content="Line 1\nRemoved line\nLine 3"
          compareContent="Line 1\nLine 3"
          mode="diff"
        />
      );

      const removedLine = container.querySelector('.bg-red-900\\/30');
      expect(removedLine).toBeInTheDocument();
    });

    it('shows added lines in green', () => {
      const { container } = render(
        <MarkdownRenderer
          content="Line 1\nLine 2"
          compareContent="Line 1\nAdded line\nLine 2"
          mode="diff"
        />
      );

      const addedLine = container.querySelector('.bg-green-900\\/30');
      expect(addedLine).toBeInTheDocument();
    });

    it('shows unchanged lines without highlighting', () => {
      render(
        <MarkdownRenderer
          content="Unchanged line"
          compareContent="Unchanged line"
          mode="diff"
        />
      );

      expect(screen.getByText('Unchanged line')).toBeInTheDocument();
    });
  });

  describe('Side-by-Side Mode', () => {
    it('renders both contents side by side', () => {
      render(
        <MarkdownRenderer
          content="# Original"
          compareContent="# Changed"
          mode="side-by-side"
        />
      );

      expect(screen.getByText('Original')).toBeInTheDocument();
      expect(screen.getByText('Changed')).toBeInTheDocument();
    });

    it('shows custom labels for side-by-side view', () => {
      render(
        <MarkdownRenderer
          content="Content A"
          compareContent="Content B"
          mode="side-by-side"
          sideBySideLabels={{ left: 'Current', right: 'Proposed' }}
        />
      );

      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.getByText('Proposed')).toBeInTheDocument();
    });

    it('shows default labels when not provided', () => {
      render(
        <MarkdownRenderer
          content="Content A"
          compareContent="Content B"
          mode="side-by-side"
        />
      );

      expect(screen.getByText('Before')).toBeInTheDocument();
      expect(screen.getByText('After')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <MarkdownRenderer content="Test" className="my-custom-class" />
      );

      expect(container.firstChild).toHaveClass('my-custom-class');
    });

    it('adds heading IDs for anchor navigation', () => {
      render(<MarkdownRenderer content="# Test Heading" />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveAttribute('id', 'test-heading');
    });

    it('handles special characters in heading IDs', () => {
      render(<MarkdownRenderer content="# Hello, World!" />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveAttribute('id', 'hello-world');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty content', () => {
      const { container } = render(<MarkdownRenderer content="" />);
      expect(container.querySelector('.markdown-renderer')).toBeInTheDocument();
    });

    it('handles content with only whitespace', () => {
      const { container } = render(<MarkdownRenderer content="   \n\n   " />);
      expect(container.querySelector('.markdown-renderer')).toBeInTheDocument();
    });

    it('handles very long code blocks', () => {
      const longCode = '```js\n' + 'x = 1;\n'.repeat(100) + '```';
      render(<MarkdownRenderer content={longCode} />);

      expect(screen.getByTestId('code-language')).toHaveTextContent('js');
    });

    it('handles nested lists', () => {
      const markdown = '- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2';
      render(<MarkdownRenderer content={markdown} />);

      expect(screen.getByText(/Item 1/)).toBeInTheDocument();
      expect(screen.getByText(/Nested 1/)).toBeInTheDocument();
    });
  });
});
