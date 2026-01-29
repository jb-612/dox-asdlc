/**
 * Tests for UserStoriesList component (P05-F11 T15)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UserStoriesList from './UserStoriesList';
import type { UserStory } from '../../../types/ideation';

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

describe('UserStoriesList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const mockUserStories: UserStory[] = [
    {
      id: 'story-001',
      title: 'OAuth Login with Google',
      asA: 'registered user',
      iWant: 'to log in using my Google account',
      soThat: 'I can access the platform without creating a new password',
      acceptanceCriteria: ['Can click sign in', 'Redirected to Google'],
      linkedRequirements: ['req-001'],
      priority: 'must_have',
    },
    {
      id: 'story-002',
      title: 'OAuth Login with GitHub',
      asA: 'developer user',
      iWant: 'to log in using my GitHub account',
      soThat: 'I can quickly access developer features',
      acceptanceCriteria: ['Can click sign in', 'Redirected to GitHub'],
      linkedRequirements: ['req-002'],
      priority: 'must_have',
    },
    {
      id: 'story-003',
      title: 'Enable MFA',
      asA: 'security-conscious user',
      iWant: 'to enable multi-factor authentication',
      soThat: 'my account is protected',
      acceptanceCriteria: ['Can enable TOTP', 'Receives backup codes'],
      linkedRequirements: ['req-003'],
      priority: 'should_have',
    },
    {
      id: 'story-004',
      title: 'Dark Mode Support',
      asA: 'user with light sensitivity',
      iWant: 'to use dark mode',
      soThat: 'I can use the app comfortably at night',
      acceptanceCriteria: ['Can toggle dark mode'],
      linkedRequirements: ['req-004'],
      priority: 'could_have',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('List Rendering', () => {
    it('renders all user story cards', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getAllByTestId('user-story-card')).toHaveLength(4);
    });

    it('renders list container', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getByTestId('user-stories-list')).toBeInTheDocument();
    });

    it('renders empty state when no stories', () => {
      render(<UserStoriesList stories={[]} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('empty state shows helpful message', () => {
      render(<UserStoriesList stories={[]} />);

      expect(screen.getByText(/no user stories/i)).toBeInTheDocument();
    });
  });

  describe('Count Indicator', () => {
    it('renders count indicator', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getByTestId('stories-count')).toBeInTheDocument();
    });

    it('shows correct total count', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getByTestId('stories-count')).toHaveTextContent('4');
    });

    it('updates count when filtered', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      // Filter to only must_have
      fireEvent.click(screen.getByTestId('filter-must_have'));

      expect(screen.getByTestId('stories-count')).toHaveTextContent('2');
    });
  });

  describe('Priority Grouping', () => {
    it('groups stories by priority', () => {
      render(<UserStoriesList stories={mockUserStories} groupByPriority />);

      expect(screen.getByTestId('group-must_have')).toBeInTheDocument();
      expect(screen.getByTestId('group-should_have')).toBeInTheDocument();
      expect(screen.getByTestId('group-could_have')).toBeInTheDocument();
    });

    it('shows must_have group header', () => {
      render(<UserStoriesList stories={mockUserStories} groupByPriority />);

      // The group header is inside the group container
      const group = screen.getByTestId('group-must_have');
      expect(group.querySelector('h3')).toHaveTextContent(/must have/i);
    });

    it('shows should_have group header', () => {
      render(<UserStoriesList stories={mockUserStories} groupByPriority />);

      const group = screen.getByTestId('group-should_have');
      expect(group.querySelector('h3')).toHaveTextContent(/should have/i);
    });

    it('shows could_have group header', () => {
      render(<UserStoriesList stories={mockUserStories} groupByPriority />);

      const group = screen.getByTestId('group-could_have');
      expect(group.querySelector('h3')).toHaveTextContent(/could have/i);
    });

    it('stories are in correct groups', () => {
      render(<UserStoriesList stories={mockUserStories} groupByPriority />);

      const mustHaveGroup = screen.getByTestId('group-must_have');
      expect(mustHaveGroup).toHaveTextContent('OAuth Login with Google');
      expect(mustHaveGroup).toHaveTextContent('OAuth Login with GitHub');
    });

    it('shows count per group', () => {
      render(<UserStoriesList stories={mockUserStories} groupByPriority />);

      expect(screen.getByTestId('group-count-must_have')).toHaveTextContent('2');
      expect(screen.getByTestId('group-count-should_have')).toHaveTextContent('1');
      expect(screen.getByTestId('group-count-could_have')).toHaveTextContent('1');
    });

    it('does not show empty groups when filtered', () => {
      render(<UserStoriesList stories={mockUserStories} groupByPriority />);

      fireEvent.click(screen.getByTestId('filter-must_have'));

      expect(screen.getByTestId('group-must_have')).toBeInTheDocument();
      expect(screen.queryByTestId('group-should_have')).not.toBeInTheDocument();
      expect(screen.queryByTestId('group-could_have')).not.toBeInTheDocument();
    });
  });

  describe('Search/Filter', () => {
    it('renders search input', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('search input has placeholder', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getByTestId('search-input')).toHaveAttribute('placeholder');
    });

    it('filters stories by search term in title', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'Google' },
      });

      expect(screen.getAllByTestId('user-story-card')).toHaveLength(1);
      expect(screen.getByText('OAuth Login with Google')).toBeInTheDocument();
    });

    it('filters stories by search term in content', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'developer' },
      });

      expect(screen.getAllByTestId('user-story-card')).toHaveLength(1);
      expect(screen.getByText('OAuth Login with GitHub')).toBeInTheDocument();
    });

    it('search is case insensitive', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'GOOGLE' },
      });

      expect(screen.getAllByTestId('user-story-card')).toHaveLength(1);
    });

    it('shows no results message when search finds nothing', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'nonexistent' },
      });

      expect(screen.getByTestId('no-results')).toBeInTheDocument();
    });

    it('clears search restores all stories', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Google' } });
      expect(screen.getAllByTestId('user-story-card')).toHaveLength(1);

      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getAllByTestId('user-story-card')).toHaveLength(4);
    });
  });

  describe('Priority Filters', () => {
    it('renders priority filter buttons', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getByTestId('filter-must_have')).toBeInTheDocument();
      expect(screen.getByTestId('filter-should_have')).toBeInTheDocument();
      expect(screen.getByTestId('filter-could_have')).toBeInTheDocument();
    });

    it('clicking filter toggles it on', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      fireEvent.click(screen.getByTestId('filter-must_have'));

      expect(screen.getByTestId('filter-must_have')).toHaveClass('bg-status-error');
    });

    it('clicking active filter toggles it off', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      fireEvent.click(screen.getByTestId('filter-must_have'));
      fireEvent.click(screen.getByTestId('filter-must_have'));

      expect(screen.getByTestId('filter-must_have')).not.toHaveClass('bg-status-error');
    });

    it('multiple filters can be active', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      fireEvent.click(screen.getByTestId('filter-must_have'));
      fireEvent.click(screen.getByTestId('filter-should_have'));

      expect(screen.getAllByTestId('user-story-card')).toHaveLength(3);
    });

    it('filters combine with search', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      fireEvent.click(screen.getByTestId('filter-must_have'));
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'Google' },
      });

      expect(screen.getAllByTestId('user-story-card')).toHaveLength(1);
    });
  });

  describe('Export Functionality', () => {
    it('renders export button', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getByTestId('export-button')).toBeInTheDocument();
    });

    it('exports stories as markdown when clicked', () => {
      // Store original createElement
      const originalCreateElement = document.createElement.bind(document);
      const mockClick = vi.fn();
      const mockAnchor = { click: mockClick, download: '', href: '' };

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return mockAnchor as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tag);
      });

      render(<UserStoriesList stories={mockUserStories} />);
      fireEvent.click(screen.getByTestId('export-button'));

      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('export filename includes "user-stories"', () => {
      // Store original createElement
      const originalCreateElement = document.createElement.bind(document);
      const mockClick = vi.fn();
      const mockAnchor = { click: mockClick, download: '', href: '' };

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return mockAnchor as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tag);
      });

      render(<UserStoriesList stories={mockUserStories} />);
      fireEvent.click(screen.getByTestId('export-button'));

      expect(mockAnchor.download).toContain('user-stories');
    });

    it('export button has accessible label', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getByTestId('export-button')).toHaveAttribute('aria-label');
    });

    it('export button disabled when no stories', () => {
      render(<UserStoriesList stories={[]} />);

      expect(screen.getByTestId('export-button')).toBeDisabled();
    });
  });

  describe('Story Card Interaction', () => {
    it('passes onClick to UserStoryCard', () => {
      const onStoryClick = vi.fn();
      render(<UserStoriesList stories={mockUserStories} onStoryClick={onStoryClick} />);

      fireEvent.click(screen.getAllByTestId('user-story-card')[0]);

      expect(onStoryClick).toHaveBeenCalledWith(mockUserStories[0]);
    });

    it('passes onRequirementClick to UserStoryCard', () => {
      const onRequirementClick = vi.fn();
      render(<UserStoriesList stories={mockUserStories} onRequirementClick={onRequirementClick} />);

      fireEvent.click(screen.getByTestId('requirement-badge-req-001'));

      expect(onRequirementClick).toHaveBeenCalledWith('req-001');
    });
  });

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      render(<UserStoriesList stories={mockUserStories} className="my-custom-class" />);

      expect(screen.getByTestId('user-stories-list')).toHaveClass('my-custom-class');
    });

    it('can hide search', () => {
      render(<UserStoriesList stories={mockUserStories} showSearch={false} />);

      expect(screen.queryByTestId('search-input')).not.toBeInTheDocument();
    });

    it('can hide export button', () => {
      render(<UserStoriesList stories={mockUserStories} showExport={false} />);

      expect(screen.queryByTestId('export-button')).not.toBeInTheDocument();
    });

    it('can hide filters', () => {
      render(<UserStoriesList stories={mockUserStories} showFilters={false} />);

      expect(screen.queryByTestId('filter-must_have')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible list role', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('search input has accessible label', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      expect(screen.getByTestId('search-input')).toHaveAttribute('aria-label');
    });

    it('filter buttons are keyboard accessible', () => {
      render(<UserStoriesList stories={mockUserStories} />);

      const filterButton = screen.getByTestId('filter-must_have');
      fireEvent.keyDown(filterButton, { key: 'Enter' });

      expect(filterButton).toHaveClass('bg-status-error');
    });
  });
});
