/**
 * Tests for accessibility utilities and components
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  VisuallyHidden,
  SkipLink,
  LiveRegion,
  useAnnounce,
  AccessibleIcon,
  getAriaLabel,
  getAriaDescribedBy,
} from './accessibility';

describe('VisuallyHidden', () => {
  it('renders content that is visually hidden but accessible', () => {
    render(<VisuallyHidden>Screen reader only text</VisuallyHidden>);

    const element = screen.getByText('Screen reader only text');
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass('sr-only');
  });

  it('applies custom className', () => {
    render(<VisuallyHidden className="custom">Text</VisuallyHidden>);

    expect(screen.getByText('Text')).toHaveClass('custom');
  });

  it('renders as custom element', () => {
    render(<VisuallyHidden as="h1">Heading</VisuallyHidden>);

    const element = screen.getByRole('heading', { level: 1 });
    expect(element).toBeInTheDocument();
  });
});

describe('SkipLink', () => {
  it('renders skip link', () => {
    render(<SkipLink href="#main">Skip to content</SkipLink>);

    expect(screen.getByTestId('skip-link')).toBeInTheDocument();
  });

  it('has correct href', () => {
    render(<SkipLink href="#main">Skip</SkipLink>);

    expect(screen.getByTestId('skip-link')).toHaveAttribute('href', '#main');
  });

  it('is focusable', () => {
    render(<SkipLink href="#main">Skip</SkipLink>);

    const link = screen.getByTestId('skip-link');
    link.focus();

    expect(document.activeElement).toBe(link);
  });

  it('is visible when focused', () => {
    render(<SkipLink href="#main">Skip</SkipLink>);

    const link = screen.getByTestId('skip-link');
    link.focus();

    // When focused, should have visible styles
    expect(link).toHaveClass('focus:not-sr-only');
  });
});

describe('LiveRegion', () => {
  it('renders with polite aria-live by default', () => {
    render(<LiveRegion>Message</LiveRegion>);

    expect(screen.getByTestId('live-region')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders with assertive aria-live', () => {
    render(<LiveRegion politeness="assertive">Urgent</LiveRegion>);

    expect(screen.getByTestId('live-region')).toHaveAttribute('aria-live', 'assertive');
  });

  it('has aria-atomic attribute', () => {
    render(<LiveRegion>Message</LiveRegion>);

    expect(screen.getByTestId('live-region')).toHaveAttribute('aria-atomic', 'true');
  });

  it('displays message', () => {
    render(<LiveRegion>Important announcement</LiveRegion>);

    expect(screen.getByText('Important announcement')).toBeInTheDocument();
  });
});

describe('useAnnounce', () => {
  function AnnounceTest() {
    const { announce, message } = useAnnounce();

    return (
      <div>
        <button onClick={() => announce('Announced!')}>Announce</button>
        <LiveRegion data-testid="announcement">{message}</LiveRegion>
      </div>
    );
  }

  it('announces message', () => {
    render(<AnnounceTest />);

    act(() => {
      fireEvent.click(screen.getByText('Announce'));
    });

    expect(screen.getByText('Announced!')).toBeInTheDocument();
  });

  it('clears message after delay', () => {
    vi.useFakeTimers();
    render(<AnnounceTest />);

    act(() => {
      fireEvent.click(screen.getByText('Announce'));
    });

    // Message should be present
    expect(screen.getByText('Announced!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Message should be cleared
    expect(screen.queryByText('Announced!')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('AccessibleIcon', () => {
  const MockIcon = () => <svg data-testid="icon" />;

  it('renders icon with aria-hidden when label not provided', () => {
    render(<AccessibleIcon icon={<MockIcon />} />);

    expect(screen.getByTestId('accessible-icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders icon with aria-label when provided', () => {
    render(<AccessibleIcon icon={<MockIcon />} label="Close dialog" />);

    expect(screen.getByTestId('accessible-icon')).toHaveAttribute('aria-label', 'Close dialog');
    expect(screen.getByTestId('accessible-icon')).not.toHaveAttribute('aria-hidden');
  });

  it('renders icon', () => {
    render(<AccessibleIcon icon={<MockIcon />} />);

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});

describe('getAriaLabel', () => {
  it('returns aria-label object', () => {
    const result = getAriaLabel('Test label');

    expect(result).toEqual({ 'aria-label': 'Test label' });
  });

  it('returns empty object for undefined', () => {
    const result = getAriaLabel(undefined);

    expect(result).toEqual({});
  });

  it('returns empty object for empty string', () => {
    const result = getAriaLabel('');

    expect(result).toEqual({});
  });
});

describe('getAriaDescribedBy', () => {
  it('returns aria-describedby object', () => {
    const result = getAriaDescribedBy('description-id');

    expect(result).toEqual({ 'aria-describedby': 'description-id' });
  });

  it('returns empty object for undefined', () => {
    const result = getAriaDescribedBy(undefined);

    expect(result).toEqual({});
  });

  it('returns empty object for empty string', () => {
    const result = getAriaDescribedBy('');

    expect(result).toEqual({});
  });
});
