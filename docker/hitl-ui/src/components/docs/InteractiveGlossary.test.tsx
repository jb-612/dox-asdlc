/**
 * Tests for InteractiveGlossary component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InteractiveGlossary, { type GlossaryTerm } from './InteractiveGlossary';

describe('InteractiveGlossary', () => {
  const defaultTerms: GlossaryTerm[] = [
    {
      id: 'asdlc',
      term: 'aSDLC',
      definition: 'Agentic Software Development Lifecycle - an AI-powered methodology',
      category: 'concept',
      deepLink: '/docs#asdlc',
    },
    {
      id: 'agent',
      term: 'Agent',
      definition: 'An autonomous AI worker that performs specific tasks',
      category: 'concept',
    },
    {
      id: 'artifact',
      term: 'Artifact',
      definition: 'A document or file produced by an agent',
      category: 'artifact',
      deepLink: '/artifacts',
    },
    {
      id: 'prd',
      term: 'PRD',
      definition: 'Product Requirements Document - defines what to build',
      category: 'artifact',
      deepLink: '/artifacts?type=prd',
    },
    {
      id: 'tdd',
      term: 'TDD',
      definition: 'Technical Design Document - defines how to build',
      category: 'artifact',
    },
    {
      id: 'hitl',
      term: 'HITL',
      definition: 'Human-in-the-Loop - governance checkpoints requiring human approval',
      category: 'concept',
      deepLink: '/gates',
    },
    {
      id: 'gate',
      term: 'Gate',
      definition: 'A HITL checkpoint where human review is required',
      category: 'concept',
      deepLink: '/gates',
    },
    {
      id: 'context-pack',
      term: 'Context Pack',
      definition: 'A curated set of files and information provided to an agent',
      category: 'technical',
    },
    {
      id: 'rlm',
      term: 'RLM',
      definition: 'Recursive Language Model - agents that can spawn sub-agents',
      category: 'technical',
    },
    {
      id: 'knowledge-store',
      term: 'Knowledge Store',
      definition: 'Vector database for RAG-based context retrieval',
      category: 'technical',
    },
    {
      id: 'batch',
      term: 'Batch Run',
      definition: 'Executing multiple agent tasks in parallel',
      category: 'concept',
    },
    {
      id: 'cluster',
      term: 'Cluster',
      definition: 'A group of related agents in the aSDLC workflow',
      category: 'concept',
      deepLink: '/docs#blueprint',
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      expect(screen.getByTestId('interactive-glossary')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      expect(screen.getByTestId('glossary-search')).toBeInTheDocument();
    });

    it('renders all terms', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      expect(screen.getByText('aSDLC')).toBeInTheDocument();
      expect(screen.getByText('Agent')).toBeInTheDocument();
      expect(screen.getByText('HITL')).toBeInTheDocument();
    });

    it('renders term definitions when expanded', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      // Expand the term first
      fireEvent.click(screen.getByTestId('term-asdlc'));
      expect(screen.getByText(/Agentic Software Development Lifecycle/)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<InteractiveGlossary terms={defaultTerms} className="my-custom-class" />);
      expect(screen.getByTestId('interactive-glossary')).toHaveClass('my-custom-class');
    });
  });

  describe('Search Functionality', () => {
    it('filters terms by search query', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const searchInput = screen.getByTestId('glossary-search');

      fireEvent.change(searchInput, { target: { value: 'agent' } });

      expect(screen.getByText('Agent')).toBeInTheDocument();
      expect(screen.queryByText('PRD')).not.toBeInTheDocument();
    });

    it('search is case insensitive', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const searchInput = screen.getByTestId('glossary-search');

      fireEvent.change(searchInput, { target: { value: 'AGENT' } });

      expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    it('searches in definitions', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const searchInput = screen.getByTestId('glossary-search');

      fireEvent.change(searchInput, { target: { value: 'autonomous' } });

      expect(screen.getByText('Agent')).toBeInTheDocument();
      expect(screen.queryByText('PRD')).not.toBeInTheDocument();
    });

    it('shows no results message when nothing matches', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const searchInput = screen.getByTestId('glossary-search');

      fireEvent.change(searchInput, { target: { value: 'xyz123' } });

      expect(screen.getByText(/no terms found/i)).toBeInTheDocument();
    });

    it('clears search on clear button click', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const searchInput = screen.getByTestId('glossary-search');

      fireEvent.change(searchInput, { target: { value: 'agent' } });
      expect(screen.queryByText('PRD')).not.toBeInTheDocument();

      const clearButton = screen.getByTestId('clear-search');
      fireEvent.click(clearButton);

      expect(screen.getByText('PRD')).toBeInTheDocument();
    });
  });

  describe('Alphabetical Organization', () => {
    it('groups terms by first letter', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      expect(screen.getByTestId('letter-group-a')).toBeInTheDocument();
      expect(screen.getByTestId('letter-group-p')).toBeInTheDocument();
      expect(screen.getByTestId('letter-group-t')).toBeInTheDocument();
    });

    it('shows letter headers', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      // Letter headers appear as h3 elements in the letter groups
      const letterGroupA = screen.getByTestId('letter-group-a');
      expect(letterGroupA.querySelector('h3')).toHaveTextContent('A');
      const letterGroupP = screen.getByTestId('letter-group-p');
      expect(letterGroupP.querySelector('h3')).toHaveTextContent('P');
      const letterGroupT = screen.getByTestId('letter-group-t');
      expect(letterGroupT.querySelector('h3')).toHaveTextContent('T');
    });

    it('sorts terms alphabetically within groups', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const letterGroupA = screen.getByTestId('letter-group-a');
      const terms = letterGroupA.querySelectorAll('[data-testid^="term-"]');
      const termTexts = Array.from(terms).map((t) => t.textContent);

      // Should be sorted
      const sorted = [...termTexts].sort();
      expect(termTexts).toEqual(sorted);
    });

    it('shows alphabet navigation', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      expect(screen.getByTestId('alphabet-nav')).toBeInTheDocument();
    });

    it('scrolls to letter on navigation click', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const letterLink = screen.getByTestId('nav-letter-p');

      // Mock scrollIntoView
      const scrollIntoViewMock = vi.fn();
      const letterGroup = screen.getByTestId('letter-group-p');
      letterGroup.scrollIntoView = scrollIntoViewMock;

      fireEvent.click(letterLink);

      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  describe('Deep Links', () => {
    it('shows "Show me in the system" link for terms with deepLink', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      // First expand the term
      fireEvent.click(screen.getByTestId('term-asdlc'));
      // Terms with deepLink should have the link when expanded
      const termWithLink = screen.getByTestId('term-asdlc');
      expect(termWithLink.querySelector('[data-testid="deep-link"]')).toBeInTheDocument();
    });

    it('hides link for terms without deepLink', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      // Expand the term first
      fireEvent.click(screen.getByTestId('term-agent'));
      // Agent has no deepLink
      const termWithoutLink = screen.getByTestId('term-agent');
      expect(termWithoutLink.querySelector('[data-testid="deep-link"]')).not.toBeInTheDocument();
    });

    it('calls onDeepLinkClick when link is clicked', () => {
      const onDeepLinkClick = vi.fn();
      render(<InteractiveGlossary terms={defaultTerms} onDeepLinkClick={onDeepLinkClick} />);

      // First expand the term
      fireEvent.click(screen.getByTestId('term-asdlc'));
      const deepLink = screen.getByTestId('term-asdlc').querySelector('[data-testid="deep-link"]');
      fireEvent.click(deepLink!);

      expect(onDeepLinkClick).toHaveBeenCalledWith('/docs#asdlc', 'asdlc');
    });

    it('deep link shows correct text', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      // First expand the term
      fireEvent.click(screen.getByTestId('term-asdlc'));
      const deepLink = screen.getByTestId('term-asdlc').querySelector('[data-testid="deep-link"]');
      expect(deepLink).toHaveTextContent(/show me in the system/i);
    });
  });

  describe('Category Filtering', () => {
    it('shows category filter buttons', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      expect(screen.getByTestId('category-all')).toBeInTheDocument();
      expect(screen.getByTestId('category-concept')).toBeInTheDocument();
      expect(screen.getByTestId('category-artifact')).toBeInTheDocument();
      expect(screen.getByTestId('category-technical')).toBeInTheDocument();
    });

    it('filters by category', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      fireEvent.click(screen.getByTestId('category-artifact'));

      expect(screen.getByText('PRD')).toBeInTheDocument();
      expect(screen.getByText('TDD')).toBeInTheDocument();
      expect(screen.queryByText('Agent')).not.toBeInTheDocument();
    });

    it('shows all when "All" is selected', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);

      // First filter
      fireEvent.click(screen.getByTestId('category-artifact'));
      expect(screen.queryByText('Agent')).not.toBeInTheDocument();

      // Then show all
      fireEvent.click(screen.getByTestId('category-all'));
      expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    it('highlights selected category', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);

      fireEvent.click(screen.getByTestId('category-artifact'));

      expect(screen.getByTestId('category-artifact')).toHaveClass('bg-accent-teal');
      expect(screen.getByTestId('category-all')).not.toHaveClass('bg-accent-teal');
    });

    it('shows category counts', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      // 12 total terms, 6 concepts, 3 artifacts, 3 technical
      expect(screen.getByTestId('category-all')).toHaveTextContent('12');
      expect(screen.getByTestId('category-concept')).toHaveTextContent('6');
      expect(screen.getByTestId('category-artifact')).toHaveTextContent('3');
      expect(screen.getByTestId('category-technical')).toHaveTextContent('3');
    });
  });

  describe('Term Expansion', () => {
    it('terms are collapsed by default', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const term = screen.getByTestId('term-asdlc');
      expect(term.querySelector('[data-testid="term-details"]')).not.toBeInTheDocument();
    });

    it('expands term on click', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      fireEvent.click(screen.getByTestId('term-asdlc'));

      const term = screen.getByTestId('term-asdlc');
      expect(term.querySelector('[data-testid="term-details"]')).toBeInTheDocument();
    });

    it('collapses term on second click', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      fireEvent.click(screen.getByTestId('term-asdlc'));
      fireEvent.click(screen.getByTestId('term-asdlc'));

      const term = screen.getByTestId('term-asdlc');
      expect(term.querySelector('[data-testid="term-details"]')).not.toBeInTheDocument();
    });

    it('shows full definition when expanded', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      fireEvent.click(screen.getByTestId('term-asdlc'));

      expect(screen.getByText(/Agentic Software Development Lifecycle - an AI-powered methodology/)).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('search input is focusable', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const searchInput = screen.getByTestId('glossary-search');
      expect(document.activeElement).not.toBe(searchInput);

      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);
    });

    it('terms are focusable', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const term = screen.getByTestId('term-asdlc');
      expect(term).toHaveAttribute('tabIndex', '0');
    });

    it('expands term on Enter key', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const term = screen.getByTestId('term-asdlc');

      fireEvent.keyDown(term, { key: 'Enter' });

      expect(term.querySelector('[data-testid="term-details"]')).toBeInTheDocument();
    });

    it('expands term on Space key', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const term = screen.getByTestId('term-asdlc');

      fireEvent.keyDown(term, { key: ' ' });

      expect(term.querySelector('[data-testid="term-details"]')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has aria-label on search input', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      expect(screen.getByTestId('glossary-search')).toHaveAttribute('aria-label', 'Search glossary terms');
    });

    it('has role="list" on terms container', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      expect(screen.getByTestId('terms-list')).toHaveAttribute('role', 'list');
    });

    it('has role="listitem" on each term', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      expect(screen.getByTestId('term-asdlc')).toHaveAttribute('role', 'listitem');
    });

    it('has aria-expanded on expandable terms', () => {
      render(<InteractiveGlossary terms={defaultTerms} />);
      const term = screen.getByTestId('term-asdlc');
      expect(term).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(term);
      expect(term).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Empty State', () => {
    it('renders empty state when no terms', () => {
      render(<InteractiveGlossary terms={[]} />);
      expect(screen.getByText(/no terms available/i)).toBeInTheDocument();
    });
  });
});
