/**
 * Tests for ContentTab component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContentTab from './ContentTab';

// Mock MarkdownRenderer
vi.mock('../common/MarkdownRenderer', () => ({
  default: ({ content, showToc }: { content: string; showToc?: boolean }) => (
    <div data-testid="markdown-renderer">
      <div data-testid="markdown-content">{content}</div>
      {showToc && <div data-testid="toc">Table of Contents</div>}
    </div>
  ),
}));

describe('ContentTab', () => {
  const defaultContent = `# Product Requirements

## Overview

This is a sample PRD document.

## Features

- Feature 1
- Feature 2

## Technical Requirements

Some technical details here.
`;

  const defaultValidation = {
    isValid: true,
    checkedAt: '2026-01-23T10:00:00Z',
    rules: [
      { id: 'rule-1', name: 'Structure', passed: true },
      { id: 'rule-2', name: 'Completeness', passed: true },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ContentTab content={defaultContent} />);
      expect(screen.getByTestId('content-tab')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ContentTab content={defaultContent} className="my-custom-class" />);
      expect(screen.getByTestId('content-tab')).toHaveClass('my-custom-class');
    });
  });

  describe('Markdown Rendering', () => {
    it('renders content using MarkdownRenderer', () => {
      render(<ContentTab content={defaultContent} />);
      expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument();
    });

    it('passes content to MarkdownRenderer', () => {
      render(<ContentTab content={defaultContent} />);
      expect(screen.getByTestId('markdown-content')).toHaveTextContent('Product Requirements');
    });
  });

  describe('Table of Contents', () => {
    it('shows TOC by default', () => {
      render(<ContentTab content={defaultContent} showToc />);
      expect(screen.getByTestId('toc')).toBeInTheDocument();
    });

    it('hides TOC when showToc is false', () => {
      render(<ContentTab content={defaultContent} showToc={false} />);
      expect(screen.queryByTestId('toc')).not.toBeInTheDocument();
    });

    it('can toggle TOC visibility', () => {
      render(<ContentTab content={defaultContent} showToc />);

      fireEvent.click(screen.getByTestId('toggle-toc'));

      expect(screen.queryByTestId('toc')).not.toBeInTheDocument();
    });
  });

  describe('Validation Status', () => {
    it('shows validation status when provided', () => {
      render(<ContentTab content={defaultContent} validation={defaultValidation} />);
      expect(screen.getByTestId('validation-status')).toBeInTheDocument();
    });

    it('shows valid badge when validation passes', () => {
      render(<ContentTab content={defaultContent} validation={defaultValidation} />);
      expect(screen.getByTestId('validation-badge')).toHaveTextContent(/valid/i);
    });

    it('shows invalid badge when validation fails', () => {
      const invalidValidation = {
        ...defaultValidation,
        isValid: false,
        rules: [
          { id: 'rule-1', name: 'Structure', passed: true },
          { id: 'rule-2', name: 'Completeness', passed: false, error: 'Missing sections' },
        ],
      };
      render(<ContentTab content={defaultContent} validation={invalidValidation} />);
      expect(screen.getByTestId('validation-badge')).toHaveTextContent(/invalid/i);
    });

    it('shows validation timestamp', () => {
      render(<ContentTab content={defaultContent} validation={defaultValidation} />);
      expect(screen.getByTestId('validation-time')).toBeInTheDocument();
    });

    it('shows rule results', () => {
      render(<ContentTab content={defaultContent} validation={defaultValidation} />);

      fireEvent.click(screen.getByTestId('expand-validation'));

      expect(screen.getByText('Structure')).toBeInTheDocument();
      expect(screen.getByText('Completeness')).toBeInTheDocument();
    });

    it('shows failed rule with error message', () => {
      const invalidValidation = {
        isValid: false,
        checkedAt: '2026-01-23T10:00:00Z',
        rules: [
          { id: 'rule-1', name: 'Completeness', passed: false, error: 'Missing sections' },
        ],
      };
      render(<ContentTab content={defaultContent} validation={invalidValidation} />);

      fireEvent.click(screen.getByTestId('expand-validation'));

      expect(screen.getByText('Missing sections')).toBeInTheDocument();
    });
  });

  describe('Copy Content', () => {
    it('shows copy button', () => {
      render(<ContentTab content={defaultContent} />);
      expect(screen.getByTestId('copy-content')).toBeInTheDocument();
    });

    it('calls onCopy when copy button clicked', async () => {
      const onCopy = vi.fn();
      // Mock clipboard
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });

      render(<ContentTab content={defaultContent} onCopy={onCopy} />);

      fireEvent.click(screen.getByTestId('copy-content'));

      await waitFor(() => {
        expect(onCopy).toHaveBeenCalled();
      });
    });

    it('shows copied feedback after copy', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });

      render(<ContentTab content={defaultContent} />);

      fireEvent.click(screen.getByTestId('copy-content'));

      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no content', () => {
      render(<ContentTab content="" />);
      expect(screen.getByText(/no content/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<ContentTab content={defaultContent} isLoading />);
      expect(screen.getByTestId('content-loading')).toBeInTheDocument();
    });

    it('shows skeleton content when loading', () => {
      render(<ContentTab content={defaultContent} isLoading />);
      expect(screen.getByTestId('content-skeleton')).toBeInTheDocument();
    });
  });

  describe('View Mode', () => {
    it('shows raw view toggle', () => {
      render(<ContentTab content={defaultContent} />);
      expect(screen.getByTestId('view-mode-toggle')).toBeInTheDocument();
    });

    it('switches to raw view when toggled', () => {
      render(<ContentTab content={defaultContent} />);

      fireEvent.click(screen.getByTestId('view-mode-raw'));

      expect(screen.getByTestId('raw-content')).toBeInTheDocument();
    });

    it('shows rendered view by default', () => {
      render(<ContentTab content={defaultContent} />);
      expect(screen.getByTestId('view-mode-rendered')).toHaveClass('bg-accent-blue');
    });
  });

  describe('Accessibility', () => {
    it('copy button has accessible label', () => {
      render(<ContentTab content={defaultContent} />);
      expect(screen.getByTestId('copy-content')).toHaveAttribute('aria-label');
    });

    it('view mode buttons have accessible labels', () => {
      render(<ContentTab content={defaultContent} />);
      expect(screen.getByTestId('view-mode-rendered')).toHaveAttribute('aria-label');
      expect(screen.getByTestId('view-mode-raw')).toHaveAttribute('aria-label');
    });
  });
});
