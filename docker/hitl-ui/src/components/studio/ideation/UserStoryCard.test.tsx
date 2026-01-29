/**
 * Tests for UserStoryCard component (P05-F11 T14)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UserStoryCard from './UserStoryCard';
import type { UserStory } from '../../../types/ideation';

describe('UserStoryCard', () => {
  const mockUserStory: UserStory = {
    id: 'story-001',
    title: 'OAuth Login with Google',
    asA: 'registered user',
    iWant: 'to log in using my Google account',
    soThat: 'I can access the platform without creating a new password',
    acceptanceCriteria: [
      'User can click "Sign in with Google" button',
      'User is redirected to Google OAuth consent screen',
      'Upon approval, user is logged into the platform',
      'User profile is populated from Google account data',
    ],
    linkedRequirements: ['req-001', 'req-002'],
    priority: 'must_have',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header Rendering', () => {
    it('renders story ID', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('story-id')).toHaveTextContent('story-001');
    });

    it('renders story title', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('story-title')).toHaveTextContent('OAuth Login with Google');
    });

    it('renders priority badge', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('priority-badge')).toBeInTheDocument();
      expect(screen.getByTestId('priority-badge')).toHaveTextContent(/must have/i);
    });

    it('renders correct badge color for must_have priority', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('priority-badge')).toHaveClass('bg-status-error/20');
    });

    it('renders correct badge color for should_have priority', () => {
      render(<UserStoryCard story={{ ...mockUserStory, priority: 'should_have' }} />);

      expect(screen.getByTestId('priority-badge')).toHaveClass('bg-status-warning/20');
    });

    it('renders correct badge color for could_have priority', () => {
      render(<UserStoryCard story={{ ...mockUserStory, priority: 'could_have' }} />);

      expect(screen.getByTestId('priority-badge')).toHaveClass('bg-status-info/20');
    });
  });

  describe('Story Format Display', () => {
    it('renders "As a" section', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('as-a-label')).toHaveTextContent('As a');
      expect(screen.getByTestId('as-a-value')).toHaveTextContent('registered user');
    });

    it('renders "I want" section', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('i-want-label')).toHaveTextContent('I want');
      expect(screen.getByTestId('i-want-value')).toHaveTextContent('to log in using my Google account');
    });

    it('renders "So that" section', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('so-that-label')).toHaveTextContent('So that');
      expect(screen.getByTestId('so-that-value')).toHaveTextContent('I can access the platform without creating a new password');
    });

    it('formats story sections distinctly', () => {
      render(<UserStoryCard story={mockUserStory} />);

      const asALabel = screen.getByTestId('as-a-label');
      expect(asALabel).toHaveClass('font-semibold');
    });
  });

  describe('Acceptance Criteria', () => {
    it('renders acceptance criteria section header', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByText(/acceptance criteria/i)).toBeInTheDocument();
    });

    it('acceptance criteria is expandable', () => {
      render(<UserStoryCard story={mockUserStory} />);

      const toggleButton = screen.getByTestId('toggle-criteria');
      expect(toggleButton).toBeInTheDocument();
    });

    it('acceptance criteria is collapsed by default', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.queryByTestId('criteria-list')).not.toBeVisible();
    });

    it('clicking toggle expands acceptance criteria', () => {
      render(<UserStoryCard story={mockUserStory} />);

      fireEvent.click(screen.getByTestId('toggle-criteria'));

      expect(screen.getByTestId('criteria-list')).toBeVisible();
    });

    it('renders all acceptance criteria items when expanded', () => {
      render(<UserStoryCard story={mockUserStory} />);

      fireEvent.click(screen.getByTestId('toggle-criteria'));

      const items = screen.getAllByTestId(/^criteria-item-/);
      expect(items).toHaveLength(4);
    });

    it('shows criteria count in collapsed state', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('criteria-count')).toHaveTextContent('4');
    });

    it('clicking toggle again collapses criteria', () => {
      render(<UserStoryCard story={mockUserStory} />);

      const toggle = screen.getByTestId('toggle-criteria');
      fireEvent.click(toggle); // expand
      fireEvent.click(toggle); // collapse

      expect(screen.queryByTestId('criteria-list')).not.toBeVisible();
    });
  });

  describe('Linked Requirements', () => {
    it('renders linked requirements section', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('linked-requirements')).toBeInTheDocument();
    });

    it('renders linked requirement badges', () => {
      render(<UserStoryCard story={mockUserStory} />);

      const badges = screen.getAllByTestId(/^requirement-badge-/);
      expect(badges).toHaveLength(2);
    });

    it('requirement badges show requirement IDs', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('requirement-badge-req-001')).toHaveTextContent('req-001');
      expect(screen.getByTestId('requirement-badge-req-002')).toHaveTextContent('req-002');
    });

    it('handles empty linked requirements', () => {
      render(<UserStoryCard story={{ ...mockUserStory, linkedRequirements: [] }} />);

      expect(screen.queryByTestId('linked-requirements')).not.toBeInTheDocument();
    });

    it('calls onRequirementClick when badge is clicked', () => {
      const onRequirementClick = vi.fn();
      render(<UserStoryCard story={mockUserStory} onRequirementClick={onRequirementClick} />);

      fireEvent.click(screen.getByTestId('requirement-badge-req-001'));

      expect(onRequirementClick).toHaveBeenCalledWith('req-001');
    });
  });

  describe('Card Interaction', () => {
    it('renders card container', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('user-story-card')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<UserStoryCard story={mockUserStory} className="my-custom-class" />);

      expect(screen.getByTestId('user-story-card')).toHaveClass('my-custom-class');
    });

    it('can be expanded by default', () => {
      render(<UserStoryCard story={mockUserStory} defaultExpanded />);

      expect(screen.getByTestId('criteria-list')).toBeVisible();
    });

    it('calls onClick when card is clicked', () => {
      const onClick = vi.fn();
      render(<UserStoryCard story={mockUserStory} onClick={onClick} />);

      fireEvent.click(screen.getByTestId('user-story-card'));

      expect(onClick).toHaveBeenCalledWith(mockUserStory);
    });

    it('shows hover effect', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByTestId('user-story-card')).toHaveClass('hover:border-border-primary');
    });
  });

  describe('Accessibility', () => {
    it('has accessible card structure', () => {
      render(<UserStoryCard story={mockUserStory} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('toggle button has aria-expanded attribute', () => {
      render(<UserStoryCard story={mockUserStory} />);

      const toggle = screen.getByTestId('toggle-criteria');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('toggle button updates aria-expanded on click', () => {
      render(<UserStoryCard story={mockUserStory} />);

      const toggle = screen.getByTestId('toggle-criteria');
      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('acceptance criteria list has accessible label', () => {
      render(<UserStoryCard story={mockUserStory} />);

      fireEvent.click(screen.getByTestId('toggle-criteria'));

      const list = screen.getByTestId('criteria-list');
      expect(list).toHaveAttribute('aria-label');
    });

    it('keyboard navigation works for toggle', () => {
      render(<UserStoryCard story={mockUserStory} />);

      const toggle = screen.getByTestId('toggle-criteria');
      fireEvent.keyDown(toggle, { key: 'Enter' });

      expect(screen.getByTestId('criteria-list')).toBeVisible();
    });
  });

  describe('Compact Mode', () => {
    it('supports compact prop', () => {
      render(<UserStoryCard story={mockUserStory} compact />);

      expect(screen.getByTestId('user-story-card')).toHaveClass('p-3');
    });

    it('compact mode hides some elements', () => {
      render(<UserStoryCard story={mockUserStory} compact />);

      // In compact mode, story format should be condensed
      expect(screen.getByTestId('user-story-card')).not.toHaveClass('p-4');
    });
  });
});
