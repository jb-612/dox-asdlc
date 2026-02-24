import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardLayout } from './CardLayout';

describe('CardLayout', () => {
  it('renders title and children', () => {
    render(
      <CardLayout title="My Card">
        <p>Card content</p>
      </CardLayout>,
    );
    expect(screen.getByText('My Card')).toBeInTheDocument();
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <CardLayout title="Title" subtitle="A subtitle">
        <span>body</span>
      </CardLayout>,
    );
    expect(screen.getByText('A subtitle')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(
      <CardLayout title="Title">
        <span>body</span>
      </CardLayout>,
    );
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(0);
  });

  it('renders actions slot', () => {
    render(
      <CardLayout title="Title" actions={<button>Edit</button>}>
        <span>body</span>
      </CardLayout>,
    );
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('renders badge slot next to title', () => {
    render(
      <CardLayout title="Title" badge={<span data-testid="badge">Active</span>}>
        <span>body</span>
      </CardLayout>,
    );
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });
});
