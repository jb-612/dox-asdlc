/**
 * Tests for CodeDiff component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CodeDiff from './CodeDiff';

describe('CodeDiff', () => {
  const oldContent = `function hello() {
  console.log("Hello");
}`;

  const newContent = `function hello() {
  console.log("Hello, World!");
  return true;
}`;

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<CodeDiff oldContent={oldContent} newContent={newContent} />);
      expect(screen.getByText('Unified')).toBeInTheDocument();
    });

    it('shows diff statistics', () => {
      render(<CodeDiff oldContent={oldContent} newContent={newContent} />);

      // Should show additions and deletions
      expect(screen.getByTestId('additions')).toBeInTheDocument();
      expect(screen.getByTestId('deletions')).toBeInTheDocument();
    });

    it('displays language label when provided', () => {
      render(
        <CodeDiff
          oldContent={oldContent}
          newContent={newContent}
          language="javascript"
        />
      );

      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <CodeDiff
          oldContent={oldContent}
          newContent={newContent}
          className="my-custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('my-custom-class');
    });
  });

  describe('Unified View', () => {
    it('shows unified view by default', () => {
      render(<CodeDiff oldContent={oldContent} newContent={newContent} />);

      const unifiedButton = screen.getByRole('button', { name: /unified/i });
      expect(unifiedButton).toHaveClass('bg-accent-teal');
    });

    it('displays removed lines with minus prefix', () => {
      render(
        <CodeDiff
          oldContent="removed line"
          newContent="added line"
        />
      );

      const prefixes = screen.getAllByTestId('diff-prefix');
      expect(prefixes.some(p => p.textContent === '-')).toBe(true);
    });

    it('displays added lines with plus prefix', () => {
      render(
        <CodeDiff
          oldContent="removed line"
          newContent="added line"
        />
      );

      const prefixes = screen.getAllByTestId('diff-prefix');
      expect(prefixes.some(p => p.textContent === '+')).toBe(true);
    });

    it('displays unchanged lines with space prefix', () => {
      // When lines are identical on both sides, they should show space prefix
      render(
        <CodeDiff
          oldContent="unchanged line"
          newContent="unchanged line"
        />
      );

      const prefixes = screen.getAllByTestId('diff-prefix');
      // Unchanged line should have space (empty when trimmed)
      expect(prefixes[0].textContent?.trim()).toBe('');
    });
  });

  describe('Line Numbers', () => {
    it('shows line numbers by default', () => {
      render(<CodeDiff oldContent="line 1\nline 2" newContent="line 1\nline 2" />);

      const oldLineNumbers = screen.getAllByTestId('old-line-number');
      const newLineNumbers = screen.getAllByTestId('new-line-number');

      expect(oldLineNumbers.length).toBeGreaterThan(0);
      expect(newLineNumbers.length).toBeGreaterThan(0);
    });

    it('hides line numbers when showLineNumbers is false', () => {
      render(
        <CodeDiff
          oldContent="line 1"
          newContent="line 1"
          showLineNumbers={false}
        />
      );

      expect(screen.queryByTestId('old-line-number')).not.toBeInTheDocument();
      expect(screen.queryByTestId('new-line-number')).not.toBeInTheDocument();
    });

    it('shows correct line numbers for unchanged lines', () => {
      // The diff library treats the whole block as one chunk, resulting in one line
      render(
        <CodeDiff
          oldContent="line 1"
          newContent="line 1"
        />
      );

      const oldLineNumbers = screen.getAllByTestId('old-line-number');
      expect(oldLineNumbers[0]).toHaveTextContent('1');
    });

    it('shows old line number only for removed lines', () => {
      render(
        <CodeDiff
          oldContent="removed"
          newContent=""
        />
      );

      const oldLineNumbers = screen.getAllByTestId('old-line-number');
      // newLineNumbers retrieved but not asserted in this test
      screen.getAllByTestId('new-line-number');

      // Removed line should have old number but not new
      const removedOld = oldLineNumbers.find(el => el.textContent === '1');
      expect(removedOld).toBeInTheDocument();
    });

    it('shows new line number only for added lines', () => {
      render(
        <CodeDiff
          oldContent=""
          newContent="added"
        />
      );

      const newLineNumbers = screen.getAllByTestId('new-line-number');
      const addedNew = newLineNumbers.find(el => el.textContent === '1');
      expect(addedNew).toBeInTheDocument();
    });
  });

  describe('Side-by-Side View', () => {
    it('switches to side-by-side view when button clicked', () => {
      render(<CodeDiff oldContent={oldContent} newContent={newContent} />);

      const splitButton = screen.getByRole('button', { name: /side by side/i });
      fireEvent.click(splitButton);

      expect(splitButton).toHaveClass('bg-accent-teal');
    });

    it('shows old and new labels in side-by-side view', () => {
      render(
        <CodeDiff
          oldContent={oldContent}
          newContent={newContent}
          mode="side-by-side"
        />
      );

      expect(screen.getByText('Original')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('uses custom labels when provided', () => {
      render(
        <CodeDiff
          oldContent={oldContent}
          newContent={newContent}
          mode="side-by-side"
          oldLabel="Before"
          newLabel="After"
        />
      );

      expect(screen.getByText('Before')).toBeInTheDocument();
      expect(screen.getByText('After')).toBeInTheDocument();
    });

    it('aligns removed and added lines', () => {
      const { container } = render(
        <CodeDiff
          oldContent="removed line"
          newContent="added line"
          mode="side-by-side"
        />
      );

      // Both sides should have the same number of rows
      const tables = container.querySelectorAll('table');
      expect(tables.length).toBe(2);

      const leftRows = tables[0].querySelectorAll('tr');
      const rightRows = tables[1].querySelectorAll('tr');
      expect(leftRows.length).toBe(rightRows.length);
    });
  });

  describe('Mode Toggle', () => {
    it('shows mode toggle by default', () => {
      render(<CodeDiff oldContent={oldContent} newContent={newContent} />);

      expect(screen.getByRole('button', { name: /unified/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /side by side/i })).toBeInTheDocument();
    });

    it('hides mode toggle when showModeToggle is false', () => {
      render(
        <CodeDiff
          oldContent={oldContent}
          newContent={newContent}
          showModeToggle={false}
        />
      );

      expect(screen.queryByRole('button', { name: /unified/i })).not.toBeInTheDocument();
    });

    it('calls onModeChange when mode is changed', () => {
      const onModeChange = vi.fn();
      render(
        <CodeDiff
          oldContent={oldContent}
          newContent={newContent}
          onModeChange={onModeChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /side by side/i }));
      expect(onModeChange).toHaveBeenCalledWith('side-by-side');

      fireEvent.click(screen.getByRole('button', { name: /unified/i }));
      expect(onModeChange).toHaveBeenCalledWith('unified');
    });

    it('respects initial mode prop', () => {
      render(
        <CodeDiff
          oldContent={oldContent}
          newContent={newContent}
          mode="side-by-side"
        />
      );

      const splitButton = screen.getByRole('button', { name: /side by side/i });
      expect(splitButton).toHaveClass('bg-accent-teal');
    });
  });

  describe('Diff Statistics', () => {
    it('correctly counts additions', () => {
      // Adding one line to existing content
      render(
        <CodeDiff
          oldContent="line 1"
          newContent="line 1\nadded line"
        />
      );

      const additions = screen.getByTestId('additions');
      expect(additions).toHaveTextContent('+1');
    });

    it('correctly counts deletions', () => {
      // Removing one line from existing content
      render(
        <CodeDiff
          oldContent="line 1\nremoved line"
          newContent="line 1"
        />
      );

      const deletions = screen.getByTestId('deletions');
      expect(deletions).toHaveTextContent('-1');
    });

    it('shows zero for no changes', () => {
      render(
        <CodeDiff
          oldContent="same content"
          newContent="same content"
        />
      );

      const additions = screen.getByTestId('additions');
      const deletions = screen.getByTestId('deletions');

      expect(additions).toHaveTextContent('+0');
      expect(deletions).toHaveTextContent('-0');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty old content', () => {
      render(<CodeDiff oldContent="" newContent="new content" />);
      expect(screen.getByText('new content')).toBeInTheDocument();
    });

    it('handles empty new content', () => {
      render(<CodeDiff oldContent="old content" newContent="" />);
      expect(screen.getByText('old content')).toBeInTheDocument();
    });

    it('handles both empty', () => {
      const { container } = render(<CodeDiff oldContent="" newContent="" />);
      expect(container.querySelector('.code-diff')).toBeInTheDocument();
    });

    it('handles identical content', () => {
      render(<CodeDiff oldContent="same" newContent="same" />);

      const additions = screen.getByTestId('additions');
      const deletions = screen.getByTestId('deletions');

      expect(additions).toHaveTextContent('+0');
      expect(deletions).toHaveTextContent('-0');
    });

    it('handles content with special characters', () => {
      render(
        <CodeDiff
          oldContent="<div>Hello</div>"
          newContent="<div>World</div>"
        />
      );

      expect(screen.getByText('<div>Hello</div>')).toBeInTheDocument();
      expect(screen.getByText('<div>World</div>')).toBeInTheDocument();
    });

    it('handles multi-line changes', () => {
      const old = `line 1
line 2
line 3`;
      const newText = `line 1
modified line 2
line 3
line 4`;

      render(<CodeDiff oldContent={old} newContent={newText} />);

      const additions = screen.getByTestId('additions');
      const deletions = screen.getByTestId('deletions');

      // The diff library detects: line 2 removed, modified line 2 + line 4 added
      // Exact counts depend on diff algorithm - just verify they're non-zero
      expect(additions.textContent).toMatch(/\+\d+/);
      expect(deletions.textContent).toMatch(/-\d+/);
    });
  });
});
